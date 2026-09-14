// Simplified, real turn/phase structure — the real phase LIST and ORDER,
// verified against `../mtg-forge`'s actual
// `PhaseType` enum (forge-game/src/main/java/forge/game/phase/PhaseType.java
// lines 16-28) rather than guessed. Built on top of `state.ts`'s real
// mutable `GameState` so the two automatic actions implemented here
// (untap, draw) genuinely mutate real objects.
//
// Explicit scope, agreed in conversation ("we want all of these present,
// but we can simplify them"):
//   - Real phase list/order for all 13 real phases, INCLUDING
//     `COMBAT_FIRST_STRIKE_DAMAGE` (PhaseType.java line 23,
//     ENGINE_GAPS.md gap #9, closed 2026-09-12) — `PHASES` below is a
//     structural, unconditional mirror of the real `PhaseType` enum (13
//     entries, `COMBAT_FIRST_STRIKE_DAMAGE` between
//     `COMBAT_DECLARE_BLOCKERS` and `COMBAT_DAMAGE`, exactly Forge's own
//     order). This file's own `advancePhase` below ALWAYS walks through
//     every one of these 13 phases in order — same as real Forge's
//     `PhaseType` itself, which has no notion of "skip an index." The
//     REAL conditionality (510.4/510.5: this step only matters when a
//     creature in combat has First/Double Strike) is deliberately NOT
//     this file's job to decide — it needs `engine.ts`'s own
//     `attackers`/`blockers` combat state (this file has none, by design,
//     same reason `resolveCombatDamage` itself lives in `engine.ts` — see
//     below). `engine.ts`'s own `doAdvance` is the real equivalent of
//     Forge's `PhaseHandler.isSkippingPhase`/`onPhaseBegin`
//     (PhaseHandler.java lines 219-238, 321-332): it auto-advances PAST
//     this phase (never presenting it to a caller at all) whenever no
//     attacker or blocker this combat has First/Double Strike — Forge's
//     own real behavior is slightly different in mechanism (it always
//     transitions through the phase but gives no priority and assigns no
//     damage, `combat.assignCombatDamage(true)` returning false,
//     `Combat.java` ~line 918-926) but identical in what a player actually
//     OBSERVES: the step might as well not have happened.
//   - Untap (`Untap.java` ~line 86-90, `doUntap()`: untaps the active
//     player's own battlefield), Draw (`PhaseHandler.java` ~line 268-273:
//     `playerTurn.drawCard()`), and Cleanup (514.1's own discard-to-
//     maximum-hand-size, 514.2's own damage-clearing, PLUS 514.2's "until
//     end of turn" half for any `grantKeyword` OR `pump` call that opted
//     into real tracking via `opts.untilEndOfTurn` — `grantKeyword`'s own
//     added 2026-09-12 (`state.ts`'s `clearUntilEndOfTurnKeywordGrants`),
//     `pump`'s own added 2026-09-14 (`state.ts`'s `clearUntilEndOfTurnPumps`
//     + `layers.ts`'s new `LayerSet.remove`); `layers.ts`'s own BROADER
//     duration-not-tracked simplification, covering every other "until end
//     of turn" effect shape (type-change/etc.) with no opt-in flag of its
//     own, is otherwise unchanged/accepted, PLUS real per-turn trigger
//     `ActivationLimit$ N` tracking (`state.ts`'s own
//     `resetTriggerActivationsThisTurn`, added 2026-09-14 — `card.ts`'s own
//     `Trigger.activationLimit` doc comment for the real Forge citation),
//     PLUS 508.1's own "attacked this turn" reset (`state.ts`'s own
//     `clearAttackedThisTurn`, added 2026-09-12, ENGINE_GAPS.md gap #16 —
//     The Lunar Whale's own "as long as it attacked this turn" needs this)
//     are the automatic actions modeled. Upkeep/end-step TRIGGER auto-firing
//     (as opposed to these automatic non-trigger actions) is `engine.ts`'s own job
//     (`fireOnPhaseEnterTriggers`, since it needs `resolveCard`/
//     `CardDefinition`, which this lower-level file deliberately doesn't
//     import).
//   - The real first-turn draw skip IS implemented (`PhaseHandler.java`
//     ~line 221-222: `case DRAW: return turn == 1 && players.size() == 2`
//     — a real, checkable rule, not invented).
//   - Combat's 6 steps (Begin/DeclareAttackers/DeclareBlockers/
//     FirstStrikeDamage/Damage/End) are present and reachable; attacking/
//     blocking/damage assignment (and, per above, the FirstStrikeDamage
//     step's own real conditionality) is `engine.ts`'s job
//     (`declareAttackers`/`declareBlockers`/
//     `resolveFirstStrikeCombatDamage`/`resolveCombatDamage`), not this
//     file's.
//   - Real "take an extra turn" effects (`TurnState.extraTurns`, a FIFO
//     queue of player indices `advancePhase`'s own turn-wrap branch
//     consumes instead of blindly rotating) ARE modeled — a real, common
//     FIN card needs it (Ultimecia, Time Sorceress's own "take an extra
//     turn after this one"). Real "skip your next X step/phase" effects
//     are NOT modeled — no FIN card in this pool needs one today (checked).
//   - Real "insert one more occurrence of a phase GROUP into the CURRENT
//     turn" (ENGINE_GAPS.md gap #17, closed 2026-09-12) IS modeled —
//     `TurnState.queuedExtraPhases`/`phaseGroupEntryCount`, see their own
//     doc comments below. Genuinely distinct from `extraTurns` above: this
//     repeats/inserts ONE step-group (End of Turn, or a whole Combat
//     sequence) within the SAME turn, never a fresh Untap/Upkeep/Draw/etc.
//     Real Forge citation: `AddPhaseEffect.java` (forge-game/.../ability/
//     effects/AddPhaseEffect.java) resolves `DB$ AddPhase` by pushing onto
//     `PhaseHandler.extraPhases: Map<PhaseType, Stack<ExtraPhase>>`
//     (`PhaseHandler.java` line 74) keyed by the real `AfterPhase$` —
//     `PhaseHandler.advanceToNextPhase` (`PhaseHandler.java` lines 156-174)
//     checks that map FIRST, before its own normal `PhaseType.getNext`,
//     the moment the CURRENT phase is about to end, and pops (LIFO) an
//     `ExtraPhase` to visit instead. `PhaseType.PHASE_GROUPS` (`PhaseType.java`
//     lines 30-37) is the real grouping this mirrors: index 2
//     (`COMBAT_BEGIN`..`COMBAT_END`, 6 steps) for Balthier and Fran/Genji
//     Glove's own "additional combat phase," index 4 (`END_OF_TURN` alone)
//     for Y'shtola Rhul's own "additional end step." `nCombatsThisTurn`/
//     `nEndOfTurnsThisTurn` (`PhaseHandler.java` lines 76-80, incremented at
//     lines 299/362 the moment each group's own FIRST step is entered) are
//     the real per-turn counters `isFirstCombat()`/`Count$
//     FinishedEndOfTurnsThisTurn` (`AbilityUtils.java` lines 2204-2207) read
//     to gate "if it's the FIRST end step/combat phase of the turn" —
//     mirrored here as `phaseGroupEntryCount`.
//   - State-based actions and multiplayer turn order beyond simple
//     round-robin are not modeled here (SBAs: `sba.ts`, a separate file).

