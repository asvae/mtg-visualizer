import { describe, expect, it } from 'vitest';
import { GameState } from './state';
import { startGame, currentPhase, activePlayer, advancePhase, PHASES } from './turn';

describe('turn/phase structure', () => {
  it('starts at Untap, turn 1, player 0', () => {
    const turn = startGame();
    expect(currentPhase(turn)).toBe('Untap');
    expect(turn.turnNumber).toBe(1);
    expect(turn.activePlayerIndex).toBe(0);
  });

  it('advances through every phase in the real fixed order', () => {
    const state = new GameState();
    const p1 = state.addPlayer('p1');
    const p2 = state.addPlayer('p2');
    let turn = startGame();
    const seen: string[] = [currentPhase(turn)];
    for (let i = 0; i < PHASES.length - 1; i++) {
      turn = advancePhase(state, turn, [p1, p2]);
      seen.push(currentPhase(turn));
    }
    expect(seen).toEqual([...PHASES]);
  });

  it('wraps to a new turn and the next active player after Cleanup', () => {
    const state = new GameState();
    const p1 = state.addPlayer('p1');
    const p2 = state.addPlayer('p2');
    let turn = startGame();
    for (let i = 0; i < PHASES.length; i++) turn = advancePhase(state, turn, [p1, p2]);
    expect(turn.turnNumber).toBe(2);
    expect(turn.activePlayerIndex).toBe(1);
    expect(currentPhase(turn)).toBe('Untap');
    expect(activePlayer(turn, [p1, p2])).toBe(p2);
  });

  it('Untap step actually untaps the active player’s tapped battlefield permanents', () => {
    // startGame() itself runs no entry action (nothing was "advanced into"
    // yet) — the untap action fires the first time Untap is genuinely
    // RE-ENTERED via advancePhase, i.e. after a full lap of all 12 phases.
    const state = new GameState();
    const p1 = state.addPlayer('p1');
    const creature = state.addCard(p1, 'Battlefield', { name: 'creature' });
    state.tap(creature);
    expect(creature.tapped).toBe(true);

    let turn = startGame();
    for (let i = 0; i < PHASES.length; i++) turn = advancePhase(state, turn, [p1]);
    expect(currentPhase(turn)).toBe('Untap');
    expect(creature.tapped).toBe(false);
  });

  it('skips the draw step on turn 1 for the player going first, 2-player game only', () => {
    const state = new GameState();
    const p1 = state.addPlayer('p1');
    const p2 = state.addPlayer('p2');
    const lib1 = state.addCard(p1, 'Library', { name: 'top-card' });
    let turn = startGame();
    turn = advancePhase(state, turn, [p1, p2]); // Upkeep
    turn = advancePhase(state, turn, [p1, p2]); // Draw
    expect(currentPhase(turn)).toBe('Draw');
    expect(p1.hand).not.toContain(lib1);
    expect(p1.library).toContain(lib1);
  });

  it('does NOT skip the draw step for the second player’s own first turn', () => {
    const state = new GameState();
    const p1 = state.addPlayer('p1');
    const p2 = state.addPlayer('p2');
    const lib2 = state.addCard(p2, 'Library', { name: 'top-card' });
    let turn = startGame();
    for (let i = 0; i < PHASES.length; i++) turn = advancePhase(state, turn, [p1, p2]); // -> turn 2, p2 active, Untap
    turn = advancePhase(state, turn, [p1, p2]); // Upkeep
    turn = advancePhase(state, turn, [p1, p2]); // Draw
    expect(p2.hand).toContain(lib2);
  });

  it('does NOT skip the draw step in a 3+ player game, even on turn 1', () => {
    const state = new GameState();
    const p1 = state.addPlayer('p1');
    const p2 = state.addPlayer('p2');
    const p3 = state.addPlayer('p3');
    const lib1 = state.addCard(p1, 'Library', { name: 'top-card' });
    let turn = startGame();
    turn = advancePhase(state, turn, [p1, p2, p3]); // Upkeep
    turn = advancePhase(state, turn, [p1, p2, p3]); // Draw
    expect(p1.hand).toContain(lib1);
  });

  it('combat steps are present and reachable in sequence (no damage assignment implemented)', () => {
    const state = new GameState();
    const p1 = state.addPlayer('p1');
    let turn = startGame();
    turn = advancePhase(state, turn, [p1]); // Upkeep
    turn = advancePhase(state, turn, [p1]); // Draw
    turn = advancePhase(state, turn, [p1]); // Main1
    turn = advancePhase(state, turn, [p1]); // CombatBegin
    expect(currentPhase(turn)).toBe('CombatBegin');
    turn = advancePhase(state, turn, [p1]);
    expect(currentPhase(turn)).toBe('CombatDeclareAttackers');
    turn = advancePhase(state, turn, [p1]);
    expect(currentPhase(turn)).toBe('CombatDeclareBlockers');
    turn = advancePhase(state, turn, [p1]);
    expect(currentPhase(turn)).toBe('CombatDamage');
    turn = advancePhase(state, turn, [p1]);
    expect(currentPhase(turn)).toBe('CombatEnd');
  });
});
