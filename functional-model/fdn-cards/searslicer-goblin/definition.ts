import type { CardDefinition, Effect } from '../../card';

export const searslicerGoblin: CardDefinition = {
  name: 'Searslicer Goblin',
  manaCost: '{1}{R}',
  typeLine: 'Creature — Goblin Warrior',
  pt: [2, 1],

  triggers: [
    {
      name: 'onEndStepRaid',
      on: 'endStep',
      condition: { kind: 'attackedThisTurn' },
      effects: [
        {
          kind: 'createToken',
          token: { name: 'Goblin', manaCost: '0', types: ['Creature', 'Goblin'], basePower: 1, baseToughness: 1 },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
