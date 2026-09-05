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
//     player's own battlefield) and Draw (`PhaseHandler.java` ~line
//     268-273: `playerTurn.drawCard()`) are the only two phases with a
//     real, always-on automatic action modeled. Upkeep/end-step triggers,
//     cleanup's real discard-to-hand-size and "damage/until-end-of-turn
//     effects wear off" — none of that is implemented; those phases exist
//     and are reachable in sequence, with no automatic action.
//   - The real first-turn draw skip IS implemented (`PhaseHandler.java`
//     ~line 221-222: `case DRAW: return turn == 1 && players.size() == 2`
//     — a real, checkable rule, not invented).
//   - Combat's 5 steps (Begin/DeclareAttackers/DeclareBlockers/Damage/End)
//     are present and reachable, but attacking/blocking/damage assignment
//     is NOT implemented — passing through `CombatDamage` deals no damage.
//     A real, plainly-flagged gap, not silently faked.
//   - State-based actions, extra-turn/skip-phase effects, and multiplayer
//     turn order beyond simple round-robin are not modeled.

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
}

/** Real rule 103.8a-shaped skip: the FIRST active player's very FIRST draw step is skipped, 2-player games only (`PhaseHandler.java` ~line 221-222). Multiplayer/later turns always draw. */
function shouldSkipDraw(turn: TurnState, playerCount: number): boolean {
  return turn.turnNumber === 1 && turn.activePlayerIndex === 0 && playerCount === 2;
}

export function startGame(): TurnState {
  return { turnNumber: 1, activePlayerIndex: 0, phaseIndex: 0 };
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
 * real round-robin active-player rotation, not a full multiplayer turn
 * order with extra-turn effects. Runs the new phase's own automatic action
 * (see `runPhaseEntryAction`) as part of entering it, same as Forge's own
 * `PhaseHandler.handleBeginPhase` firing a phase's default action when it's
 * reached (`PhaseHandler.java` ~line 268 for Draw's own case).
 */
export function advancePhase(state: GameState, turn: TurnState, players: RealPlayer[]): TurnState {
  const next: TurnState =
    turn.phaseIndex + 1 < PHASES.length
      ? { ...turn, phaseIndex: turn.phaseIndex + 1 }
      : { turnNumber: turn.turnNumber + 1, activePlayerIndex: (turn.activePlayerIndex + 1) % players.length, phaseIndex: 0 };
  runPhaseEntryAction(state, next, players);
  return next;
}
