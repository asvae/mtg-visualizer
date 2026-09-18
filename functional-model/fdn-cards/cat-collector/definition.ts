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
      // Note: "Whenever you gain life for the first time during each of your turns" requires:
      // 1. A 'gainLife' trigger type (doesn't exist yet — see ENGINE_GAPS.md)
      // 2. Condition checking "first time this turn" (no condition field on Trigger)
      // Modeled as a named trigger for manual scenario invocation.
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
