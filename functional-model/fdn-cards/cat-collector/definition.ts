import type { CardDefinition, Effect } from '../../card';

export const catCollector: CardDefinition = {
  name: 'Cat Collector',
  provenance: 'forge-json-compiler',
  manaCost: '{2}{W}',
  typeLine: 'Creature — Human Citizen',
  pt: [3, 2],
  triggers: [
    {
      name: 'onChangesZone',
      cause: {
        on: 'enter',
      },
      effects: [
        {
          kind: 'createToken',
          token: {
            name: 'Food',
            manaCost: '0',
            types: ['Artifact', 'Food'],
            basePower: 0,
            baseToughness: 0,
          },
          amount: 1,
        } satisfies Effect,
      ],
    },
    {
      name: 'onLifeGained',
      cause: {
        on: 'lifeGained',
        activationLimit: 1,
      },
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
