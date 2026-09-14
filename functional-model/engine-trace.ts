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

import type { CardDefinition, EffectContext, Actions, AlternateCost } from './card';
import type { Card } from './interfaces';
import { GameState, wrapCard, shouldDoubleTrigger } from './state';
import type { RealCard, RealPlayer, TriggerCause } from './state';
import { fireTrigger } from './triggers';
import {
  createEngine,
  canCastSpell,
  castSpell,
  effectiveCastCost,
  canPlayLand,
  playLand,
  canPlayFromLibraryTop,
  playFromLibraryTop,
  canActivateAbility,
  activateAbility,
  costRequiresTap,
  costRequiresDiscardSelf,
  activationCostFor,
  effectiveActivationCost,
  resolveTop,
  advance,
  declareAttackers,
  declareBlockers,
  canAttack,
  resolveFirstStrikeCombatDamage,
  resolveCombatDamage,
  queueExtraPhase as engineQueueExtraPhase,
  type GameEngine,
  type CombatDamageResult,
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
  /**
   * Same real, player-visible "fixed by the game event, not computed" fact
   * `card.ts`'s own `EffectContext.castFrom` doc comment describes —
   * `harness.ts`'s own scenario runner already reads this off
   * `Scenario.castFrom` (defaulting to `'hand'`); `ctxFor` below used to
   * hardcode `'hand'` unconditionally with no way to override it, a real gap
   * that only surfaced once a card's own effect actually branches on
   * `ctx.castFrom` under THIS pilot path (From Father to Son, fin/20 —
   * "If this spell was cast from a graveyard, put that card onto the
   * battlefield instead"; every earlier engine-piloted alternate-cost card,
   * Auron's Inspiration, never reads `castFrom` in its own effect, so the
   * hardcoding was invisible until now). Defaults to `'hand'`, unchanged for
   * every existing caller; a pilot script casting via an `AlternateCost`
   * whose own effect needs to see that should pass the matching `alt.from`
   * here explicitly (`ctxFor` does not infer it from a later `pilotCast`
   * call — cause and effect run in the order the pilot script itself calls
   * them).
   */
  castFrom?: 'hand' | 'graveyard' | 'exile';
  /** A real player's own manual target pick (`EffectContext.preferTarget` — see card.ts's own doc comment on it) — NOT automated/weighed selection, just an explicit override of `chooseTarget`'s old unconditional `pool[0]` default. */
  preferTarget?: (c: Card) => boolean;
  /** The `CardDefinition` matching whatever `RealCard` is genuinely on top of `you`'s library right now (`EffectContext.topLibraryCard`, card.ts — ENGINE_GAPS.md gap #16) — a pilot script invoking a `kind:'playFromLibraryTop'` effect (The Lunar Whale, e.g.) supplies this the same explicit way it supplies `castFrom`/`mode`. */
  topLibraryCard?: CardDefinition;
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
  // Every real action's own span already reaches the END of the log for
  // free (the LAST one's span runs to `log.length`, nothing needed there —
  // an "End" marker would just be a redundant duplicate of that same final
  // snapshot under a new label, tried and reverted earlier). The gap is at
  // the OTHER end: `stepIndex`'s minimum position already jumps to the END
  // of the first real action (mana already tapped, etc. — see
  // `finishEnginePilotTrace`'s own `actions` doc comment for the exact
  // span math), with no way to see the genuinely untouched starting board.
  // This one real "before anything happened" marker fixes that — always
  // `from: 0`, always first, so the SECOND entry (whatever the scenario's
  // own first real beginStep call turns out to be) still spans exactly the
  // same real range it always did.
  const actions: { label: string; from: number }[] = [{ label: 'Start', from: 0 }];
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
      castFrom: opts?.castFrom ?? 'hand',
      declineOptional: opts?.declineOptional,
      triggerInput: opts?.triggerInput,
      mode: opts?.mode,
      preferTarget: opts?.preferTarget,
      topLibraryCard: opts?.topLibraryCard,
    }),
  };
}

/**
 * The real `Actions` a pilot script's `resolveCard`/`castSpell`/
 * `activateAbility` calls should run against — same shape `harness.ts`'s own
 * `loggingActions` already builds (real `GameState` mutation, logged) for
 * every method EXCEPT `play` (ENGINE_GAPS.md gap #16), which this overrides
 * with a REAL, engine-checked dispatch instead of `loggingActions`'s own
 * plain (no legality/mana) fallback — see that method's own doc comment for
 * why a plain harness-style implementation can't reuse `canPlayLand`/
 * `playLand`/`canCastSpell`/`castSpell` at all (no `GameEngine` reference
 * there). Reused directly rather than rebuilt for every other method.
 */
