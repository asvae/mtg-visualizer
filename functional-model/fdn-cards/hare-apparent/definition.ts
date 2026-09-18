import type { CardDefinition, Effect } from '../../card';
import { you } from '../../combinator';

export const hareApparent: CardDefinition = {
  name: 'Hare Apparent',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Rabbit Noble',
  pt: [2, 2],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'createToken',
          token: {
            name: 'Rabbit',
            manaCost: '0',
            types: ['Creature', 'Rabbit'],
            basePower: 1,
            baseToughness: 1,
          },
          amount: you.creaturesInPlay().filter('sameNameAsSelf').count(),
        } satisfies Effect,
      ],
    },
  ],
};
