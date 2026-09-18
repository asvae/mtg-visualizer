import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens';

export const midnightSnack: CardDefinition = {
  name: 'Midnight Snack',
  manaCost: '{2}{B}',
  typeLine: 'Enchantment',

  // "Raid — At the beginning of your end step, if you attacked this turn,
  // create a Food token."
  triggers: [
    {
      name: 'onEndStep',
      on: 'endStep',
      condition: { kind: 'attackedThisTurn' },
      effects: [
        {
          kind: 'createToken',
          token: TOKENS.c_a_food_sac,
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],

  // "{2}{B}, Sacrifice this enchantment: Target opponent loses X life,
  // where X is the amount of life you gained this turn."
  activationCost: '{2}{B}, sacrifice this enchantment',
  effects: [
    {
      kind: 'loseLife',
      owner: 'opponents',
      amount: (ctx) => (ctx.triggerInput?.lifeGainedThisTurn as number) ?? 0,
    } satisfies Effect,
  ],
};