export function pilotActions(pilot: EnginePilot, selfId: number): Actions {
  const base = loggingActions(pilot.state, pilot.log, selfId);
  return {
    ...base,
    /**
     * CR 601/305's own umbrella "play" (ENGINE_GAPS.md gap #16) — real
     * dispatch via `canPlayFromLibraryTop`/`playFromLibraryTop` (`engine.ts`),
     * which itself reuses the real `canPlayLand`/`playLand`/`canCastSpell`/
     * `castSpell` pairs (see those functions' own doc comments for the real
     * Forge `PlayEffect.java` citation). `card` (`EffectContext.topLibraryCard`,
     * threaded here from whichever effect called `actions.play`) is REQUIRED
     * for this override — unlike `loggingActions.play`'s own plain fallback,
     * there's no legality/mana dispatch possible without it.
     */
    play: (player, target, card) => {
      if (!card) throw new Error(`pilotActions.play("${target.getName()}"): missing CardDefinition — a pilot script must supply EffectContext.topLibraryCard`);
      const playerReal = pilot.state.players.get(player.getId() as number)!;
      const cardReal = pilot.state.cards.get(target.getId() as number)!;
      // The umbrella event fact itself (`event:'play'`, `from:'Library'`) —
      // real regardless of which real sub-action (land-drop or cast) follows,
      // logged BEFORE the legality check/mutation for the same real-causal-
      // order reasoning `pilotResolveTop`'s own doc comment establishes.
      pilot.log.push({ fn: 'play', card: card.name, id: cardReal.id, from: 'Library' });
      const check = canPlayFromLibraryTop(pilot.engine, playerReal, cardReal, card);
      if (!check.ok) throw new Error(`pilotActions.play("${card.name}"): illegal — ${check.reason}`);
      const isLand = /\bLand\b/.test(card.typeLine);
      const targetCtx = pilot.ctxFor(cardReal);
      const targetActions = pilotActions(pilot, cardReal.id);
      if (isLand) {
        pilot.log.push({ fn: 'playLand', card: card.name, instanceId: SELF_INSTANCE_ID });
        pilot.log.push({ fn: 'enters', card: card.name, instanceId: SELF_INSTANCE_ID, zone: 'Battlefield' });
        const enterTrigger = card.triggers?.find((t) => t.on === 'enter');
        if (enterTrigger) pilot.log.push({ fn: 'trigger', card: card.name, instanceId: SELF_INSTANCE_ID, name: enterTrigger.name });
      } else {
        const { costString } = effectiveCastCost(card, undefined, undefined, undefined, playerReal);
        pilot.log.push({ fn: 'cast', card: card.name, instanceId: SELF_INSTANCE_ID, from: 'library', cost: costString });
      }
      const result = playFromLibraryTop(pilot.engine, playerReal, cardReal, card, targetCtx, targetActions);
      if (!result.ok) throw new Error(`pilotActions.play("${card.name}"): ${result.reason}`);
      // The non-land (cast) branch only pushes onto the real stack here —
      // same two-call split every other cast in this engine has — a pilot
      // script must still call `pilotResolveTop` afterward to actually
      // resolve it (a no-op, safely, for the land branch, which never
      // touches the stack at all).
      logTappedForMana(pilot, card, result.tappedForMana);
    },
    /**
     * Real "insert one more occurrence of this phase group" (ENGINE_GAPS.md
     * gap #17) — unlike `loggingActions.queueExtraPhase`'s own log-only
     * fallback (no `TurnState` in scope on that plain path), a real pilot
     * script genuinely has one (`pilot.engine.turn`): this override queues
     * for real via `engine.ts`'s own `queueExtraPhase`, so a LATER
     * `advance`/`advanceOneStep` call in the same pilot script genuinely
     * re-enters the queued phase group instead of just logging an inert
     * intent.
     */
    queueExtraPhase: (phaseType) => {
      engineQueueExtraPhase(pilot.engine, phaseType);
      pilot.log.push({ fn: 'queueExtraPhase', phaseType });
    },
  };
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
 * `resolveCard` call) — a Main1-entering `advance()` step never has its
 * OWN automatic action to splice (`logAutomaticPhaseEntry` only ever fires
 * for Untap/Draw/Cleanup, a different iteration than the one landing on
 * Main1), so the newly-appended segment's start IS the correct causal
 * position. Scoped to ONE watched permanent (this pilot's
 * own real need) — a scenario with more than one live Saga would need
 * extending this to a real per-permanent scan, not supported yet.
 */
interface PreAdvanceSnapshot {
  /** Every battlefield card, across all players, that was tapped right before this `advance()` call — diffed against the active player's own battlefield afterward to find exactly which ones a real Untap-phase entry (`turn.ts`'s own `runPhaseEntryAction`) untapped. */
  tappedIds: Set<number>;
  /** Each player's own hand, as real card OBJECTS (not just ids) — a real Draw needs the newly-ADDED ones (diffed by id against `after`), a real Cleanup discard needs the ones that DISAPPEARED (only readable from a BEFORE list, since a discarded card is gone from `.hand` by the time `advance()` returns). */
  hands: Map<number, RealCard[]>;
  /** Whatever `GameState.untilEndOfTurnKeywordGrants` held right before this `advance()` call — a real Cleanup-phase entry drains that list entirely (`state.ts`'s own `clearUntilEndOfTurnKeywordGrants`), so by the time `advance()` returns there's nothing left to read it FROM; this is the only way to know which (card, keyword) pairs a Cleanup crossing just ended, for the synthetic removal entry below. */
  untilEndOfTurnGrants: { cardId: number; keyword: string }[];
  /** Same real need, for a `pump`'s own `opts.untilEndOfTurn` (`state.ts`'s own `untilEndOfTurnPumps`/`clearUntilEndOfTurnPumps`) — a real Cleanup drains this list too, so the synthetic "pump expired" entry below needs it captured beforehand. */
  untilEndOfTurnPumps: { cardId: number; timestamp: number; powerDelta: number; toughnessDelta: number }[];
}

function snapshotBeforeAdvance(pilot: EnginePilot): PreAdvanceSnapshot {
  const tappedIds = new Set<number>();
  const hands = new Map<number, RealCard[]>();
  for (const p of pilot.engine.players) {
    for (const c of p.battlefield) if (c.tapped) tappedIds.add(c.id);
    hands.set(p.id, [...p.hand]);
  }
  return { tappedIds, hands, untilEndOfTurnGrants: [...pilot.state.untilEndOfTurnKeywordGrants], untilEndOfTurnPumps: [...pilot.state.untilEndOfTurnPumps] };
}

/**
 * Splices synthetic log entries (at `atIndex`, same real-causal-order
 * reasoning `advanceToPlayersNextMain1`'s own Saga-tick splice already
 * uses) for whichever of Untap/Draw/Cleanup's real automatic actions
 * (`turn.ts`'s own `runPhaseEntryAction`) THIS SPECIFIC `advance()` call
 * just ran. Those mutate real state directly via a raw `RealPlayer`/
 * `RealCard`, bypassing every logging wrapper this file/harness.ts
 * otherwise route everything through — confirmed the hard way: lands
 * never showed as untapped in replay despite genuinely being untapped in
 * real state, same root cause the "no one draws" gap already had. Diffs
 * real before/after state rather than re-deriving the rule itself, so
 * this can't drift from whatever `runPhaseEntryAction` actually does —
 * only Untap/Draw/Cleanup ever produce a diff; every other phase is a
 * silent no-op here (nothing automatic happens entering them).
 */
