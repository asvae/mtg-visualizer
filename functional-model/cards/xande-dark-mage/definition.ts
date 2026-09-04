import type { CardDefinition } from '../../card';

// Real script (xande_dark_mage.txt): "gets +1/+1 for each noncreature,
// nonland card in your graveyard" — a real layer-7a CDA, but a THIRD shape
// neither of `ptFormula`'s two built variants covers (not per-Equipment-
// controlled, not set-to-creature-count) — card.ts's own `ptFormula` doc
// comment states the boundary explicitly: "Anything else (a conditional
// CDA, a formula over a different subtype/count) stays staticAbilities
// text until a real card needs it." Kept as real text only, same treatment
// that doc comment already prescribes rather than inventing a new
// `ptFormula` variant in a shared file this batch has no write access to.
export const xandeDarkMage: CardDefinition = {
  name: 'Xande, Dark Mage',
  manaCost: '{2}{U}{B}',
  typeLine: 'Legendary Creature — Human Wizard',

  pt: [3, 3],
  keywords: ['Menace'],

  staticAbilities: ['Xande, Dark Mage gets +1/+1 for each noncreature, nonland card in your graveyard.'],
};
