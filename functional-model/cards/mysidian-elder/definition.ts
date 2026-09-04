import type { CardDefinition, Effect } from '../../card';

export const mysidianElder: CardDefinition = {
  name: 'Mysidian Elder',
  manaCost: '{2}{R}',
  typeLine: 'Creature — Human Wizard',

  pt: [1, 3],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          kind: 'createToken',
          // Real TokenScript$ b_0_1_wizard_snipe — not in the shared
          // TOKENS registry (functional-model/tokens.ts, off-limits to
          // edit for this batch), so built inline the same way any
          // TokenInfo literal is: it's plain data, not required to come
          // from the registry.
          token: { name: 'Wizard', manaCost: '0', types: ['Creature', 'Wizard'], basePower: 0, baseToughness: 1 },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