import type { GameState, RealPlayer } from './state';

export const PHASES = [
  'Untap',
  'Upkeep',
  'Draw',
  'Main1',
  'CombatBegin',
  'CombatDeclareAttackers',
  'CombatDeclareBlockers',
  // Real 13th Forge phase (PhaseType.java line 23, ENGINE_GAPS.md gap #9) —
  // see this file's own header for why its real CONDITIONALITY (only
  // matters when First/Double Strike is in combat) lives in `engine.ts`,
  // not here.
  'CombatFirstStrikeDamage',
  'CombatDamage',
  'CombatEnd',
  'Main2',
  'EndOfTurn',
  'Cleanup',
] as const;
export type Phase = (typeof PHASES)[number];

/**
 * Real `PhaseType.PHASE_GROUPS` (`PhaseType.java` lines 30-37) entries this
 * engine's own cards actually need to repeat/insert — `EndOfTurn` (index 4,
 * a lone step) for Y'shtola Rhul's own "additional end step," `Combat`
 * (index 2, all 6 combat steps) for Balthier and Fran/Genji Glove's own
 * "additional combat phase." Forge's own `AddPhaseEffect` also supports a
 * `Beginning` group (index 0, Untap/Upkeep/Draw) — no real FIN card needs
 * it, so it's not represented here (see ENGINE_GAPS.md gap #17's own
 * closure writeup).
 */
