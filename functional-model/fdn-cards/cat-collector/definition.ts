import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens';

export const catCollector: CardDefinition = {
  name: 'Cat Collector',
  manaCost: '{2}{W}',
  typeLine: 'Creature — Human Citizen',
  pt: [3, 2],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'createToken',
          token: TOKENS.c_a_food_sac,
          amount: 1,
        } satisfies Effect,
      ],
    },
    {
      name: 'onGainLifeFirst',
      effects: [
        {
          kind: 'createToken',
          token: {
            name: 'Cat',
            manaCost: '0',
            types: ['Creature', 'Cat'],
            basePower: 1,
            baseToughness: 1,
          },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
