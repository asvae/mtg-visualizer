import type { CardDefinition, Effect } from '../../card';

export const clinquantSkymage: CardDefinition = {
  name: 'Clinquant Skymage',
  manaCost: '{3}{U}',
  typeLine: 'Creature — Bird Wizard',
  pt: [1, 1],

  keywords: ['Flying'],

  triggers: [
    {
      name: 'onDraw',
      on: 'drawNthCardThisTurn',
      effects: [
        {
          kind: 'putCounter',
          target: 'self',
          counterType: '+1/+1',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
