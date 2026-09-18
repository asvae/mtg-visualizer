import type { CardDefinition, Effect } from '../../card';

// Real oracle text (Scryfall: FDN 153, mana_cost {1}{U}):
// "Counter target creature spell."
//
// `kind:'counter'` (card.ts, interfaces.ts's own `counter` doc comment) is
// a log-only primitive with no fields to distinguish counter types or spell
// restrictions — it only carries a `describe` field for documentary text.
// This card's spell-type restriction ("creature spell" vs. any spell) cannot
// be mechanically expressed in the current vocabulary; it is captured only
// as descriptive text in `describe`.

const essenceScatterEffect: Effect = {
  kind: 'counter',
  describe: 'Counter target creature spell.',
};

export const essenceScatter: CardDefinition = {
  name: 'Essence Scatter',
  manaCost: '{1}{U}',
  typeLine: 'Instant',

  effects: [essenceScatterEffect],
};
