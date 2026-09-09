// Simplified, real turn/phase structure — the real phase LIST and ORDER,
// verified against `../mtg-forge`'s actual
// `PhaseType` enum (forge-game/src/main/java/forge/game/phase/PhaseType.java
// lines 16-28) rather than guessed. Built on top of `state.ts`'s real
// mutable `GameState` so the two automatic actions implemented here
// (untap, draw) genuinely mutate real objects.
//
// Explicit scope, agreed in conversation ("we want all of these present,
// but we can simplify them"):
//   - Real phase list/order for all 12 real phases EXCEPT
//     `COMBAT_FIRST_STRIKE_DAMAGE` (a real 13th Forge phase, PhaseType.java
//     line 23 — only matters for first/double-strike creatures, out of
//     scope here).
//   - Untap (`Untap.java` ~line 86-90, `doUntap()`: untaps the active
//     player's own battlefield), Draw (`PhaseHandler.java` ~line 268-273:
//     `playerTurn.drawCard()`), and Cleanup (514.1's own discard-to-
//     maximum-hand-size, 514.2's own damage-clearing — NOT the "until end
//     of turn effects end" half, since `layers.ts`'s own duration-not-
//     tracked simplification is unchanged/accepted) are the automatic
//     actions modeled. Upkeep/end-step TRIGGER auto-firing (as opposed to
//     these automatic non-trigger actions) is `engine.ts`'s own job
//     (`fireOnPhaseEnterTriggers`, since it needs `resolveCard`/
//     `CardDefinition`, which this lower-level file deliberately doesn't
//     import).
//   - The real first-turn draw skip IS implemented (`PhaseHandler.java`
//     ~line 221-222: `case DRAW: return turn == 1 && players.size() == 2`
//     — a real, checkable rule, not invented).
//   - Combat's 5 steps (Begin/DeclareAttackers/DeclareBlockers/Damage/End)
//     are present and reachable; attacking/blocking/damage assignment is
//     `engine.ts`'s job (`declareAttackers`/`declareBlockers`/
//     `resolveCombatDamage`), not this file's.
//   - Real "take an extra turn" effects (`TurnState.extraTurns`, a FIFO
//     queue of player indices `advancePhase`'s own turn-wrap branch
//     consumes instead of blindly rotating) ARE modeled — a real, common
//     FIN card needs it (Ultimecia, Time Sorceress's own "take an extra
//     turn after this one"). Real "skip your next X step/phase" effects
//     are NOT modeled — no FIN card in this pool needs one today (checked).
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
  'CombatDamage',
  'CombatEnd',
  'Main2',
  'EndOfTurn',
  'Cleanup',
] as const;
export type Phase = (typeof PHASES)[number];

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
}

/** Real rule 103.8a-shaped skip: the FIRST active player's very FIRST draw step is skipped, 2-player games only (`PhaseHandler.java` ~line 221-222). Multiplayer/later turns always draw. */
function shouldSkipDraw(turn: TurnState, playerCount: number): boolean {
  return turn.turnNumber === 1 && turn.activePlayerIndex === 0 && playerCount === 2;
}

export function startGame(): TurnState {
  return { turnNumber: 1, activePlayerIndex: 0, phaseIndex: 0, extraTurns: [] };
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
    // 514.2's damage-clearing half only — NOT "until end of turn effects
    // end" (layers.ts's own duration-not-tracked simplification, unchanged).
    state.clearAllDamage();
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
  const next: TurnState =
    turn.phaseIndex + 1 < PHASES.length
      ? { ...turn, phaseIndex: turn.phaseIndex + 1 }
      : {
          turnNumber: turn.turnNumber + 1,
          activePlayerIndex: turn.extraTurns.length > 0 ? turn.extraTurns[0]! : (turn.activePlayerIndex + 1) % players.length,
          phaseIndex: 0,
          extraTurns: turn.extraTurns.length > 0 ? turn.extraTurns.slice(1) : turn.extraTurns,
        };
  runPhaseEntryAction(state, next, players);
  return next;
}
