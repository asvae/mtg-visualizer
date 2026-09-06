// Real engine-piloted trace generator — produces the SAME `TraceResult`
// shape harness.ts's own `runScenario` returns (`{scenario:{setup, action,
// result, raw}, log}` — see harness.ts's own `TraceResult`/`LogEntry`
// interfaces), so trace.json's consumers (the web UI's replay/Scenarios
// tab, verify-synergy.mjs) need no changes at all — only HOW the log gets
// produced changes.
//
// harness.ts's `Scenario`/`runScenario`/`sequence` fires named triggers
// back-to-back against a fresh board: no real turn passage, no real mana
// payment, no summoning-sickness wait, no real Saga lore-counter automation
// — a deliberate, documented simplification (see that file's own doc
// comments), correct for verifying "this card's own effect does X" across
// 312 cards cheaply. It stays exactly as-is; this file does NOT replace or
// modify it.
//
// This file is the OTHER path: for a card whose real arc is worth showing
// played out for real (a transforming Saga crossing real turns, e.g.),
// pilot it through engine.ts/saga.ts's real legality-enforced machinery —
// real cast, real mana payment, a real wait for summoning sickness to
// clear, real Saga lore-counter automation firing chapters on real draw
// steps — and log the SAME `fn`/field-shaped entries harness.ts's own
// `loggingActions`/`loggingPlayer`/`loggingCard` already produce for a
// card's own effects (reused directly from harness.ts, not reimplemented,
// so the two paths can never drift apart on what a `moveTo`/`grantKeyword`/
// `putCounter`/etc. entry looks like), plus a handful of new bracketing
// entries this file owns for real engine-level events harness.ts has no
// equivalent for (`cast`/`activate` paying real mana via `payMana` rather
// than an assumed "unlimited mana" baseline, a real `transform`, a real
// Saga `putCounter`+chapter `trigger` pair fired by `saga.ts` rather than a
// scenario naming the chapter itself).
//
// Opt-in, per-card: run-scenarios.mjs checks for an optional
// `cards/<slug>/engine-scenario.ts` exporting `runEngineScenarios(): TraceResult[]`
// and uses ITS output instead of the harness path for that one card. Every
// other card is unaffected.

import type { CardDefinition, EffectContext, Actions } from './card';
import { GameState, wrapCard } from './state';
import type { RealCard, RealPlayer } from './state';
import {
  createEngine,
  canCastSpell,
  castSpell,
  canActivateAbility,
  activateAbility,
  resolveTop,
  advance,
  type GameEngine,
} from './engine';
import { transformPermanent } from './saga';
import { PHASES } from './turn';
import { setupPlayer, loggingPlayer, loggingCard, loggingActions } from './harness';
import type { PlayerState, TraceResult, LogEntry, Scenario } from './harness';

// Same fixed instanceId convention harness.ts's own `SELF_INSTANCE_ID` uses
// (every scenario here is a single, independent playthrough — no cross-run
// id needs to differentiate).
const SELF_INSTANCE_ID = 1;

const CHAPTER_NAMES = ['chapterI', 'chapterII', 'chapterIII', 'chapterIV', 'chapterV'] as const;

export interface EnginePilotSetup {
  you?: PlayerState;
  opponents?: PlayerState[];
}

export interface EnginePilot {
  state: GameState;
  engine: GameEngine;
  you: RealPlayer;
  opponents: RealPlayer[];
  log: LogEntry[];
  /** A fresh `EffectContext` for `self` — `you`/`opponents` are the SAME logging-wrapped players every call reuses (matching `runScenario`'s own one-`ctx`-per-run shape, just rebuilt per `self` since a transform changes which `CardDefinition` `self` represents, not which real object it is). */
  ctxFor(self: RealCard): EffectContext;
}

/**
 * Sets up a real `GameState`/`GameEngine` via the SAME `setupPlayer` a
 * harness.ts scenario uses (real named tokens/basic lands included), then
 * advances to the `you` player's own Main1 of turn 1 — the same implicit
 * "Main Phase with priority" baseline `Scenario.setupNote`'s own doc
 * comment documents, so a caller can start casting immediately.
 */
