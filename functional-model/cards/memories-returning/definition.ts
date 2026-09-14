import type { CardDefinition, Effect } from '../../card';

export const memoriesReturning: CardDefinition = {
  name: 'Memories Returning',
  manaCost: '{2}{U}{U}',
  typeLine: 'Sorcery',

  // recognizer-exception: flashback-alternateCost-structural — this card's
  // own checked-in Scryfall oracle text (data/fin/fin_scryfall.json) prints
  // a genuinely bare "Flashback {7}{U}{U}" with NO reminder-text
  // parenthetical at all, unlike every other real Flashback card in this
  // pool (all 13 others print the full "(You may cast this card from your
  // graveyard for its flashback cost. Then exile it.)" explanation
  // verbatim) — a real, confirmed data divergence, not a recognizer bug; the
  // mechanic itself is unaffected (`alternateCosts` below is still real and
  // correct), only the TEXT this recognizer needs to anchor an annotation to
  // is missing from this specific card's own printed text. Its own real
  // `cast`/`Exile` facts stay hand-authored, anchored to the bare
  // "Flashback {7}{U}{U}" line instead (see synergy.json).
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