export type PhaseGroup = 'EndOfTurn' | 'Combat';

/** The real first step of each `PhaseGroup` — where `advancePhase` jumps `phaseIndex` back to when a queued extra occurrence of that group is consumed. */
const PHASE_GROUP_START: Record<PhaseGroup, number> = {
  EndOfTurn: PHASES.indexOf('EndOfTurn'),
  Combat: PHASES.indexOf('CombatBegin'),
};

/** The real LAST step of each `PhaseGroup` — the phase index `advancePhase` checks `queuedExtraPhases` against (mirrors Forge's own `extraPhases` map being keyed by "the phase that's ending," `PhaseHandler.java` line 162: `if (extraPhases.containsKey(phase))`, checked at the moment THAT phase is about to end). */
const PHASE_GROUP_END: Record<PhaseGroup, number> = {
  EndOfTurn: PHASES.indexOf('EndOfTurn'),
  Combat: PHASES.indexOf('CombatEnd'),
};

export interface TurnState {
  turnNumber: number;
  activePlayerIndex: number;
  phaseIndex: number;
  /**
   * Real "take an extra turn" effects (Time Walk-shaped; Ultimecia, Time
   * Sorceress's own "take an extra turn after this one" is the real FIN
   * card that needs this) queue a player index here — FIFO, real 500.7's
   * own "if effects have created a series of extra turns, that series is
   * next... a series of turns is worked through in the order it was
   * created." `advancePhase`'s own turn-wrap branch (Cleanup -> next
   * Untap) dequeues from here INSTEAD OF blindly rotating
   * `(activePlayerIndex + 1) % players.length` whenever this is
   * non-empty. Empty in the common case (every existing scenario/test).
   */
  extraTurns: number[];
  /**
   * Real "insert one more occurrence of THIS phase group before the turn
   * moves on" (500-series turn structure, ENGINE_GAPS.md gap #17, closed
   * 2026-09-12) — structurally distinct from `extraTurns` above (a whole
   * EXTRA TURN, next player's Untap onward): this re-enters the SAME
   * group's own first step, same turn, same active player, no Untap/
   * Upkeep/Draw in between (Combat's own 6 sub-steps DO all repeat when
   * `'Combat'` is queued — CR 500.1's own real special case for "an
   * additional combat phase" — but Untap/Upkeep/Draw never do).
   * `advancePhase`'s own group-boundary check (mirroring real Forge's
   * `PhaseHandler.extraPhases`, `PhaseHandler.java` line 74, a
   * `Map<PhaseType, Stack<ExtraPhase>>` keyed by "the phase that's ending")
   * consumes ONE entry matching the group whose LAST step is currently
   * ending, dequeuing it (FIFO here; real Forge's own equivalent is a
   * per-key LIFO `Stack`, but no FIN card in this pool ever queues more
   * than one at a time, so the two are observably identical). A card's own
   * effect pushes via `queueExtraPhase` (below) when its trigger resolves.
   */
  queuedExtraPhases: PhaseGroup[];
  /**
   * Real per-turn "how many times has this phase GROUP been entered so far
   * THIS turn" — the general primitive behind Forge's own
   * `nCombatsThisTurn`/`nEndOfTurnsThisTurn` counters (`PhaseHandler.java`
   * lines 76-80, incremented the moment each group's own first step is
   * entered — lines 299/362) and the `isFirstCombat()`/`Count$
   * FinishedEndOfTurnsThisTurn` reads (`PhaseHandler.java` line 969-971;
   * `AbilityUtils.java` lines 2204-2207) real card scripts gate "if it's
   * the FIRST end step/combat phase of the turn" on — Y'shtola Rhul's own
   * "if it's the first end step of the turn," Balthier and Fran/Genji
   * Glove's own "if it's the first combat phase of the turn." Reset to
   * `{}` at each new turn (see `advancePhase`'s turn-wrap branch);
   * incremented by `runPhaseEntryAction` the instant a group's own first
   * step is entered — read via `isFirstPhaseGroupOccurrenceThisTurn`
   * below, count `=== 1` meaning "this is the first entry this turn,"
   * matching Forge's own `nCombatsThisTurn == 1`/`FinishedEndOfTurnsThisTurn
   * < 1` shape exactly (a 1-based "entered" count vs. a 0-based "already
   * finished" count are the same real fact, read from either side).
   */
  phaseGroupEntryCount: Partial<Record<PhaseGroup, number>>;
}

