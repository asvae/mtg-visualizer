import { describe, expect, it } from 'vitest';
import { GameState, effectiveTypes, effectivePT, wrapCard } from './state';

describe('GameState.move', () => {
  it('genuinely splices a card out of one zone and into another (same object, never copied)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Hand', { name: 'test-card' });
    expect(you.hand).toContain(card);
    state.move(card, 'Graveyard');
    expect(you.hand).not.toContain(card);
    expect(you.graveyard).toContain(card);
    expect(card.zone).toBe('Graveyard');
  });

  it('a token leaving the battlefield ceases to exist entirely (SCHEMA.md §3), never becomes graveyard stock', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const token = state.addCard(you, 'Battlefield', { name: 'Treasure', isTokenCard: true });
    state.move(token, 'Graveyard');
    expect(you.battlefield).not.toContain(token);
    expect(you.graveyard).not.toContain(token);
    expect(state.cards.has(token.id)).toBe(false);
  });

  it('a real (non-token) card leaving the battlefield does become graveyard stock', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const real = state.addCard(you, 'Battlefield', { name: 'real-permanent', isTokenCard: false });
    state.move(real, 'Graveyard');
    expect(you.graveyard).toContain(real);
    expect(state.cards.has(real.id)).toBe(true);
  });

  it('rule 400.7: counters, layer effects, control, and tapped status reset when a permanent changes zones', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const card = state.addCard(you, 'Battlefield', { name: 'permanent' });
    state.putCounter(card, '+1/+1', 2);
    state.pump(card, 3, 3);
    state.tap(card);
    state.gainControl(opp, card);
    expect(effectivePT(state, card)).toEqual([1 + 2 + 3, 1 + 2 + 3]);
    expect(card.tapped).toBe(true);
    expect(card.controllerId).toBe(opp.id);

    state.move(card, 'Exile');
    state.move(card, 'Battlefield');

    expect(effectivePT(state, card)).toEqual([1, 1]);
    expect(card.tapped).toBe(false);
    expect(card.controllerId).toBe(card.ownerId);
  });

  it('staying in the same zone (a no-op move) does not reset state', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Battlefield', { name: 'permanent' });
    state.putCounter(card, '+1/+1', 1);
    state.move(card, 'Battlefield');
    expect(card.counters['+1/+1']).toBe(1);
  });
});

describe('GameState.tap / untap', () => {
  it('tap and untap really persist on the object', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Battlefield', { name: 'creature' });
    expect(card.tapped).toBe(false);
    state.tap(card);
    expect(card.tapped).toBe(true);
    state.untap(card);
    expect(card.tapped).toBe(false);
  });
});

describe('GameState.createToken', () => {
  it('creates genuinely distinct objects, not shared references, for qty > 1', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const made = state.createToken(you, { name: 'Fish', manaCost: '0', types: ['Creature'], basePower: 1, baseToughness: 1 }, 2);
    expect(made).toHaveLength(2);
    expect(made[0]!.id).not.toBe(made[1]!.id);
    state.move(made[0]!, 'Graveyard');
    // Moving (and destroying, since it's a token) one token must not affect the other.
    expect(state.cards.has(made[1]!.id)).toBe(true);
  });
});

describe('effectiveTypes / wrapCard.isCreature via animate (layer 4)', () => {
  it('animate makes a noncreature permanent a real creature for every subsequent read, without mutating its printed types', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const vehicle = state.addCard(you, 'Battlefield', { name: 'Vehicle', types: ['Artifact'] });
    expect(effectiveTypes(vehicle)).toEqual(['Artifact']);
    state.animate(vehicle, ['Creature']);
    expect(effectiveTypes(vehicle)).toEqual(['Artifact', 'Creature']);
    // Printed types are untouched — only the layer computation changed.
    expect(vehicle.types).toEqual(['Artifact']);
    expect(wrapCard(state, vehicle).isCreature()).toBe(true);
  });
});