export function setupEnginePilot(setup: EnginePilotSetup): EnginePilot {
  const state = new GameState();
  const you = state.addPlayer('you');
  setupPlayer(state, you, setup.you);
  const opponents = (setup.opponents ?? []).map((ps, i) => {
    const opp = state.addPlayer(`opp${i}`);
    setupPlayer(state, opp, ps);
    return opp;
  });

  const engine = createEngine(state, [you, ...opponents]);
  advance(engine); // Untap -> Upkeep
  advance(engine); // Upkeep -> Draw
  advance(engine); // Draw -> Main1

  const log: LogEntry[] = [];
  const youLogging = loggingPlayer(state, you, log);
  const opponentsLogging = opponents.map((o) => loggingPlayer(state, o, log));

  return {
    state,
    engine,
    you,
    opponents,
    log,
    ctxFor: (self) => ({
      self: loggingCard(state, self, log),
      you: youLogging,
      opponents: opponentsLogging,
      castFrom: 'hand',
    }),
  };
}

/** The real `Actions` a pilot script's `resolveCard`/`castSpell`/`activateAbility` calls should run against — same shape `harness.ts`'s own `loggingActions` already builds (real `GameState` mutation, logged), reused directly rather than rebuilt. */
export function pilotActions(pilot: EnginePilot, selfId: number): Actions {
  return loggingActions(pilot.state, pilot.log, selfId);
}

/**
 * Real phase advancement (`engine.ts`'s own `advance`) until `player` is
 * active AND in Main1 of a LATER turn — a genuine wait for summoning
 * sickness to clear (302.6) and lands to untap, not a hand-waved "assume a
 * turn passed."
 *
 * `watchForSaga`, when given, is a single real Saga permanent whose lore
 * counter this crossing might advance — `advance()` (`engine.ts`'s own
 * `doAdvance`) ALREADY auto-fires `saga.ts`'s real 714.2c tick the instant
 * it enters Main1 (a caller is NOT meant to also call `advanceSaga`/
 * `advanceSagasAfterDrawStep` itself afterward — doing so double-fires the
 * chapter sequence, confirmed the hard way while building this pilot).
 * Since that auto-fire happens deep inside `advance()` with no hook to
 * bracket it beforehand, and its OWN chapter effect can (Shiva's own
 * chapter III does exactly this) reset `watchForSaga`'s lore counter via a
 * real 400.7 zone-change transform-back in that SAME synchronous call —
 * meaning an AFTER-the-fact lore diff can't be trusted to detect it (it'd
 * read 0, not "went up then got reset") — this instead decides PROSPECTIVELY,
 * from state available BEFORE calling `advance()`: did this step just cross
 * into Main1 for `watchForSaga`'s OWN controller (the only case
 * `advanceSagasAfterDrawStep`'s own real 714.2c controller-scoping would
 * fire it), and does its currently-registered `CardDefinition` still have a
 * next chapter to give at its CURRENT (pre-tick) lore count? If so, the
 * bracket is spliced in right before that step's own newly logged entries
 * (the chapter's real effects, already appended by the auto-fire's own
 * `resolveCard` call) — nothing else logs during a bare Main1-entering
 * `advance()` step in this pilot's own scenarios (draws aren't logged here
 * — a real, narrow, accepted gap: `turn.ts`'s own `runPhaseEntryAction`
 * calls `state.drawCards` directly against the raw `RealPlayer`, never
 * through a logging wrapper), so the newly-appended segment's start IS the
 * correct causal position. Scoped to ONE watched permanent (this pilot's
 * own real need) — a scenario with more than one live Saga would need
 * extending this to a real per-permanent scan, not supported yet.
 */
export function advanceToPlayersNextMain1(pilot: EnginePilot, player: RealPlayer, watchForSaga?: RealCard): void {
  const startTurn = pilot.engine.turn.turnNumber;
  do {
    const beforeLen = pilot.log.length;
    const registeredBefore = watchForSaga ? pilot.engine.resolvedPermanents.get(watchForSaga.id) : undefined;
    const beforeLore = watchForSaga ? (watchForSaga.counters['LORE'] ?? 0) : 0;
    advance(pilot.engine);
    if (watchForSaga && registeredBefore && PHASES[pilot.engine.turn.phaseIndex] === 'Main1' && pilot.engine.players[pilot.engine.turn.activePlayerIndex]!.id === watchForSaga.controllerId) {
      const chapterName = nextChapterFor(registeredBefore.card, beforeLore);
      if (chapterName) {
        pilot.log.splice(
          beforeLen,
          0,
          { fn: 'putCounter', target: watchForSaga.name, counterType: 'LORE', amount: 1 },
          { fn: 'trigger', card: registeredBefore.card.name, instanceId: SELF_INSTANCE_ID, name: chapterName },
        );
      }
    }
  } while (!(PHASES[pilot.engine.turn.phaseIndex] === 'Main1' && pilot.engine.turn.turnNumber !== startTurn && pilot.engine.players[pilot.engine.turn.activePlayerIndex]!.id === player.id));
}