/** Which `PhaseGroup`, if any, `phaseIndex` is the FIRST step of — used by `runPhaseEntryAction` to know when to bump `phaseGroupEntryCount`. */
function phaseGroupStartingAt(phaseIndex: number): PhaseGroup | undefined {
  return (Object.keys(PHASE_GROUP_START) as PhaseGroup[]).find((g) => PHASE_GROUP_START[g] === phaseIndex);
}

/** Which `PhaseGroup`, if any, `phaseIndex` is the LAST step of — used by `advancePhase` to know when to check `queuedExtraPhases`. */
function phaseGroupEndingAt(phaseIndex: number): PhaseGroup | undefined {
  return (Object.keys(PHASE_GROUP_END) as PhaseGroup[]).find((g) => PHASE_GROUP_END[g] === phaseIndex);
}

/** Real "if it's the FIRST end step/combat phase of the turn" (see `TurnState.phaseGroupEntryCount`'s own doc comment) — `true` only the FIRST time `group` is entered this turn. Callers read this (via `EffectContext.firstPhaseGroupOccurrenceThisTurn`, engine.ts) to decide whether to call `queueExtraPhase`. */
export function isFirstPhaseGroupOccurrenceThisTurn(turn: TurnState, group: PhaseGroup): boolean {
  return (turn.phaseGroupEntryCount[group] ?? 0) === 1;
}

/** Queues one more occurrence of `group` to be inserted the moment the group currently ending finishes (500-series, ENGINE_GAPS.md gap #17) — see `TurnState.queuedExtraPhases`'s own doc comment. */
export function queueExtraPhase(turn: TurnState, group: PhaseGroup): void {
  turn.queuedExtraPhases.push(group);
}

/** Real rule 103.8a-shaped skip: the FIRST active player's very FIRST draw step is skipped, 2-player games only (`PhaseHandler.java` ~line 221-222). Multiplayer/later turns always draw. */
function shouldSkipDraw(turn: TurnState, playerCount: number): boolean {
  return turn.turnNumber === 1 && turn.activePlayerIndex === 0 && playerCount === 2;
}

export function startGame(): TurnState {
  return { turnNumber: 1, activePlayerIndex: 0, phaseIndex: 0, extraTurns: [], queuedExtraPhases: [], phaseGroupEntryCount: {} };
}

