import type { CardDefinition } from '../../card';

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
