import type { CardDefinition } from '../../card';

export const gigantoad: CardDefinition = {
  name: 'Gigantoad',
  manaCost: '{3}{G}',
  typeLine: 'Creature — Frog',

  pt: [4, 4],

  // Real Forge threshold-CDA ("As long as you control seven or more
  // lands, this creature gets +2/+2") — same real `card.ts`
  // `ptFormula.kind:'thresholdBonus'` mechanism scorpion-sentinel's own
  // identical land-count buff now uses (closed 2026-09-15, fin/16-25 pass).
  ptFormula: { kind: 'thresholdBonus', power: 2, toughness: 2, condition: { type: 'Land', min: 7 } },
};