/** Queues `playerIndex` to take the NEXT turn once the current one's Cleanup ends, ahead of the normal round-robin rotation (500.7) — see `TurnState.extraTurns`'s own doc comment. Multiple queued extra turns are consumed FIFO, one per turn-wrap. */
export function queueExtraTurn(turn: TurnState, playerIndex: number): void {
  turn.extraTurns.push(playerIndex);
}

export function currentPhase(turn: TurnState): Phase {
  return PHASES[turn.phaseIndex]!;
}

export function activePlayer(turn: TurnState, players: RealPlayer[]): RealPlayer {
  return players[turn.activePlayerIndex % players.length]!;
}

/** The real automatic action for the phase THIS turn state is currently in — call once, right after entering it (see `advancePhase` below). */
function runPhaseEntryAction(state: GameState, turn: TurnState, players: RealPlayer[]): void {
  const phase = currentPhase(turn);
  const active = activePlayer(turn, players);
  if (phase === 'Untap') {
    for (const card of active.battlefield) state.untap(card);
  } else if (phase === 'Draw') {
    if (!shouldSkipDraw(turn, players.length)) state.drawCards(active, 1);
  } else if (phase === 'Cleanup') {
    // 514.1: discard down to the real default maximum hand size (7) — no
    // FIN card in this pool modifies max hand size (checked), so a fixed
    // default is used rather than a tracked, possibly-modified value.
    // `state.discard`'s own doc comment already notes its "front of hand"
    // simplification (real Forge lets the player choose).
    if (active.hand.length > 7) state.discard(active, active.hand.length - 7);
    // 514.2's damage-clearing half, plus the real "until end of turn"
    // keyword-grant half for any grant that opted into tracking
    // (`state.ts`'s own `grantKeyword` `opts.untilEndOfTurn`/
    // `clearUntilEndOfTurnKeywordGrants`) — `layers.ts`'s own broader
    // duration-not-tracked simplification (pump/type-change/etc. effects
    // with no "until end of turn" flag at all) is otherwise unchanged.
    state.clearAllDamage();
    state.clearUntilEndOfTurnKeywordGrants();
    // Real 514.2's "until end of turn" half for a `pump` grant (`state.ts`'s
    // own `pump`/`clearUntilEndOfTurnPumps` doc comments) — same real,
    // game-wide, once-per-Cleanup scope as the keyword-grant clear just
    // above.
    state.clearUntilEndOfTurnPumps();
    // Real per-turn coin-flip tracking reset (ENGINE_GAPS.md gap #15,
    // `state.ts`'s own `flippedCoinThisTurn`/`flipCoin` doc comments for the
    // real Forge citation) — game-wide (any player, not just the active
    // one), same scope `clearAllDamage`/`clearUntilEndOfTurnKeywordGrants`
    // already use.
    state.resetFlippedCoinThisTurn();
    // Real per-turn trigger `ActivationLimit$ N` reset (`card.ts`'s own
    // `Trigger.activationLimit` doc comment for the full Forge citation:
    // `Game.onCleanupPhase` -> `Card.resetActivationsPerTurn`, `Game.java`
    // ~line 1227-1229) — same "real, game-wide, once per Cleanup" shape as
    // the coin-flip reset just above.
    state.resetTriggerActivationsThisTurn();
    // Real 508.1 "attacked this turn" reset (ENGINE_GAPS.md gap #16,
    // `state.ts`'s own `clearAttackedThisTurn` doc comment for the real
    // Forge citation) — same "real, game-wide, once per Cleanup" shape as
    // the two calls just above.
    state.clearAttackedThisTurn();
    // Real 305.1's own per-turn land-drop counter reset (`Player.onCleanupPhase`'s
    // own `resetLandsPlayedThisTurn()` call, `Player.java` ~line 2473) — only
    // the ACTIVE player's own count, same "only the active player's own
    // Cleanup actions are modeled" scope this file's own header already
    // established for 514.1's discard (no FIN card plays a land outside its
    // own controller's turn, so a non-active player's count can never be
    // nonzero here anyway).
    active.landsPlayedThisTurn = 0;
  }
  // Real 603.4 delayed-trigger firing: whatever was scheduled for THIS phase
  // (`state.scheduleDelayedTrigger`, see state.ts) fires now, once, then is
  // gone — not a repeating hook re-armed every time this phase is reached
  // again (a later turn's own Cleanup, e.g. runs whatever's due THEN, not
  // this same entry again).
  const due = state.delayedTriggers.filter((t) => t.phase === phase);
  if (due.length) {
    state.delayedTriggers = state.delayedTriggers.filter((t) => t.phase !== phase);
    for (const t of due) t.run();
  }
}

