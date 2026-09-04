// Simplified priority — real priority means simulating WHEN a player
// chooses to respond; since this prototype has no AI/interactive player,
// it's modeled as scenario-scriptable instead: a round of priority is a
// list of scripted choices (pass, or push something onto the stack), one
// per player, in real APNAP order (active player first, then each other
// player in turn order) — verified against `../mtg-forge`'s actual
// priority-cycling logic in
// forge-game/src/main/java/forge/game/phase/PhaseHandler.java:
// `getPriorityPlayer()` (~line 135), `getNextPlayerAfter(...)` used to
// cycle it (~line 1119), `setHasPriority` marking whoever currently holds
// it (~line 1158).
//
// This is the mechanism that makes turn.ts (phase advance) and stack.ts
// (LIFO resolution) actually chain into real sequences: "cast X, then in
// response cast Y, Y resolves first, then X resolves, then the phase
// advances" falls out of calling `runPriorityRound` repeatedly with
// different scripted choices each round, not from any special-cased logic
// here.
//
// Explicit scope: no AI, no real "does a player want to respond" decision
// — every round's choices are supplied by the caller (a scenario script).
// A real player/AI decision process is out of scope, same as everywhere
// else in this prototype.

import type { Stack, StackObject } from './stack';

export type PriorityChoice = { pass: true } | { push: StackObject };
export type PriorityOutcome = 'resolve-stack' | 'advance-phase' | 'pushed';

/**
 * Runs ONE round of priority in APNAP order — `choices[i]` is the i-th
 * player in that order's own scripted decision. The moment anyone in the
 * round pushes something, the round ends immediately (real rule: any
 * action returns priority to the active player for a FRESH round —
 * 117.3c) and this returns `'pushed'` without looking at remaining
 * choices; the caller scripts the next round separately rather than this
 * function looping on its own (keeps "scripted, not simulated" honest).
 * If everyone passes: `'resolve-stack'` when something's pending,
 * `'advance-phase'` when the stack is empty and the game should move on
 * (117.4 — all players passing in succession).
 */
export function runPriorityRound(stack: Stack, choices: PriorityChoice[]): PriorityOutcome {
  for (const choice of choices) {
    if ('push' in choice) {
      stack.push(choice.push);
      return 'pushed';
    }
  }
  return stack.isEmpty() ? 'advance-phase' : 'resolve-stack';
}
