import type { CardDefinition, Effect } from '../../card';

export const memoriesReturning: CardDefinition = {
  name: 'Memories Returning',
  manaCost: '{2}{U}{U}',
  typeLine: 'Sorcery',

  alternateCosts: [{ name: 'Flashback', cost: '{7}{U}{U}', from: 'graveyard', thenExile: true }],

  // Real 4-step DB$ Dig chain: reveal top 5, you take 1, opponent bottoms
  // 1, you take 1 more, opponent bottoms the last 1, you take the final
  // card — net zone outcome across the 5: 3 to your hand, 2 to the bottom
  // of your library. This model's `dig` (look at `qty`, take up to `take`
  // matching, REST to bottom) already has no player-choice engine anywhere
  // (see card.ts's own `optional` doc comments on other kinds) — a single
  // `dig(qty:5, take:3)` reproduces the exact same net zone change, just
  // without tracking WHICH player chose which of the 5 cards or the
  // alternating turn order the real card's own text spells out.
  effects: [{ kind: 'dig', qty: 5, take: 3 } satisfies Effect],
};