/**
 * Moves to the next phase in the real fixed order, wrapping to a new turn
 * (next player, `Untap` again, turn number incremented) after `Cleanup` —
 * real round-robin active-player rotation, UNLESS `turn.extraTurns` has a
 * queued player index (500.7 — an extra turn takes priority over the
 * normal rotation; see `TurnState.extraTurns`'s own doc comment), in which
 * case that player goes next instead and is dequeued. Runs the new phase's
 * own automatic action (see `runPhaseEntryAction`) as part of entering it,
 * same as Forge's own `PhaseHandler.handleBeginPhase` firing a phase's
 * default action when it's reached (`PhaseHandler.java` ~line 268 for
 * Draw's own case).
 */
export function advancePhase(state: GameState, turn: TurnState, players: RealPlayer[]): TurnState {
  // Real Forge order (`PhaseHandler.advanceToNextPhase`, `PhaseHandler.java`
  // lines 156-174): a queued extra occurrence of the group that's ABOUT TO
  // END is checked FIRST, before the ordinary next-index/turn-wrap logic —
  // see `TurnState.queuedExtraPhases`'s own doc comment.
  const endingGroup = phaseGroupEndingAt(turn.phaseIndex);
  const queuedIdx = endingGroup ? turn.queuedExtraPhases.indexOf(endingGroup) : -1;
  let next: TurnState;
  if (queuedIdx !== -1) {
    next = {
      ...turn,
      phaseIndex: PHASE_GROUP_START[endingGroup!],
      queuedExtraPhases: [...turn.queuedExtraPhases.slice(0, queuedIdx), ...turn.queuedExtraPhases.slice(queuedIdx + 1)],
      phaseGroupEntryCount: { ...turn.phaseGroupEntryCount },
    };
  } else if (turn.phaseIndex + 1 < PHASES.length) {
    next = { ...turn, phaseIndex: turn.phaseIndex + 1, phaseGroupEntryCount: { ...turn.phaseGroupEntryCount } };
  } else {
    next = {
      turnNumber: turn.turnNumber + 1,
      activePlayerIndex: turn.extraTurns.length > 0 ? turn.extraTurns[0]! : (turn.activePlayerIndex + 1) % players.length,
      phaseIndex: 0,
      extraTurns: turn.extraTurns.length > 0 ? turn.extraTurns.slice(1) : turn.extraTurns,
      // Real `extraPhases.clear()` on turn-wrap (`PhaseHandler.java` line
      // 178/1239) — any still-queued extra phase or per-group entry count
      // doesn't carry into a new turn.
      queuedExtraPhases: [],
      phaseGroupEntryCount: {},
    };
  }
  // Real `nCombatsThisTurn++`/`nEndOfTurnsThisTurn++` (`PhaseHandler.java`
  // lines 299/362) — bumped the instant a group's own FIRST step is
  // entered, whether this is the group's ordinary occurrence or a queued
  // extra one (Forge's own counter doesn't distinguish either).
  const enteringGroup = phaseGroupStartingAt(next.phaseIndex);
  if (enteringGroup) next.phaseGroupEntryCount[enteringGroup] = (next.phaseGroupEntryCount[enteringGroup] ?? 0) + 1;
  runPhaseEntryAction(state, next, players);
  return next;
}
