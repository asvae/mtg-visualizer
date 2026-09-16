import type { CardDefinition } from '../../card';

export const scorpionSentinel: CardDefinition = {
  name: 'Scorpion Sentinel',
  manaCost: '{1}{U}',
  typeLine: 'Artifact Creature — Robot Scorpion',

  pt: [1, 4],

  // Real Forge threshold-CDA ("As long as you control seven or more
  // lands, this creature gets +3/+0") — same real `card.ts`
  // `ptFormula.kind:'thresholdBonus'` mechanism closed 2026-09-15 (fin/16-25
  // pass) for Gaelicat/Magitek Infantry's own artifact-count threshold,
  // generalized here to the LAND-count shape (see that field's own doc
  // comment).
  ptFormula: { kind: 'thresholdBonus', power: 3, toughness: 0, condition: { type: 'Land', min: 7 } },
};