/** Real cast (601) — legality-checks via `canCastSpell`, throws with the real reason on an illegal pilot script (a bug in the pilot, not a legitimate "declined" case — this file always drives a KNOWN-legal line), else pays real mana and pushes to the real stack, logging a `cast` entry (matching `harness.ts`'s own `lifecycleBefore` shape) plus a `payMana` entry (real mana sources really got tapped by `castSpell`'s own `payMana` call — logged here since `engine.ts` is a legality/mutation layer, not a tracing one, and a mana-source tap must NOT be logged as a plain `tap` entry, which would misread as a card EFFECT tapping something for `verify-synergy.mjs`). */
export function pilotCast(pilot: EnginePilot, cardReal: RealCard, card: CardDefinition, ctx: EffectContext, actions: Actions): void {
  const check = canCastSpell(pilot.engine, pilot.you, card);
  if (!check.ok) throw new Error(`pilotCast("${card.name}"): illegal — ${check.reason}`);
  pilot.log.push({ fn: 'cast', card: card.name, instanceId: SELF_INSTANCE_ID, from: 'hand', cost: card.manaCost });
  const result = castSpell(pilot.engine, pilot.you, cardReal, card, ctx, actions);
  if (!result.ok) throw new Error(`pilotCast("${card.name}"): ${result.reason}`);
  pilot.log.push({ fn: 'payMana', for: card.name, cost: card.manaCost });
}

/** Resolves the top of the real stack (`resolveTop`) and logs the real lifecycle event that follows — `enters`+auto-fired ETB `trigger` (matching `Trigger.on:'enter'`, `engine.ts`'s own real 603.6b auto-fire — the trigger's own effects log for real via whatever `Actions` it was registered with) for a permanent, or a plain `move`-to-graveyard for an instant/sorcery. A no-op (nothing logged) on an empty stack. */
export function pilotResolveTop(pilot: EnginePilot): void {
  const resolved = resolveTop(pilot.engine);
  if (!resolved) return;
  if (resolved.isAbility) return; // the ability's own effects already logged via its own `actions`; no zone change to report (see `engine.ts`'s own `resolveTop` doc comment).
  const isPermanent = !/\b(Instant|Sorcery)\b/.test(resolved.card.typeLine);
  if (isPermanent) {
    pilot.log.push({ fn: 'enters', card: resolved.card.name, instanceId: SELF_INSTANCE_ID, zone: 'Battlefield' });
    const enterTrigger = resolved.card.triggers?.find((t) => t.on === 'enter');
    if (enterTrigger) pilot.log.push({ fn: 'trigger', card: resolved.card.name, instanceId: SELF_INSTANCE_ID, name: enterTrigger.name });
  } else {
    pilot.log.push({ fn: 'move', card: resolved.card.name, instanceId: SELF_INSTANCE_ID, from: 'stack', to: 'Graveyard' });
  }
}

/** A real illegal-attempt check worth demonstrating in the trace (e.g. "the transform ability is blocked by summoning sickness the turn it entered") — logs the real rejection reason `canActivateAbility` gives rather than silently skipping it, so a reader of the replay sees the SAME legality wall a real player would hit. Purely observational: never mutates anything. */
export function pilotExpectIllegalActivate(pilot: EnginePilot, controller: RealPlayer, permanent: RealCard, card: CardDefinition): void {
  const check = canActivateAbility(pilot.engine, controller, permanent, card);
  if (check.ok) throw new Error(`pilotExpectIllegalActivate("${card.name}"): expected this to be illegal, but it's legal`);
  pilot.log.push({ fn: 'illegalAttempt', card: card.name, reason: check.reason });
}

/** Real activated ability (602.1) — same shape as `pilotCast` above: legality-checks, pays real mana + taps the permanent if the cost requires it, pushes to the stack, logs `activate`+`payMana`. */
export function pilotActivate(pilot: EnginePilot, controller: RealPlayer, permanent: RealCard, card: CardDefinition, ctx: EffectContext, actions: Actions): void {
  const check = canActivateAbility(pilot.engine, controller, permanent, card);
  if (!check.ok) throw new Error(`pilotActivate("${card.name}"): illegal — ${check.reason}`);
  pilot.log.push({ fn: 'activate', card: card.name, instanceId: SELF_INSTANCE_ID, cost: card.activationCost ?? '' });
  const result = activateAbility(pilot.engine, controller, permanent, card, ctx, actions);
  if (!result.ok) throw new Error(`pilotActivate("${card.name}"): ${result.reason}`);
  pilot.log.push({ fn: 'payMana', for: card.name, cost: card.activationCost ?? '' });
}

