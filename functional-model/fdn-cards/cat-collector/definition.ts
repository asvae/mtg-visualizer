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
      on: 'lifeGained',
      // Real Forge FirstTime$ True | PlayerTurn$ True ("...for the first time
      // during each of your turns") — same per-turn-reset outcome as the
      // pre-existing activationLimit field's own ActivationLimit$ 1 (see
      // Trigger.activationLimit's own doc comment), reused here rather than
      // adding a second, narrower "first time" field for the same effect.
      activationLimit: 1,
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
