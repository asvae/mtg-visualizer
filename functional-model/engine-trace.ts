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
// Opt-in, per-card: a card's own `scenarios.ts` exports `runEngineScenarios():
// TraceResult[]` instead of the usual `scenarios` array; run-scenarios.mjs
// dispatches on which export it finds and uses this path's output for that
// one card's trace.json instead of the harness path. Every other card is
// unaffected.

import type { CardDefinition, EffectContext, Actions } from './card';
import { resolveCard } from './card';
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
import { PHASES, currentPhase, activePlayer } from './turn';
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

/** Optional real `EffectContext` fields a pilot script sometimes needs to fix before a specific resolution — same real fields harness.ts's own `Scenario.declineTriggers`/`Scenario.triggerInput`/`Scenario.mode` doc comments already explain the need for (a genuine "decline the optional target" demonstration; a value this model can't compute itself, like a card's own printed X or a total-mana-value read; which modal branch was chosen). Note that `ctxFor`'s returned `EffectContext` is the SAME object a permanent's `resolvedPermanents` entry keeps around for its whole battlefield lifetime (`engine.ts`'s own `resolveTop`/`saga.ts`'s `transformPermanent` both store the exact reference passed in, never a copy) — so mutating fields directly on a previously-returned `ctx` (e.g. setting `ctx.triggerInput` right before a later Saga chapter tick that needs it) works too, and is how a pilot script gives a LATER automatic trigger fire a value this call didn't need yet. */
export interface EnginePilotCtxOpts {
  declineOptional?: boolean;
  triggerInput?: Record<string, unknown>;
  mode?: number;
}

export interface EnginePilot {
  state: GameState;
  engine: GameEngine;
  you: RealPlayer;
  opponents: RealPlayer[];
  log: LogEntry[];
  /** A coarser, human-labeled index into `log` (see `TraceResult.actions`'s own doc comment in harness.ts) — every helper below calls `beginStep` as its own first line, so a pilot script gets one for free per real action; call it directly too for a raw `pilot.log.push(...)` block a script writes itself with no helper wrapping it. */
  actions: { label: string; from: number }[];
  /** Marks `pilot.log.length` (right now, before whatever's about to be logged) as the start of a new named action. Doesn't know or predict how many log entries that action will produce — a reader derives each action's end itself (see harness.ts's own `TraceResult.actions` doc comment). */
  beginStep(label: string): void;
  /** A fresh `EffectContext` for `self` — `you`/`opponents` are the SAME logging-wrapped players every call reuses (matching `runScenario`'s own one-`ctx`-per-run shape, just rebuilt per `self` since a transform changes which `CardDefinition` `self` represents, not which real object it is). */
  ctxFor(self: RealCard, opts?: EnginePilotCtxOpts): EffectContext;
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
  const actions: { label: string; from: number }[] = [];
  const youLogging = loggingPlayer(state, you, log);
  const opponentsLogging = opponents.map((o) => loggingPlayer(state, o, log));