function logAutomaticPhaseEntry(pilot: EnginePilot, before: PreAdvanceSnapshot, atIndex: number): void {
  const phase = PHASES[pilot.engine.turn.phaseIndex];
  const active = pilot.engine.players[pilot.engine.turn.activePlayerIndex]!;
  const entries: LogEntry[] = [];
  if (phase === 'Untap') {
    for (const c of active.battlefield) {
      if (before.tappedIds.has(c.id) && !c.tapped) entries.push({ fn: 'untap', target: c.name });
    }
  } else if (phase === 'Draw') {
    const beforeIds = new Set((before.hands.get(active.id) ?? []).map((c) => c.id));
    const drawn = active.hand.filter((c) => !beforeIds.has(c.id));
    if (drawn.length === 1) entries.push({ fn: 'drawCard', player: active.name, card: drawn[0]!.name });
    else if (drawn.length > 1) entries.push({ fn: 'drawCards', player: active.name, n: drawn.length, cards: drawn.map((c) => c.name) });
  } else if (phase === 'Cleanup') {
    const afterIds = new Set(active.hand.map((c) => c.id));
    const discarded = (before.hands.get(active.id) ?? []).filter((c) => !afterIds.has(c.id));
    if (discarded.length) entries.push({ fn: 'discard', player: active.name, qty: discarded.length, cards: discarded.map((c) => c.name) });
    // Real 514.2 "until end of turn" keyword-grant removal (`state.ts`'s
    // own `clearUntilEndOfTurnKeywordGrants`, called game-wide by THIS
    // SAME `advance()` — not just the active player's own permanents,
    // matching the real rule's own scope) — a synthetic `grantKeyword`
    // entry with `removed: true` for each pair `before` actually held,
    // confirmed still gone from the real card's own `keywords` now (the
    // one, rare way it wouldn't be: something else re-granted the exact
    // same keyword to the exact same card permanently in between, which
    // this diff correctly declines to report as removed). See
    // `.claude/contracts/state-event-format.md`'s own dated entry for the
    // full reasoning and the `card`-side rendering contract this commits
    // to (additive field, no removal without this entry).
    for (const { cardId, keyword } of before.untilEndOfTurnGrants) {
      const card = pilot.state.cards.get(cardId);
      if (card && !card.keywords.includes(keyword)) entries.push({ fn: 'grantKeyword', target: card.name, id: card.id, keyword, removed: true });
    }
    // Same real need, for a `pump`'s own `opts.untilEndOfTurn` (`state.ts`'s
    // `untilEndOfTurnPumps`/`clearUntilEndOfTurnPumps`) — this SAME Cleanup
    // crossing already drained the list for real (`LayerSet.remove`, via
    // `runPhaseEntryAction`'s own `clearUntilEndOfTurnPumps` call), so a
    // synthetic `pump removed:true` entry is the only way the trace shows
    // the expiry actually happened, not just that the effect was applied
    // earlier. Unlike the keyword-grant diff above, this doesn't need a
    // "still gone" re-check against live state (`LayerSet` has no
    // `includes`-style membership query to re-check against) — the
    // timestamped entry either got drained by THIS Cleanup (it's in
    // `before`, and `clearUntilEndOfTurnPumps` unconditionally drains
    // everything in the list every time) or it wasn't due yet (not in
    // `before` at all), so presence in `before` alone is the correct signal.
    for (const { cardId, powerDelta, toughnessDelta } of before.untilEndOfTurnPumps) {
      const card = pilot.state.cards.get(cardId);
      if (card) entries.push({ fn: 'pump', target: card.name, id: card.id, power: -powerDelta, toughness: -toughnessDelta, removed: true });
    }
  }
  if (entries.length) pilot.log.splice(atIndex, 0, ...entries);
}

