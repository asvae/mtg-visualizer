import type { CardDefinition, Effect } from '../../card';

export const dragonTrainer: CardDefinition = {
  name: 'Dragon Trainer',
  manaCost: '{3}{R}{R}',
  typeLine: 'Creature — Human',
  pt: [1, 1],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'createToken',
          token: {
            name: 'Dragon',
            manaCost: '0',
            types: ['Creature', 'Dragon'],
            basePower: 4,
            baseToughness: 4,
            keywords: ['Flying'],
          },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