  return {
    state,
    engine,
    you,
    opponents,
    log,
    actions,
    beginStep: (label) => actions.push({ label, from: log.length }),
    ctxFor: (self, opts) => ({
      self: loggingCard(state, self, log),
      you: youLogging,
      opponents: opponentsLogging,
      castFrom: 'hand',
      declineOptional: opts?.declineOptional,
      triggerInput: opts?.triggerInput,
      mode: opts?.mode,
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
export function advanceToPlayersNextMain1(pilot: EnginePilot, player: RealPlayer, watchForSaga?: RealCard, label?: string): void {
  pilot.beginStep(label ?? `Turn passes to ${player.name}'s next Main1`);
  const startTurn = pilot.engine.turn.turnNumber;
  do {
    const beforeLen = pilot.log.length;
    const registeredBefore = watchForSaga ? pilot.engine.resolvedPermanents.get(watchForSaga.id) : undefined;
    const beforeLore = watchForSaga ? (watchForSaga.counters['LORE'] ?? 0) : 0;
    advance(pilot.engine);
    if (watchForSaga && registeredBefore && PHASES[pilot.engine.turn.phaseIndex] === 'Main1' && pilot.engine.players[pilot.engine.turn.activePlayerIndex]!.id === watchForSaga.controllerId) {
      const chapterName = nextChapterFor(registeredBefore.card, beforeLore);
      if (chapterName) {
        // Spliced at `beforeLen` (log length before THIS iteration's own
        // `advance()` ran) so a Saga tick that happens partway through a
        // multi-turn wait lands in its real chronological spot, before
        // whatever `advance()` itself already appended internally for it
        // (the chapter's own effects) — same real-causal-order reasoning
        // `pilotResolveTop`'s own doc comment establishes elsewhere. This
        // one genuinely is per-iteration: a Saga can tick on ANY Main1
        // crossing along the way, not just the final one this loop stops
        // at (unlike the generic "arrived" marker below, which is not).
        pilot.log.splice(
          beforeLen,
          0,
          { fn: 'putCounter', target: watchForSaga.name, counterType: 'LORE', amount: 1 },
          { fn: 'trigger', card: registeredBefore.card.name, instanceId: SELF_INSTANCE_ID, name: chapterName },
        );
      }
    }
  } while (!(PHASES[pilot.engine.turn.phaseIndex] === 'Main1' && pilot.engine.turn.turnNumber !== startTurn && pilot.engine.players[pilot.engine.turn.activePlayerIndex]!.id === player.id));
  // ONE real "we arrived" marker for the WHOLE multi-turn wait — not one
  // per internal phase crossed along the way (confirmed too spammy the
  // hard way: a real playthrough logged ~50 phase entries for what's
  // really a handful of meaningful waits). Appended at the end, after any
  // Saga tick(s) spliced in above, since this marks the DESTINATION this
  // call was waiting for, not the journey there.
  pilot.log.push({ fn: 'phase', phase: currentPhase(pilot.engine.turn), turn: pilot.engine.turn.turnNumber, player: activePlayer(pilot.engine.turn, pilot.engine.players).name });
}

/** Advances exactly one phase (`advance`), logging the same real `phase` bracket entry `advanceToPlayersNextMain1` logs once for its own whole wait — this one call IS the whole meaningful step, so it always gets its own entry, no spam concern (unlike a multi-iteration loop). The thin single-step version for a pilot script that just needs to cross one specific boundary (Combat Declare Attackers -> Declare Blockers, e.g.) rather than loop until a whole condition is met. */
export function advanceOneStep(pilot: EnginePilot, label?: string): void {
  pilot.beginStep(label ?? 'Advance one step');
  advance(pilot.engine);
  pilot.log.push({ fn: 'phase', phase: currentPhase(pilot.engine.turn), turn: pilot.engine.turn.turnNumber, player: activePlayer(pilot.engine.turn, pilot.engine.players).name });
}

/** Real turn-structure advancement (`advance`), from wherever `pilot.engine.turn` currently is, forward to the Declare Attackers step of THIS SAME turn — logging exactly ONE real `phase` bracket entry for the whole wait (same "one per call, not one per internal step" fix `advanceToPlayersNextMain1` needed), not one per phase crossed getting there. A pilot script normally calls `advanceToPlayersNextMain1` first if the attacker just entered this turn (302.6), then this, to reach a legal Declare Attackers step. */
export function advanceToDeclareAttackersStep(pilot: EnginePilot, label?: string): void {
  pilot.beginStep(label ?? 'Advance to Declare Attackers');
  while (currentPhase(pilot.engine.turn) !== 'CombatDeclareAttackers') advance(pilot.engine);
  pilot.log.push({ fn: 'phase', phase: currentPhase(pilot.engine.turn), turn: pilot.engine.turn.turnNumber, player: activePlayer(pilot.engine.turn, pilot.engine.players).name });
}

/** Logs one real `tapForMana` entry per real source `mana.ts`'s own `payMana` actually tapped (its return value — see that function's own doc comment) — a DIFFERENT fn than plain `tap` (same reasoning this used to log a single summary `payMana` entry instead: a mana-source tap must not be misread as a card EFFECT tapping something by `verify-synergy.mjs`), but now naming exactly which real land/source paid, not just that some real cost was paid (a user's own real question this answers: "which specific lands got tapped for mana?"). A no-op for an empty/undefined list (a `{T}`-only ability's activation cost, e.g. — nothing needed tapping for mana). */
function logTappedForMana(pilot: EnginePilot, forCard: CardDefinition, tapped: RealCard[] | undefined): void {
  for (const source of tapped ?? []) pilot.log.push({ fn: 'tapForMana', target: source.name, for: forCard.name });
}

/** Real cast (601) — legality-checks via `canCastSpell`, throws with the real reason on an illegal pilot script (a bug in the pilot, not a legitimate "declined" case — this file always drives a KNOWN-legal line), else pays real mana and pushes to the real stack, logging a `cast` entry (matching `harness.ts`'s own `lifecycleBefore` shape) plus one real `tapForMana` entry per real land/source `castSpell`'s own `payMana` call actually tapped (see `logTappedForMana`'s own doc comment). */
export function pilotCast(pilot: EnginePilot, cardReal: RealCard, card: CardDefinition, ctx: EffectContext, actions: Actions, label?: string): void {
  pilot.beginStep(label ?? `Cast ${card.name} (${card.manaCost})`);
  const check = canCastSpell(pilot.engine, pilot.you, card);
  if (!check.ok) throw new Error(`pilotCast("${card.name}"): illegal — ${check.reason}`);
  pilot.log.push({ fn: 'cast', card: card.name, instanceId: SELF_INSTANCE_ID, from: 'hand', cost: card.manaCost });
  const result = castSpell(pilot.engine, pilot.you, cardReal, card, ctx, actions);
  if (!result.ok) throw new Error(`pilotCast("${card.name}"): ${result.reason}`);
  logTappedForMana(pilot, card, result.tappedForMana);
}

/**
 * Resolves the top of the real stack (`resolveTop`) and logs the real
 * lifecycle event that follows — `enters`+auto-fired ETB `trigger`
 * (matching `Trigger.on:'enter'`, `engine.ts`'s own real 603.6b auto-fire)
 * for a permanent, or a plain `move`-to-graveyard for an instant/sorcery. A
 * no-op (nothing logged) on an empty stack.
 *
 * The bracketing entries (`enters`, a fresh Saga's own immediate 714.2b/c
 * lore-counter tick, the ETB `trigger` name) are logged BEFORE calling
 * `resolveTop`, not after: `resolveTop` (`engine.ts`) performs the real
 * mutation AND runs the entering permanent's own Saga tick / ETB trigger
 * SYNCHRONOUSLY inside itself, appending their own real effect log lines
 * (via whatever `Actions` the permanent was cast with) before returning —
 * so logging the bracket only after it returns would put a trigger's own
 * effects BEFORE the "enters"/"trigger" lines that supposedly caused them
 * (confirmed the wrong way in an earlier draft of this file: Jill's own
 * ETB bounce logged BEFORE her "enters"/"trigger" bracket). Peeking the
 * stack's top card first (`Stack.peek`, read-only) lets this log the
 * correct causal shell first, THEN let the real resolution fill in what
 * happened inside it — same real-causal-order principle `logSagaTickThenRun`
 * already established for a transform's own tick.
 *
 * A Saga cast straight from hand (Summon: Bahamut, e.g. — as opposed to a
 * transform INTO a Saga, which `pilotTransform`'s own `logSagaTickThenRun`
 * already handles) always has exactly 0 lore counters before this specific
 * tick (714.2b: a Saga enters with none) — so `nextChapterFor` is checked
 * at a hardcoded `currentLore: 0` here, not read off the (not-yet-existing)
 * registration.
 */
export function pilotResolveTop(pilot: EnginePilot, label?: string): void {
  pilot.beginStep(label ?? 'Resolve');
  const peeked = pilot.engine.stack.peek();
  if (!peeked) return;
  if (peeked.isAbility) {
    resolveTop(pilot.engine); // the ability's own effects log via its own `actions`; no zone change to report (see `engine.ts`'s own `resolveTop` doc comment).
    return;
  }
  const isPermanent = !/\b(Instant|Sorcery)\b/.test(peeked.card.typeLine);
  if (isPermanent) {
    pilot.log.push({ fn: 'enters', card: peeked.card.name, instanceId: SELF_INSTANCE_ID, zone: 'Battlefield' });
    const chapterName = nextChapterFor(peeked.card, 0);
    if (chapterName) {
      pilot.log.push({ fn: 'putCounter', target: peeked.ctx.self.getName(), counterType: 'LORE', amount: 1 });
      pilot.log.push({ fn: 'trigger', card: peeked.card.name, instanceId: SELF_INSTANCE_ID, name: chapterName });
    }
    const enterTrigger = peeked.card.triggers?.find((t) => t.on === 'enter');
    if (enterTrigger) pilot.log.push({ fn: 'trigger', card: peeked.card.name, instanceId: SELF_INSTANCE_ID, name: enterTrigger.name });
    resolveTop(pilot.engine);
  } else {
    resolveTop(pilot.engine);
    pilot.log.push({ fn: 'move', card: peeked.card.name, instanceId: SELF_INSTANCE_ID, from: 'stack', to: 'Graveyard' });
  }
}

/**
 * Manually fires a named trigger that has no auto-fire mechanism in
 * `engine.ts` yet (an attack/life-gain/dies trigger, e.g. — `Trigger.on`
 * only recognizes `'enter'|'upkeep'|'endStep'`, a real, accepted gap) —
 * logs the SAME real `{fn:'trigger', card, instanceId, name}` bracket entry
 * `pilotResolveTop`/`saga.ts`'s own auto-fires already produce for a
 * recognized one, THEN runs it via `resolveCard` (whose own effects log for
 * real via `actions`). Logging this bracket matters beyond readability:
 * `verify-synergy.mjs`'s own `triggerNames` set (used to satisfy a
 * synergy.json "want" fact mapped to this trigger via its
 * `TRIGGER_EVENT_MAP`) is built ENTIRELY from `{fn:'trigger', name}`
 * entries — a bare `resolveCard` call with no such entry logged first would
 * genuinely run the effect but leave it looking, to that check, like it
 * never happened at all (confirmed the hard way: Aerith Gainsborough's own
 * `onLifeGained`/`onDies` wants both hard-failed until this was added).
 */
export function pilotFireTrigger(pilot: EnginePilot, card: CardDefinition, ctx: EffectContext, actions: Actions, triggerName: string, label?: string): void {
  pilot.beginStep(label ?? `Fire ${triggerName}`);
  pilot.log.push({ fn: 'trigger', card: card.name, instanceId: SELF_INSTANCE_ID, name: triggerName });
  resolveCard(card, ctx, actions, triggerName);
}

/** A real illegal-attempt check worth demonstrating in the trace (e.g. "the transform ability is blocked by summoning sickness the turn it entered") — logs the real rejection reason `canActivateAbility` gives rather than silently skipping it, so a reader of the replay sees the SAME legality wall a real player would hit. Purely observational: never mutates anything. */
export function pilotExpectIllegalActivate(pilot: EnginePilot, controller: RealPlayer, permanent: RealCard, card: CardDefinition, label?: string): void {
  pilot.beginStep(label ?? `Attempt (expected illegal): ${card.name}`);
  const check = canActivateAbility(pilot.engine, controller, permanent, card);
  if (check.ok) throw new Error(`pilotExpectIllegalActivate("${card.name}"): expected this to be illegal, but it's legal`);
  pilot.log.push({ fn: 'illegalAttempt', card: card.name, reason: check.reason });
}

/** Real activated ability (602.1) — same shape as `pilotCast` above: legality-checks, pays real mana + taps the permanent if the cost requires it, pushes to the stack, logs `activate`+`payMana`. */
export function pilotActivate(pilot: EnginePilot, controller: RealPlayer, permanent: RealCard, card: CardDefinition, ctx: EffectContext, actions: Actions, label?: string): void {
  pilot.beginStep(label ?? `Activate ${card.name}`);
  const check = canActivateAbility(pilot.engine, controller, permanent, card);
  if (!check.ok) throw new Error(`pilotActivate("${card.name}"): illegal — ${check.reason}`);
  pilot.log.push({ fn: 'activate', card: card.name, instanceId: SELF_INSTANCE_ID, cost: card.activationCost ?? '' });
  const result = activateAbility(pilot.engine, controller, permanent, card, ctx, actions);
  if (!result.ok) throw new Error(`pilotActivate("${card.name}"): ${result.reason}`);
  logTappedForMana(pilot, card, result.tappedForMana);
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
  // Deliberately no `beginStep` here — a transform is engine bookkeeping
  // (which CardDefinition a permanent is now registered as), not a distinct
  // player action of its own (see this file's own header + ENGINE_GAPS.md's
  // "no Actions.transform()" gap). The REAL event a transform represents is
  // always already covered by whichever action is currently open when this
  // gets called (the activation that caused it resolving, or the turn-pass
  // that triggered an automatic Saga tick) — these entries just tail onto
  // that, same as `tapForMana`'s own detail-not-a-beat treatment.
  pilot.log.push({ fn: 'transform', card: real.name, into: newFace.name });
  logSagaTickThenRun(pilot, real, newFace, () => transformPermanent(pilot.engine, real, newFace, ctx, actions));
}

/** Wraps a pilot's finished `log` into the same `TraceResult` shape `harness.ts`'s own `runScenario` returns, so trace.json's consumers need no changes. `raw` carries a real `Scenario`-shaped record of the initial setup (for the replay UI's own board reconstruction, same convention `TraceResult.scenario.raw` already documents) — NOT a literal `Scenario` this pilot was driven by (there's no `sequence` here, this is real engine piloting, not harness.ts's own mechanism), just enough of that shape for the UI to seed its initial zones from. */
export function finishEnginePilotTrace(pilot: EnginePilot, setup: EnginePilotSetup, action: string, result: string): TraceResult {
  const raw: Scenario = { result, ...setup };
  return {
    scenario: { setup: describeEngineSetup(setup), action, result, raw },
    log: pilot.log,
    actions: pilot.actions,
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
