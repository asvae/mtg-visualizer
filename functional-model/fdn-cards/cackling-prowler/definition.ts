import type { CardDefinition } from '../../card';

export const cacklingProwler: CardDefinition = {
  name: 'Cackling Prowler',
  manaCost: '{3}{G}',
  typeLine: 'Creature — Hyena Rogue',
  pt: [4, 3],
  keywords: ['Ward'],

  missingSchemaFunctionality: [
    {
      clause: 'Morbid — At the beginning of your end step, if a creature died this turn, put a +1/+1 counter on this creature.',
      demand:
        'No "did a creature died this turn" (Morbid) tracking exists anywhere in this engine — `BoardStateCondition` only has `graveyardCountAtLeast`/`attackedThisTurn`/`selfCounterCountAtLeast`.',
    },
  ],
};
