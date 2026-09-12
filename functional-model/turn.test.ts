import { describe, expect, it } from 'vitest';
import { GameState } from './state';
import { startGame, currentPhase, activePlayer, advancePhase, queueExtraTurn, PHASES } from './turn';

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

  it('Cleanup discards the active player down to the default maximum hand size (514.1)', () => {
    const state = new GameState();
    const p1 = state.addPlayer('p1');
    const p2 = state.addPlayer('p2');
    for (let i = 0; i < 9; i++) state.addCard(p1, 'Hand', { name: `Card ${i}` });
    let turn = startGame();
    for (let i = 0; i < PHASES.length - 1; i++) turn = advancePhase(state, turn, [p1, p2]); // -> Cleanup
    expect(currentPhase(turn)).toBe('Cleanup');
    expect(p1.hand).toHaveLength(7);
  });

  it('does not discard a hand already at or under the maximum', () => {
    const state = new GameState();
    const p1 = state.addPlayer('p1');
    const p2 = state.addPlayer('p2');
    for (let i = 0; i < 3; i++) state.addCard(p1, 'Hand', { name: `Card ${i}` });
    let turn = startGame();
    for (let i = 0; i < PHASES.length - 1; i++) turn = advancePhase(state, turn, [p1, p2]); // -> Cleanup
    expect(p1.hand).toHaveLength(3);
  });

  it('Cleanup clears damage marked on every real card, game-wide (514.2)', () => {
    const state = new GameState();
    const p1 = state.addPlayer('p1');
    const p2 = state.addPlayer('p2');
    const mine = state.addCard(p1, 'Battlefield', { name: 'Mine', types: ['Creature'] });
    const theirs = state.addCard(p2, 'Battlefield', { name: 'Theirs', types: ['Creature'] });
    state.dealDamage(mine, 1);
    state.dealDamage(theirs, 1);
    let turn = startGame();
    for (let i = 0; i < PHASES.length - 1; i++) turn = advancePhase(state, turn, [p1, p2]); // -> Cleanup
    expect(mine.damageMarked).toBe(0);
    expect(theirs.damageMarked).toBe(0);
  });

  it('Cleanup ends "until end of turn" keyword grants, game-wide (514.2)', () => {
    // Regression: Dion, Bahamut's Dominant (fin/16) — Bahamut's own "Wings
    // of Light... gain flying until end of turn" chapter effect had been
    // wired to a bare, permanent `grantKeyword` (this pool's own default
    // for every keyword grant with no `untilEndOfTurn` flag), so its
    // Knight token kept showing Flying through the opponent's own
    // subsequent turns forever — never expiring, unlike the real card.
    const state = new GameState();
    const p1 = state.addPlayer('p1');
    const p2 = state.addPlayer('p2');
    const mine = state.addCard(p1, 'Battlefield', { name: 'Mine', types: ['Creature'] });
    const theirs = state.addCard(p2, 'Battlefield', { name: 'Theirs', types: ['Creature'] });
    state.grantKeyword(mine, 'Flying', { untilEndOfTurn: true });
    state.grantKeyword(theirs, 'Menace', { untilEndOfTurn: true });
    state.grantKeyword(mine, 'Vigilance'); // a real, permanent grant (no flag) is unaffected
    let turn = startGame();
    for (let i = 0; i < PHASES.length - 1; i++) turn = advancePhase(state, turn, [p1, p2]); // -> Cleanup
    expect(mine.keywords).not.toContain('Flying');
    expect(theirs.keywords).not.toContain('Menace');
    expect(mine.keywords).toContain('Vigilance');
  });

  it('a real attackedThisTurn flag (set the way engine.ts\'s declareAttackers does — ENGINE_GAPS.md gap #16) persists through the rest of the turn, then clears at Cleanup', () => {
    const state = new GameState();
    const p1 = state.addPlayer('p1');
    const p2 = state.addPlayer('p2');
    const attacker = state.addCard(p1, 'Battlefield', { name: 'Attacker', types: ['Creature'] });
    // Simulating exactly what engine.ts's own `declareAttackers` does at the
    // real Declare Attackers step (this file's own scope is state.ts/
    // turn.ts primitives, not engine.ts — same "call the state.ts primitive
    // directly" pattern the "until end of turn" keyword-grant test above
    // already uses for `state.grantKeyword`).
    attacker.attackedThisTurn = true;
    let turn = startGame();
    // Advance through the rest of THIS turn (Declare Attackers through
    // Main2/EndOfTurn) — the flag must stay real and set the whole way,
    // not just the instant it was declared.
    for (let i = 0; i < PHASES.length - 2; i++) {
      turn = advancePhase(state, turn, [p1, p2]);
      expect(attacker.attackedThisTurn).toBe(true);
    }
    expect(currentPhase(turn)).toBe('EndOfTurn');
    expect(attacker.attackedThisTurn).toBe(true);
    // Cleanup — the real, game-wide reset (`state.clearAttackedThisTurn`).
    turn = advancePhase(state, turn, [p1, p2]);
    expect(currentPhase(turn)).toBe('Cleanup');
    expect(attacker.attackedThisTurn).toBe(false);
  });

  it('attackedThisTurn does not persist into the next turn (real per-turn reset, not a one-time clear)', () => {
    const state = new GameState();
    const p1 = state.addPlayer('p1');
    const p2 = state.addPlayer('p2');
    const attacker = state.addCard(p1, 'Battlefield', { name: 'Attacker', types: ['Creature'] });
    let turn = startGame();
    for (let i = 0; i < PHASES.length; i++) turn = advancePhase(state, turn, [p1, p2]); // -> turn 2, real Cleanup already ran once
    expect(turn.turnNumber).toBe(2);
    expect(attacker.attackedThisTurn).toBeFalsy(); // never set this turn either — stays off, not left over from a stale true
    attacker.attackedThisTurn = true; // attacks again, turn 2
    for (let i = 0; i < PHASES.length; i++) turn = advancePhase(state, turn, [p1, p2]); // -> turn 3
    expect(turn.turnNumber).toBe(3);
    expect(attacker.attackedThisTurn).toBe(false); // real per-turn reset, not carried over
  });

  it('an extra turn queued for a player takes priority over the normal round-robin rotation (500.7)', () => {
    const state = new GameState();
    const p1 = state.addPlayer('p1');
    const p2 = state.addPlayer('p2');
    let turn = startGame();
    queueExtraTurn(turn, 0); // p1 takes an extra turn, even though p2 would normally go next
    for (let i = 0; i < PHASES.length; i++) turn = advancePhase(state, turn, [p1, p2]); // -> turn 2
    expect(turn.turnNumber).toBe(2);
    expect(activePlayer(turn, [p1, p2])).toBe(p1);
    expect(turn.extraTurns).toEqual([]); // consumed
  });

  it('multiple queued extra turns are consumed FIFO, one per turn-wrap', () => {
    const state = new GameState();
    const p1 = state.addPlayer('p1');
    const p2 = state.addPlayer('p2');
    let turn = startGame();
    queueExtraTurn(turn, 1); // p2 extra turn first
    queueExtraTurn(turn, 0); // then p1's extra turn
    for (let i = 0; i < PHASES.length; i++) turn = advancePhase(state, turn, [p1, p2]); // -> turn 2 (queued: p2)
    expect(activePlayer(turn, [p1, p2])).toBe(p2);
    for (let i = 0; i < PHASES.length; i++) turn = advancePhase(state, turn, [p1, p2]); // -> turn 3 (queued: p1)
    expect(activePlayer(turn, [p1, p2])).toBe(p1);
    for (let i = 0; i < PHASES.length; i++) turn = advancePhase(state, turn, [p1, p2]); // -> turn 4 (queue empty, normal rotation from p1 -> p2)
    expect(activePlayer(turn, [p1, p2])).toBe(p2);
  });
});
