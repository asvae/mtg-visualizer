import { describe, expect, it } from 'vitest';
import { findInteractionsForCard, type EventFact, type Fact, type PoolCard } from './synergy';
import type { CardDefinition } from './card';

// Real matching proof for `EventFact.colors` (the `has`/`hasAny`/`not`
// color-SET shape added 2026-09-09 alongside `vector-imperial-capital`'s own
// single migrated mana fact) — a disposable fixture pool, not a real card in
// `cards/*`, since no FIN sink fact wants a specific color YET (see
// `EventFact.colors`'s own doc comment). Proves the matcher end-to-end via
// `findInteractionsForCard` (the same real entry point `find-synergies.mjs`
// calls), not just a hand-rolled call into a private helper.

function land(name: string): CardDefinition {
  return { name, manaCost: '', typeLine: 'Land' };
}

function poolCard(card: CardDefinition, source: Omit<Fact, 'role'>[], sink: Omit<Fact, 'role'>[]): PoolCard {
  return {
    name: card.name,
    card,
    source: source.map((f) => ({ ...f, role: 'source' }) as Fact),
    sink: sink.map((f) => ({ ...f, role: 'sink' }) as Fact),
  };
}

const dualLand = poolCard(
  land('Vector, Imperial Capital'),
  [{ id: 'mana-b-r', event: 'addMana', controller: 'you', colors: { hasAny: ['B', 'R'] }, value: 1 } satisfies Omit<EventFact, 'role'>],
  [],
);

describe('EventFact.colors — produce vs. want matching', () => {
  it('a want for one of the produced colors (hasAny) matches', () => {
    const wantsRed = poolCard(land('Wants Red'), [], [
      { id: 'want-r', event: 'addMana', controller: 'you', colors: { has: ['R'] }, value: 1 } satisfies Omit<EventFact, 'role'>,
    ]);
    const groups = findInteractionsForCard('Vector, Imperial Capital', [dualLand, wantsRed]);
    const manaGroup = groups.find((g) => g.direction === 'source' && (g.fact as EventFact).event === 'addMana');
    expect(manaGroup?.matches.map((m) => m.card)).toContain('Wants Red');
  });

  it('a want for a color NOT in the produced set does not match', () => {
    const wantsGreen = poolCard(land('Wants Green'), [], [
      { id: 'want-g', event: 'addMana', controller: 'you', colors: { has: ['G'] }, value: 1 } satisfies Omit<EventFact, 'role'>,
    ]);
    const groups = findInteractionsForCard('Vector, Imperial Capital', [dualLand, wantsGreen]);
    const manaGroup = groups.find((g) => g.direction === 'source' && (g.fact as EventFact).event === 'addMana');
    expect(manaGroup?.matches.map((m) => m.card) ?? []).not.toContain('Wants Green');
  });

  it('a want using hasAny (any of several acceptable colors) matches if the produced set overlaps', () => {
    const wantsWhiteOrBlack = poolCard(land('Wants White or Black'), [], [
      { id: 'want-w-b', event: 'addMana', controller: 'you', colors: { hasAny: ['W', 'B'] }, value: 1 } satisfies Omit<EventFact, 'role'>,
    ]);
    const groups = findInteractionsForCard('Vector, Imperial Capital', [dualLand, wantsWhiteOrBlack]);
    const manaGroup = groups.find((g) => g.direction === 'source' && (g.fact as EventFact).event === 'addMana');
    expect(manaGroup?.matches.map((m) => m.card)).toContain('Wants White or Black');
  });

  it('a want using not (excludes a color) fails to match a produce that makes it', () => {
    const wantsNonBlack = poolCard(land('Wants Non-Black'), [], [
      { id: 'want-not-b', event: 'addMana', controller: 'you', colors: { not: ['B'] }, value: 1 } satisfies Omit<EventFact, 'role'>,
    ]);
    const groups = findInteractionsForCard('Vector, Imperial Capital', [dualLand, wantsNonBlack]);
    const manaGroup = groups.find((g) => g.direction === 'source' && (g.fact as EventFact).event === 'addMana');
    expect(manaGroup?.matches.map((m) => m.card) ?? []).not.toContain('Wants Non-Black');
  });

  it('a legacy single-color `color` produce still matches a new `colors`-shaped want (backward compat)', () => {
    const singleGreen = poolCard(land('Single Green Source'), [
      { id: 'mana-g', event: 'addMana', controller: 'you', color: 'G', value: 1 } satisfies Omit<EventFact, 'role'>,
    ], []);
    const wantsGreen = poolCard(land('Wants Green Via New Shape'), [], [
      { id: 'want-g', event: 'addMana', controller: 'you', colors: { has: ['G'] }, value: 1 } satisfies Omit<EventFact, 'role'>,
    ]);
    const groups = findInteractionsForCard('Single Green Source', [singleGreen, wantsGreen]);
    const manaGroup = groups.find((g) => g.direction === 'source' && (g.fact as EventFact).event === 'addMana');
    expect(manaGroup?.matches.map((m) => m.card)).toContain('Wants Green Via New Shape');
  });
});
