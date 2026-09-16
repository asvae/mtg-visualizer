import type { CardDefinition } from '../../card';

// Real script (xande_dark_mage.txt): "gets +1/+1 for each noncreature,
// nonland card in your graveyard" — now real, executable
// `ptFormula.kind:'addPerGraveyardCount'` (2026-09-16, static-ability audit
// follow-up — see `card.ts`'s own doc comment for the real Forge citation).
export const xandeDarkMage: CardDefinition = {
  name: 'Xande, Dark Mage',
  manaCost: '{2}{U}{B}',
  typeLine: 'Legendary Creature — Human Wizard',

  pt: [3, 3],
  keywords: ['Menace'],

  staticAbilities: ['Xande, Dark Mage gets +1/+1 for each noncreature, nonland card in your graveyard.'],
  ptFormula: { kind: 'addPerGraveyardCount', power: 1, toughness: 1 },
};