export function advanceToPlayersNextMain1(pilot: EnginePilot, player: RealPlayer, watchForSaga?: RealCard): void {
  const startTurn = pilot.engine.turn.turnNumber;
  do {
    const beforeLen = pilot.log.length;
    const beforeTurn = pilot.engine.turn.turnNumber;
    const endingPlayer = activePlayer(pilot.engine.turn, pilot.engine.players);
    const registeredBefore = watchForSaga ? pilot.engine.resolvedPermanents.get(watchForSaga.id) : undefined;
    const beforeLore = watchForSaga ? (watchForSaga.counters['LORE'] ?? 0) : 0;
    const beforeAdvance = snapshotBeforeAdvance(pilot);
    advance(pilot.engine);
    logAutomaticPhaseEntry(pilot, beforeAdvance, beforeLen);
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
    // A real turn boundary crossed THIS iteration (302: the active player
    // rotates exactly once per Untap-phase entry) — its own real action, a
    // player's own decision to pass turn, not an opaque "N turns just
    // happened" skip. Tagged with whichever player's turn just ENDED (not
    // whose is starting): your own remaining turn (Main2/EndOfTurn/
    // Cleanup) ends first, THEN the opponent's whole turn happens and
    // ends, landing back on your Main1 — two real passes in that
    // chronological order, not one lumped wait. Checked AFTER the splice
    // above (not before): a chapter tick's own `putCounter`/`trigger` pair
    // gets inserted at `beforeLen`, an EARLIER log index than whatever
    // `pilot.log.length` reads once `beginStep` below captures its own
    // `from` — computing that after the splice keeps it accurate; before
    // would record a `from` the splice then silently shifts out from under
    // it. Every OTHER phase crossed along the way (Upkeep, Draw, Combat
    // steps, ...) stays silent, tailing onto whichever "Pass turn" most
    // recently opened — same "no beginStep = falls under whatever's open"
    // convention `pilotTransform`'s own comment establishes.
    if (pilot.engine.turn.turnNumber !== beforeTurn) {
      pilot.beginStep(`Pass turn (${endingPlayer.name})`);
      // Same turn/phase/player triple the final "arrived" entry below logs,
      // just ALSO at every intermediate turn boundary this loop crosses —
      // without it, a multi-turn wait's own opponent-turn span had no phase
      // entry of its own at all, so the replay widget kept showing whatever
      // player/phase was active before the wait started (confirmed the hard
      // way: "Turn 3, Your turn, Main1" stayed on screen the entire time an
      // opponent's whole turn was passing in between). Not spam the same way
      // logging every Upkeep/Draw/Combat step would be — this only fires once
      // per real turn boundary, and that boundary already gets its own
      // `beginStep` above, so this just completes that same moment's data.
      pilot.log.push({ fn: 'phase', phase: currentPhase(pilot.engine.turn), turn: pilot.engine.turn.turnNumber, player: activePlayer(pilot.engine.turn, pilot.engine.players).name });
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
  const beforeLen = pilot.log.length;
  const beforeAdvance = snapshotBeforeAdvance(pilot);
  advance(pilot.engine);
  logAutomaticPhaseEntry(pilot, beforeAdvance, beforeLen);
  pilot.log.push({ fn: 'phase', phase: currentPhase(pilot.engine.turn), turn: pilot.engine.turn.turnNumber, player: activePlayer(pilot.engine.turn, pilot.engine.players).name });
}

/** Real turn-structure advancement (`advance`), from wherever `pilot.engine.turn` currently is, forward to the Declare Attackers step of THIS SAME turn — logging exactly ONE real `phase` bracket entry for the whole wait (same "one per call, not one per internal step" fix `advanceToPlayersNextMain1` needed), not one per phase crossed getting there. A pilot script normally calls `advanceToPlayersNextMain1` first if the attacker just entered this turn (302.6), then this, to reach a legal Declare Attackers step. */
export function advanceToDeclareAttackersStep(pilot: EnginePilot, label?: string): void {
  pilot.beginStep(label ?? 'Advance to Declare Attackers');
  while (currentPhase(pilot.engine.turn) !== 'CombatDeclareAttackers') {
    const beforeLen = pilot.log.length;
    const beforeAdvance = snapshotBeforeAdvance(pilot);
    advance(pilot.engine);
    logAutomaticPhaseEntry(pilot, beforeAdvance, beforeLen);
  }
  pilot.log.push({ fn: 'phase', phase: currentPhase(pilot.engine.turn), turn: pilot.engine.turn.turnNumber, player: activePlayer(pilot.engine.turn, pilot.engine.players).name });
}

/**
 * Real 508.1a-legal attacker declaration (`engine.ts`'s own
 * `declareAttackers`) — logs the real 508.1f tap it performs on each
 * non-Vigilance attacker as an actual `tap` entry (previously bypassed
 * logging entirely — `engine.ts` is as log-agnostic as `turn.ts`, same
 * root cause `logAutomaticPhaseEntry` above exists for; confirmed the hard
 * way: a real scenario's own attacker never showed as tapped in replay
 * despite genuinely being tapped in real state), plus one `attack` marker
 * per real attacker declared. Throws on an illegal batch, same
 * "don't half-apply, don't silently continue" contract every other
 * pilot* helper here already has.
 *
 * **Splices these markers in at the log length captured BEFORE calling the
 * real `declareAttackers`, not a trailing push (2026-09-14, ENGINE_GAPS.md —
 * attack-triggered-ability auto-dispatch)** — `declareAttackers` itself now
 * auto-fires a real `on: 'attacks'` trigger (`engine.ts`'s new
 * `fireOnAttackTriggers`) as its very last step, which can synchronously
 * append its own effect log lines (via this SAME `pilot`'s logging
 * `actions`) before this function ever gets a chance to log its own
 * tap/attack markers. A trailing push would then show the trigger's own
 * effects BEFORE the attack that caused them — same real ordering bug
 * `logAutomaticPhaseEntry`'s own splice-at-`beforeLen` convention already
 * exists to prevent for Untap/Draw/Cleanup's own automatic actions.
 *
 * **Also logs a synthetic `{fn:'trigger', name}` bracket per attacker with a
 * registered `on: 'attacks'` trigger** — same real reason `pilotResolveTop`'s
 * own ETB auto-fire already logs one (see that function's own doc comment):
 * `verify-synergy.mjs`'s own `triggerNames`/`TRIGGER_EVENT_MAP` evidence
 * check for an event-shaped SINK want is built ENTIRELY from `{fn:'trigger',
 * name}` bracket entries in the trace, and this engine's own real auto-fire
 * (unlike the manual `pilotFireTrigger` this replaces) never pushes one
 * itself. Peeked BEFORE calling the real `declareAttackers` (same "peek the
 * CardDefinition, THEN call the real mutating function" shape
 * `pilotResolveTop` already uses for its own ETB peek) so the bracket lands
 * in the spliced batch, before the trigger's own already-appended effects.
 * **Scoped to exactly one attacker per call** (Ashe, Princess of Dalmasca is
 * the only real card exercising this today) — an N-attacker batch where MORE
 * THAN ONE has its own `on: 'attacks'` trigger would bunch every trigger
 * bracket ahead of every attacker's own effects instead of interleaving them
 * per-attacker; real, narrower-than-ideal, not attempted since no pool
 * scenario needs it yet.
 */
export function pilotDeclareAttackers(pilot: EnginePilot, attackers: RealCard[], label?: string): void {
  pilot.beginStep(label ?? `Declare ${attackers.map((c) => c.name).join(', ')} as attacker${attackers.length > 1 ? 's' : ''}`);
  const beforeLen = pilot.log.length;
  const entries: LogEntry[] = [];
  for (const a of attackers) {
    // `id`/`cardId` added 2026-09-12 alongside `harness.ts`'s own
    // `loggingActions` per-instance-id fix (real regression: multiple
    // real, distinct board instances sharing a name broke a trace
    // consumer's own name-only target resolution) — this pilot-script tap/
    // attack log site was a second, independently-missed instance of the
    // exact same collision class (any engine-piloted scenario with 2
    // same-named attackers), additive-only per `.claude/contracts/state-
    // event-format.md`'s own non-breaking-field rule.
    if (!a.keywords.includes('Vigilance')) entries.push({ fn: 'tap', target: a.name, id: a.id });
    entries.push({ fn: 'attack', card: a.name, id: a.id });
    const registered = pilot.engine.resolvedPermanents.get(a.id);
    const attackTrigger = registered?.card.triggers?.find((t) => t.on === 'attacks');
    if (attackTrigger) entries.push({ fn: 'trigger', card: a.name, instanceId: SELF_INSTANCE_ID, name: attackTrigger.name });
  }
  const result = declareAttackers(pilot.engine, attackers);
  if (!result.ok) throw new Error(`pilotDeclareAttackers: illegal — ${result.reason}`);
  pilot.log.splice(beforeLen, 0, ...entries);
}

/** Real 509.1-legal blocker declaration (`engine.ts`'s own `declareBlockers`) — logs one `block` marker per real (blocker, attacker) pair. An empty `assignments` (no blocks declared) is a real, legal choice — logs nothing (no player-visible board change from declining to block). */
export function pilotDeclareBlockers(pilot: EnginePilot, assignments: Array<{ blocker: RealCard; attacker: RealCard }>, label?: string): void {
  pilot.beginStep(label ?? (assignments.length ? `Declare ${assignments.map((a) => a.blocker.name).join(', ')} as blocker${assignments.length > 1 ? 's' : ''}` : 'Declare no blockers'));
  const result = declareBlockers(pilot.engine, assignments);
  if (!result.ok) throw new Error(`pilotDeclareBlockers: illegal — ${result.reason}`);
  for (const { blocker, attacker } of assignments) pilot.log.push({ fn: 'block', blocker: blocker.name, blockerId: blocker.id, attacker: attacker.name, attackerId: attacker.id });
}

/**
 * Real 510 combat damage (`engine.ts`'s own `resolveCombatDamage`) — logs a
 * real `damagePrevented` entry (same shape `harness.ts`'s own
 * `loggingActions.dealDamage` uses for the identical real event, ENGINE_GAPS.md
 * gap #8) per real creature whose combat damage this call prevented outright
 * (`result.prevented`, `engine.ts`'s own `CombatDamageResult` doc comment) —
 * Diamond Weapon's own "Prevent all combat damage that would be dealt to
 * Diamond Weapon" is the reference case. Deliberately does NOT also log a
 * generic `dealDamage` entry per `result.entries` — `resolveCombatDamage`
 * only ever tracks accumulated TOTAL damage per creature this call, not
 * which individual attacker/blocker dealt how much, so there's no single
 * real (source, target) pair to name the way every other `dealDamage` log
 * entry in this codebase does; a future pilot helper wanting that level of
 * detail would need `resolveCombatDamage` itself restructured to track it,
 * out of scope here. Returns the real result so a pilot script can still
 * inspect `entries`/`lethal` directly.
 */
export function pilotResolveCombatDamage(pilot: EnginePilot, label?: string): CombatDamageResult {
  pilot.beginStep(label ?? 'Resolve combat damage');
  const result = resolveCombatDamage(pilot.engine);
  for (const card of result.prevented) pilot.log.push({ fn: 'damagePrevented', target: card.name, id: card.id, cause: 'combat' });
  return result;
}

/**
 * Real `CombatFirstStrikeDamage` step (510.4/510.5, ENGINE_GAPS.md gap #9,
 * closed 2026-09-12) — `engine.ts`'s own `resolveFirstStrikeCombatDamage`.
 * Only ever call this once a pilot script has actually advanced to
 * `currentPhase(pilot.engine.turn) === 'CombatFirstStrikeDamage'` (that
 * phase is skipped outright by `advance`/`advanceOneStep` when no
 * attacker/blocker this combat has First or Double Strike — a pilot
 * script checks `currentPhase` after its own `advanceOneStep` call to know
 * whether it was reached at all). Same `damagePrevented`-only logging
 * shape as `pilotResolveCombatDamage` above, for the same reason (no
 * single (source, target) pair to name).
 */
export function pilotResolveFirstStrikeCombatDamage(pilot: EnginePilot, label?: string): CombatDamageResult {
  pilot.beginStep(label ?? 'Resolve first-strike combat damage');
  const result = resolveFirstStrikeCombatDamage(pilot.engine);
  for (const card of result.prevented) pilot.log.push({ fn: 'damagePrevented', target: card.name, id: card.id, cause: 'combat' });
  return result;
}

/** Logs one real `tapForMana` entry per real source `mana.ts`'s own `payMana` actually tapped (its return value — see that function's own doc comment) — a DIFFERENT fn than plain `tap` (same reasoning this used to log a single summary `payMana` entry instead: a mana-source tap must not be misread as a card EFFECT tapping something by `verify-synergy.mjs`), but now naming exactly which real land/source paid, not just that some real cost was paid (a user's own real question this answers: "which specific lands got tapped for mana?"). A no-op for an empty/undefined list (a `{T}`-only ability's activation cost, e.g. — nothing needed tapping for mana). */
function logTappedForMana(pilot: EnginePilot, forCard: CardDefinition, tapped: RealCard[] | undefined): void {
  for (const source of tapped ?? []) pilot.log.push({ fn: 'tapForMana', target: source.name, for: forCard.name });
}

/**
 * Real cast (601) — legality-checks via `canCastSpell`, throws with the real
 * reason on an illegal pilot script (a bug in the pilot, not a legitimate
 * "declined" case — this file always drives a KNOWN-legal line), else pays
 * real mana and pushes to the real stack, logging a `cast` entry (matching
 * `harness.ts`'s own `lifecycleBefore` shape) plus one real `tapForMana`
 * entry per real land/source `castSpell`'s own `payMana` call actually
 * tapped (see `logTappedForMana`'s own doc comment).
 *
 * `alt` (optional, one of `card.alternateCosts`) pilots a real Flashback/
 * Jump-start-shaped alternate-cost cast (CR 702.32/702.67, `engine.ts`'s
 * own `canCastSpell`/`castSpell` doc comments) instead of the ordinary
 * hand-cast — the logged `cast` entry's own `from`/`cost` name `alt.from`/
 * `alt.cost` (matching `harness.ts`'s own `lifecycleBefore` shape for a
 * `scenario.castFrom` cast) rather than the hardcoded `'hand'`/
 * `card.manaCost`. Does NOT itself move `cardReal` into `alt.from`'s zone
 * first — the pilot script is responsible for having put it there (e.g. via
 * `pilot.state.addCard(pilot.you, 'Graveyard', ...)`), same as `engine.ts`'s
 * own "trust the caller" contract for this.
 *
 * `declaredTarget` (optional) — see `engine.ts`'s `canCastSpell`/
 * `castSpell` doc comments: the real object this cast targets, consulted
 * for a real `card.costReduction` condition (CR 601.2f) AND (ENGINE_GAPS.md
 * gap #4, closed 2026-09-12) genuinely locked in as this spell's own real
 * cast-time target — re-validated at resolution (`card.ts`'s
 * `resolveTargets`, CR 608.2b: dropped, not replaced, if it's no longer
 * legal by then). The logged `cast` entry's own `cost` field reflects the
 * REAL cost actually paid after any such reduction (`engine.ts`'s
 * `effectiveCastCost`), not just the nominal printed/alt cost — same "log
 * what genuinely happened" standard `tapForMana` already holds to for
 * exactly which lands paid.
 *
 * `declaredTargets` (optional) — the general multi-target form; takes
 * precedence over `[declaredTarget]` when given (see `castSpell`'s own doc
 * comment).
 *
 * `x` (optional, ENGINE_GAPS.md gap #6) — the real value announced for a
 * `{X}` in `card.manaCost`; the logged `cast` entry's own `cost` reflects
 * the RESOLVED cost (e.g. `{3}{R}{R}` for Choco Comet with `x: 3`), same
 * "log what genuinely happened" standard as the cost-reduction case above.
 * Only affects payment here — a pilot script wanting the card's own EFFECT
 * to see the same value must also set `ctx.xPaid` on the `EffectContext` it
 * builds (`card.ts`'s pre-existing field; `pilotCast` doesn't build `ctx`).
 *
 * Also passes `pilot.you` as `effectiveCastCost`'s own `caster` param (ENGINE_GAPS.md
 * gap #7's second real example, The Wind Crystal's own broadcast cost
 * reduction) so the logged `cost` field reflects a real battlefield
 * `spellCostReductionGrants` discount too, not just `declaredTarget`'s own
 * condition — same "log what genuinely happened" standard.
 */
export function pilotCast(pilot: EnginePilot, cardReal: RealCard, card: CardDefinition, ctx: EffectContext, actions: Actions, label?: string, alt?: AlternateCost, declaredTarget?: RealCard, x?: number, declaredTargets?: RealCard[]): void {
  const { costString } = effectiveCastCost(card, alt, declaredTarget, x, pilot.you);
  pilot.beginStep(label ?? (alt ? `Cast ${card.name} via ${alt.name} (${costString})` : `Cast ${card.name} (${costString})`));
  const check = canCastSpell(pilot.engine, pilot.you, card, alt, declaredTarget, x);
  if (!check.ok) throw new Error(`pilotCast("${card.name}"): illegal — ${check.reason}`);
  pilot.log.push({ fn: 'cast', card: card.name, instanceId: SELF_INSTANCE_ID, from: alt?.from ?? 'hand', cost: costString });
  const result = castSpell(pilot.engine, pilot.you, cardReal, card, ctx, actions, undefined, alt, declaredTarget, x, declaredTargets);
  if (!result.ok) throw new Error(`pilotCast("${card.name}"): ${result.reason}`);
  logTappedForMana(pilot, card, result.tappedForMana);
}

/**
 * Real CR 305.1 special action (`engine.ts`'s own `canPlayLand`/`playLand`)
 * — legality-checks, throws with the real reason on an illegal pilot script
 * (same "this file always drives a KNOWN-legal line" contract every other
 * `pilot*` helper here has), else logs the real bracket entries a land-drop
 * produces BEFORE calling the real mutating `playLand` — same real-causal-
 * order reasoning `pilotResolveTop`'s own doc comment establishes (a
 * `Trigger.on === 'enter'` ETB fires SYNCHRONOUSLY inside `playLand` and
 * logs its own effects via `actions`, so the bracket that supposedly CAUSED
 * them needs to already be in the log first): a `playLand` entry matching
 * `harness.ts`'s own `lifecycleBefore` shape for a Land typeLine (`{fn:
 * 'playLand', card, instanceId}`, no `from`/`cost` — a land has neither), an
 * `enters` entry (a land-drop is ALSO a real zone change onto the
 * battlefield, same as `harness.ts`'s own doc comment on this), and the ETB
 * `trigger` bracket if `card` declares one (e.g. Vector, Imperial Capital's
 * own tap-a-land trigger). Unlike `pilotCast`+`pilotResolveTop`'s own two-
 * call split (needed for a spell's real wait on the Stack), this is ONE
 * call — CR 305.1 lands never touch the stack, so there's no separate
 * "resolve" step to pair it with.
 */
export function pilotPlayLand(pilot: EnginePilot, cardReal: RealCard, card: CardDefinition, ctx: EffectContext, actions: Actions, label?: string): void {
  pilot.beginStep(label ?? `Play ${card.name}`);
  const check = canPlayLand(pilot.engine, pilot.you, card);
  if (!check.ok) throw new Error(`pilotPlayLand("${card.name}"): illegal — ${check.reason}`);
  pilot.log.push({ fn: 'playLand', card: card.name, instanceId: SELF_INSTANCE_ID });
  pilot.log.push({ fn: 'enters', card: card.name, instanceId: SELF_INSTANCE_ID, zone: 'Battlefield' });
  const enterTrigger = card.triggers?.find((t) => t.on === 'enter');
  if (enterTrigger) {
    pilot.log.push({ fn: 'trigger', card: card.name, instanceId: SELF_INSTANCE_ID, name: enterTrigger.name });
    // Same real doubling pre-check `pilotResolveTop` above uses (ENGINE_GAPS.md
    // gap #13) — `engine.ts`'s own `playLand` (called just below) already
    // re-runs the trigger's effects for real via `fireTrigger`; this only
    // decides whether to log a matching second bracket entry.
    if (shouldDoubleTrigger(pilot.engine.state, cardReal, { kind: 'entersBattlefield', entered: cardReal })) {
      pilot.log.push({ fn: 'trigger', card: card.name, instanceId: SELF_INSTANCE_ID, name: enterTrigger.name });
    }
  }
  const result = playLand(pilot.engine, pilot.you, cardReal, card, ctx, actions);
  if (!result.ok) throw new Error(`pilotPlayLand("${card.name}"): ${result.reason}`);
}

/** Real CR 305.1 land-drop attempt expected to be REJECTED (the once-per-turn limit, 305.3's own sorcery-speed timing outside a main phase or with a non-empty stack, e.g.) — same purely-observational contract as `pilotExpectIllegalCast`. Never mutates — no zone change, no counter increment. */
export function pilotExpectIllegalPlayLand(pilot: EnginePilot, caster: RealPlayer, card: CardDefinition, label?: string): void {
  pilot.beginStep(label ?? `Attempt (expected illegal): play ${card.name}`);
  const check = canPlayLand(pilot.engine, caster, card);
  if (check.ok) throw new Error(`pilotExpectIllegalPlayLand("${card.name}"): expected this to be illegal, but it's legal`);
  pilot.log.push({ fn: 'illegalAttempt', card: card.name, reason: check.reason });
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
    if (enterTrigger) {
      pilot.log.push({ fn: 'trigger', card: peeked.card.name, instanceId: SELF_INSTANCE_ID, name: enterTrigger.name });
      // Real "Panharmonicon effect" (ENGINE_GAPS.md gap #13) — `engine.ts`'s
      // own `resolveTop` (called just below) already re-runs this trigger's
      // effects a second time via `triggers.ts`'s `fireTrigger` when a real
      // `triggerDoubling` grant covers it; this pre-check (same board state,
      // same `entersBattlefield` cause `resolveTop` itself uses) only
      // decides whether to log a SECOND bracket entry here too, so the
      // trace's own bracket honestly reflects a doubled firing rather than
      // implying it happened once while the underlying effects show twice.
      const selfReal = pilot.engine.state.cards.get(peeked.ctx.self.getId());
      if (selfReal && shouldDoubleTrigger(pilot.engine.state, selfReal, { kind: 'entersBattlefield', entered: selfReal })) {
        pilot.log.push({ fn: 'trigger', card: peeked.card.name, instanceId: SELF_INSTANCE_ID, name: enterTrigger.name });
      }
    }
    resolveTop(pilot.engine);
  } else {
    // Real 702.32/702.67: a Flashback/Jump-start-cast spell (`peeked.thenExile`
    // — set by `pilotCast`'s own `alt` param via `castSpell`, see `engine.ts`'s
    // `resolveTop`) resolves to Exile instead of the Graveyard.
    const to = peeked.thenExile ? 'Exile' : 'Graveyard';
    resolveTop(pilot.engine);
    pilot.log.push({ fn: 'move', card: peeked.card.name, instanceId: SELF_INSTANCE_ID, from: 'stack', to });
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
 *
 * Routes through `triggers.ts`'s own shared `fireTrigger` (ENGINE_GAPS.md gap
 * #13, closed 2026-09-12) rather than calling `resolveCard` directly, so a
 * real `triggerDoubling` grant on the board genuinely re-fires this trigger
 * a second time when one applies — `cause` (optional, a NEW trailing param
 * so every one of this function's ~14 existing real call sites stays
 * unchanged) is threaded straight through for a gate that filters on it
 * (Masamune's own `causedBy:'dying'`, Traveling Chocobo's own
 * `causedBy:'entersBattlefield'`). Logs a SECOND `{fn:'trigger', ...}`
 * bracket when it doubles, so the trace's own bracket honestly shows the
 * real doubled firing, not just the underlying effects running twice under
 * one undoubled-looking bracket.
 */
export function pilotFireTrigger(pilot: EnginePilot, card: CardDefinition, ctx: EffectContext, actions: Actions, triggerName: string, label?: string, cause?: TriggerCause): void {
  pilot.beginStep(label ?? `Fire ${triggerName}`);
  pilot.log.push({ fn: 'trigger', card: card.name, instanceId: SELF_INSTANCE_ID, name: triggerName });
  // `onDoubled` logs the SECOND bracket in true causal order — right
  // before the second round of effects runs, not both brackets up front.
  fireTrigger(pilot.engine.state, card, ctx, actions, triggerName, cause, () => {
    pilot.log.push({ fn: 'trigger', card: card.name, instanceId: SELF_INSTANCE_ID, name: triggerName });
  });
}

/** A real illegal-attempt check worth demonstrating in the trace (e.g. "the transform ability is blocked by summoning sickness the turn it entered") — logs the real rejection reason `canActivateAbility` gives rather than silently skipping it, so a reader of the replay sees the SAME legality wall a real player would hit. Purely observational: never mutates anything. */
export function pilotExpectIllegalActivate(pilot: EnginePilot, controller: RealPlayer, permanent: RealCard, card: CardDefinition, label?: string): void {
  pilot.beginStep(label ?? `Attempt (expected illegal): ${card.name}`);
  const check = canActivateAbility(pilot.engine, controller, permanent, card);
  if (check.ok) throw new Error(`pilotExpectIllegalActivate("${card.name}"): expected this to be illegal, but it's legal`);
  pilot.log.push({ fn: 'illegalAttempt', card: card.name, reason: check.reason });
}

/** Real 508.1a-legal attacker declaration expected to be REJECTED (Defender's real 302.6a "can't attack" clause, e.g.) — same purely-observational contract as `pilotExpectIllegalActivate`: checks `canAttack` for every proposed attacker, throws if all of them turn out legal (the pilot script's own bug, not a real rejection to show), else logs the real reason `engine.ts` itself gives. Never mutates — no `declareAttackers` call, no tap. */
export function pilotExpectIllegalAttack(pilot: EnginePilot, attackers: RealCard[], label?: string): void {
  pilot.beginStep(label ?? `Attempt (expected illegal): declare ${attackers.map((c) => c.name).join(', ')} as attacker${attackers.length > 1 ? 's' : ''}`);
  for (const creature of attackers) {
    const check = canAttack(pilot.engine, creature);
    if (!check.ok) {
      pilot.log.push({ fn: 'illegalAttempt', card: creature.name, reason: check.reason });
      return;
    }
  }
  throw new Error('pilotExpectIllegalAttack: expected at least one of these to be illegal, but every one is legal');
}

/** Real 509.1-legal blocker declaration expected to be REJECTED (Flying's real 509.1b restriction, Menace's real 509.1b/702.111b two-blocker minimum, e.g.) — same purely-observational contract as `pilotExpectIllegalActivate`. Checks the WHOLE batch via `declareBlockers`'s own real legality (per-pair `canBlock` plus its own whole-batch Menace/one-blocker-per-attacker rules), throws if it turns out legal, else logs the real rejection reason. Never mutates — `engine.blockers` is untouched either way. */
export function pilotExpectIllegalBlock(pilot: EnginePilot, assignments: Array<{ blocker: RealCard; attacker: RealCard }>, label?: string): void {
  pilot.beginStep(label ?? `Attempt (expected illegal): declare ${assignments.map((a) => a.blocker.name).join(', ')} as blocker${assignments.length > 1 ? 's' : ''}`);
  const result = declareBlockers(pilot.engine, assignments);
  if (result.ok) throw new Error('pilotExpectIllegalBlock: expected this to be illegal, but it is legal');
  pilot.log.push({ fn: 'illegalAttempt', card: assignments[0]?.blocker.name ?? '', reason: result.reason });
}

/** Real 601/307.1a/117.1a cast expected to be REJECTED (sorcery-speed timing outside caster's own Main1/Main2 with an empty stack, e.g. — the real contrast a Flash card's own legal cast at the same moment demonstrates) — same purely-observational contract as `pilotExpectIllegalActivate`. Never mutates — no stack push, no mana paid. */
export function pilotExpectIllegalCast(pilot: EnginePilot, caster: RealPlayer, card: CardDefinition, label?: string): void {
  pilot.beginStep(label ?? `Attempt (expected illegal): cast ${card.name}`);
  const check = canCastSpell(pilot.engine, caster, card);
  if (check.ok) throw new Error(`pilotExpectIllegalCast("${card.name}"): expected this to be illegal, but it's legal`);
  pilot.log.push({ fn: 'illegalAttempt', card: card.name, reason: check.reason });
}

/**
 * Real activated ability (602.1) — same shape as `pilotCast` above:
 * legality-checks, pays real mana + taps the permanent if the cost requires
 * it, pushes to the stack, logs `activate`+`payMana`.
 *
 * Also logs a real, standalone `tap` entry for a `{T}` COST payment
 * (2026-09-12, venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal's own
 * Hero's Sundering, `{7}, {T}`) — `engine.ts`'s own `activateAbility` pays
 * that cost via a bare `engine.state.tap(permanent)` call with NO log line
 * of its own (`engine.ts` is log-agnostic by design, same as `turn.ts`), so
 * without this, a real, visible state mutation (the permanent becomes
 * tapped) was invisible to both the trace and the replay UI. Same root
 * cause, same fix shape as `pilotDeclareAttackers`'s own real 508.1f
 * attack-tap fix above ("previously bypassed logging entirely ... confirmed
 * the hard way"). Checked the real blast radius before adding this: 3 other
 * pool cards already call `pilotActivate` with a `{T}`-costed ability (Dion
 * Bahamut's Dominant, Stiltzkin Moogle Merchant, Jill Shiva's Dominant) —
 * none currently have a HARD failure that would flip to passing or
 * regress from this (Dion/Jill are already failing/noting for unrelated
 * stale-trace reasons; Stiltzkin's synergy.json is still v1-shaped and
 * skipped by verify-synergy.mjs entirely); a NEW unexplained `tap` soft
 * note on those is the same accepted, documented side-effect shape the
 * `pump`/`tap` vocabulary promotions already established pool-wide
 * (SYNERGY_DESIGN.md), not a fresh regression class. Venat, Heart of
 * Hydaelyn is the first card whose ONLY tap is its own cost payment with no
 * OTHER tap-shaped effect to coincidentally back a `{event:'tap',
 * subject:'self', target:'self'}` fact's trace evidence the way Coeurl's
 * own self-tap-cost fact happens to (Coeurl's own ability separately,
 * genuinely taps a TARGET creature, which its own scenario's chooseTarget
 * pool-order limitation happens to retarget onto itself — see that card's
 * own scenarios.ts comment) — without this fix there is no scenario that
 * could ever produce real evidence for such a fact on a card like this one.
 *
 * `abilityName` (2026-09-12, Qiqirn Merchant/fin-65 migration): threads
 * through to `canActivateAbility`/`activateAbility`/`activationCostFor`
 * (`engine.ts`) exactly the way those three already support — omitted, this
 * still resolves the single default `card.activationCost`+`card.effects`
 * ability (every prior caller's own unchanged behavior). A real, general
 * gap this card's own `card.abilities` array (TWO independent named
 * activated abilities on one permanent) surfaced: without this, there was
 * no way to engine-pilot ANY named ability at all — `activationCostFor(card)`
 * with no name always reads `card.activationCost`, which a `card.abilities`
 * -shaped card never sets, so `canActivateAbility` unconditionally rejected
 * with "has no such activated ability" for every one of its real abilities.
 *
 * `x` (optional, ENGINE_GAPS.md gap #11 — Rydia, Summoner of Mist's own
 * real "Summon — {X}, {T}: ..." activated ability) — the real value
 * announced for a `{X}` in this ability's own cost; the logged `activate`
 * entry's own `cost` reflects the REAL cost actually paid (`engine.ts`'s
 * `effectiveActivationCost` — resolved `{X}`, AND any real
 * `ActivationCostReduction` board-state-counted discount, Qiqirn Merchant's
 * own shape), not just the nominal printed ability-cost text — same "log
 * what genuinely happened" standard `pilotCast`'s own `cost` field already
 * holds to.
 */
export function pilotActivate(pilot: EnginePilot, controller: RealPlayer, permanent: RealCard, card: CardDefinition, ctx: EffectContext, actions: Actions, label?: string, abilityName?: string, crewedBy?: RealCard[], x?: number): void {
  pilot.beginStep(label ?? `Activate ${abilityName ? `"${abilityName}" on ` : ''}${card.name}`);
  const check = canActivateAbility(pilot.engine, controller, permanent, card, abilityName, crewedBy, x);
  if (!check.ok) throw new Error(`pilotActivate("${card.name}"): illegal — ${check.reason}`);
  const cost = activationCostFor(card, abilityName);
  const { costString } = effectiveActivationCost(pilot.engine, controller, card, abilityName, x);
  pilot.log.push({ fn: 'activate', card: card.name, instanceId: SELF_INSTANCE_ID, cost: costString || (cost ?? ''), ...(abilityName ? { ability: abilityName } : {}) });
  const requiresTap = !!cost && costRequiresTap(cost);
  // Real 702.13 Cycling's own "Discard this card" cost (ENGINE_GAPS.md gap
  // #23) — `activateAbility` pays this for real (a genuine Hand->Graveyard
  // move via `engine.state.move`) with NO log line of its own (`engine.ts`
  // is log-agnostic by design) — same root cause, same fix shape as this
  // function's own `requiresTap` self-tap fix just below.
  const requiresDiscardSelf = !!cost && costRequiresDiscardSelf(cost);
  const result = activateAbility(pilot.engine, controller, permanent, card, ctx, actions, abilityName, crewedBy, x);
  if (!result.ok) throw new Error(`pilotActivate("${card.name}"): ${result.reason}`);
  if (requiresTap) pilot.log.push({ fn: 'tap', target: permanent.name, id: permanent.id, controller: controller.name });
  if (requiresDiscardSelf) pilot.log.push({ fn: 'discard', target: permanent.name, id: permanent.id, controller: controller.name });
  // Real 702.121b Crew cost (ENGINE_GAPS.md's own "Crew (702.121b/c)" entry)
  // — `activateAbility` taps every real `crewedBy` creature as part of
  // paying the cost, with NO log line of its own (`engine.ts` is
  // log-agnostic by design) — same root cause, same fix shape as this
  // function's own `requiresTap` self-tap fix immediately above (a real,
  // visible state mutation was otherwise invisible to both the trace and
  // the replay UI).
  for (const creature of crewedBy ?? []) pilot.log.push({ fn: 'tap', target: creature.name, id: creature.id, controller: controller.name });
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
