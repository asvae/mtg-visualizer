import type { CardDefinition, Effect } from '../../card';

export const resentfulRevelation: CardDefinition = {
  name: 'Resentful Revelation',
  manaCost: '{1}{B}',
  typeLine: 'Sorcery',

  // "Look at the top three cards of your library. Put one of them into your
  // hand and the rest into your graveyard." No single Effect kind carries
  // "look at N, one destination for the chosen card, a DIFFERENT
  // destination for the rest" (dig's own rest-destination is always the
  // library bottom, not the graveyard — see card.ts's own `dig` doc
  // comment). Composed instead from two plain `move`s against the same
  // library, in order: the first (targeted, qty 1) takes the real top card
  // to hand — this model's chooseTarget always takes the first pool
  // candidate anyway (no real player-choice engine), so "look at 3, choose
  // one" already collapses to "the top card" here, same simplification
  // exile/counter targeting takes throughout this codebase. The library has
  // then genuinely shrunk by one real card (state.ts's own move()), so the
  // second (untargeted, qty 2) batch move picks up exactly the next two —
  // originally the 2nd/3rd of the "top three" — to the graveyard. Net real
  // board state after both matches Forge's own `DigNum$3 | ChangeNum$1 |
  // DestinationZone2$Graveyard` exactly.
  effects: [
    { kind: 'move', owner: 'you', from: 'Library', to: 'Hand', qty: 1, target: true } satisfies Effect,
    { kind: 'move', owner: 'you', from: 'Library', to: 'Graveyard', qty: 2 } satisfies Effect,
  ],

  alternateCosts: [{ name: 'Flashback', cost: '{6}{B}', from: 'graveyard', thenExile: true }],
};