/** The next chapter name this Saga would fire, given its CURRENT (pre-tick) lore-counter count — `undefined` if `card` isn't a Saga, or has no matching chapter trigger declared at that count (714.3a/b, same `CHAPTER_NAMES` convention `saga.ts` itself uses). */
function nextChapterFor(card: CardDefinition, currentLore: number): string | undefined {
  if (!/\bSaga\b/.test(card.typeLine)) return undefined;
  const name = CHAPTER_NAMES[currentLore];
  return name && card.triggers?.some((t) => t.name === name) ? name : undefined;
}

/** Logs the real lore-counter + chapter-trigger bracketing entries a Saga tick is ABOUT to cause (matching `harness.ts`'s own `putCounter`/`trigger` entry shapes), then runs `tick` (the real `saga.ts` call — `transformPermanent`/`advanceSagasAfterDrawStep` — which itself logs the chapter's own effects via whichever `Actions` it was registered with). Logged BEFORE `tick` runs so the trace reads in real causal order: lore counter placed, chapter triggers, THEN its effects happen — not after-the-fact. Safe to call even when no chapter will actually fire this tick (`nextChapterFor` returning `undefined` — a non-Saga permanent, or a Saga already past its last chapter): logs nothing in that case. */
function logSagaTickThenRun(pilot: EnginePilot, real: RealCard, card: CardDefinition, tick: () => void): void {
  const currentLore = real.counters['LORE'] ?? 0;
  const chapterName = nextChapterFor(card, currentLore);
  if (chapterName) {
    pilot.log.push({ fn: 'putCounter', target: real.name, counterType: 'LORE', amount: 1 });
    pilot.log.push({ fn: 'trigger', card: card.name, instanceId: SELF_INSTANCE_ID, name: chapterName });
  }
  tick();
}

/** Registers `real` as now being represented by `newFace` (a transform), logging `transform` plus — when `newFace` is a Saga (the modern "enters OR transforms into a Saga" errata `saga.ts`'s own `transformPermanent` implements) — its real immediate first lore-counter tick (714.2b/c). Thin wrapper around `saga.ts`'s own `transformPermanent`, not a reimplementation. */
export function pilotTransform(pilot: EnginePilot, real: RealCard, newFace: CardDefinition, ctx: EffectContext, actions: Actions): void {
  pilot.log.push({ fn: 'transform', card: real.name, into: newFace.name });
  logSagaTickThenRun(pilot, real, newFace, () => transformPermanent(pilot.engine, real, newFace, ctx, actions));
}

/** Wraps a pilot's finished `log` into the same `TraceResult` shape `harness.ts`'s own `runScenario` returns, so trace.json's consumers need no changes. `raw` carries a real `Scenario`-shaped record of the initial setup (for the replay UI's own board reconstruction, same convention `TraceResult.scenario.raw` already documents) — NOT a literal `Scenario` this pilot was driven by (there's no `sequence` here, this is real engine piloting, not harness.ts's own mechanism), just enough of that shape for the UI to seed its initial zones from. */
export function finishEnginePilotTrace(pilot: EnginePilot, setup: EnginePilotSetup, action: string, result: string): TraceResult {
  const raw: Scenario = { result, ...setup };
  return {
    scenario: { setup: describeEngineSetup(setup), action, result, raw },
    log: pilot.log,
  };
}

/** Same non-default-only rendering `harness.ts`'s own `describePlayerState`/`describeSetup` use, kept intentionally minimal here (just tokens/basicLands — the only `PlayerState` fields an engine-piloted scenario needs so far) rather than importing that file's private per-field logic wholesale. */
function describeEngineSetup(setup: EnginePilotSetup): string {
  const parts: string[] = [];
  const describe = (ps: PlayerState | undefined, whose: string) => {
    if (!ps) return;
    if (ps.tokens?.length) parts.push(`${whose} a ${ps.tokens.join(', ')}`);
    if (ps.basicLands?.length) parts.push(`${whose} ${ps.basicLands.length} ${ps.basicLands[0]}(s)`);
  };
  describe(setup.you, 'you:');
  (setup.opponents ?? []).forEach((ps, i) => describe(ps, `opp${i}:`));
  return parts.join('; ');
}
