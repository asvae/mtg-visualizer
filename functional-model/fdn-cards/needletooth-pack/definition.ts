import type { CardDefinition } from '../../card';

// Real Forge (needletooth_pack.txt): `T:Mode$ Phase | Phase$ End of Turn |
// CheckSVar$ Morbid | ... | SVar:Morbid:Count$Morbid.1.0` — same genuine
// Morbid capacity gap `slumbering-cerberus`/`cackling-prowler`/
// `tragic-banshee` already document (no "did a creature die this turn"
// tracking anywhere in this engine).
export const needletoothPack: CardDefinition = {
  name: 'Needletooth Pack',
  manaCost: '{3}{G}{G}',
  typeLine: 'Creature — Dinosaur',
  pt: [4, 5],

  missingSchemaFunctionality: [
    {
      clause: 'Morbid — At the beginning of your end step, if a creature died this turn, put two +1/+1 counters on target creature you control.',
      demand:
        'No "did a creature died this turn" (Morbid) tracking exists anywhere in this engine — `BoardStateCondition` only has `graveyardCountAtLeast`/`attackedThisTurn`/`selfCounterCountAtLeast`.',
    },
  ],
};
