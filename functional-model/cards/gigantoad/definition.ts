import type { CardDefinition } from '../../card';

export const gigantoad: CardDefinition = {
  name: 'Gigantoad',
  manaCost: '{3}{G}',
  typeLine: 'Creature — Frog',

  pt: [4, 4],

  // "As long as you control seven or more lands, this creature gets
  // +2/+2" — a conditional continuous P/T buff keyed off LAND COUNT, not
  // Equipment-count or creature-count (the only two live `ptFormula` shapes
  // built so far — see card.ts's own doc comment). Kept as real text, same
  // treatment scorpion-sentinel's own identical land-count buff already
  // gets rather than forcing a third `ptFormula` variant for one card.
  staticAbilities: ['As long as you control seven or more lands, this creature gets +2/+2.'],
};
