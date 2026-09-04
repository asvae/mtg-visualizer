import type { CardDefinition } from '../../card';

// Real script (goobbue_gardener.txt): a single mana ability, `AB$ Mana | Cost$ T | Produced$ G`.
// No Effect kind (nor any action in interfaces.ts) models mana production
// anywhere in this system — same real scope boundary Cooking Campsite's own
// land mana ability already documents (functional-model/cards/sidequest-
// catch-a-fish-cooking-campsite/definition.ts). Kept as text only, not flagged
// as a gap to fix.
export const goobbueGardener: CardDefinition = {
  name: 'Goobbue Gardener',
  manaCost: '{1}{G}',
  typeLine: 'Creature — Plant Beast',

  pt: [1, 3],

  staticAbilities: ['{T}: Add {G}.'],
};
