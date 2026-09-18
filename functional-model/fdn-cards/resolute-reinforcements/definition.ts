import type { CardDefinition, Effect } from '../../card';

export const resoluteReinforcements: CardDefinition = {
  name: 'Resolute Reinforcements',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Human Soldier',
  pt: [1, 1],
  keywords: ['Flash'],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'createToken',
          token: { name: 'Soldier', manaCost: '0', types: ['Creature', 'Soldier'], basePower: 1, baseToughness: 1 },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
