import type { CardDefinition, Effect } from '../../card';

export const guardedHeir: CardDefinition = {
  name: 'Guarded Heir',
  provenance: 'forge-json-compiler',
  manaCost: '{5}{W}',
  typeLine: 'Creature — Human Noble',
  pt: [1, 1],
  keywords: ['Lifelink'],
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
            name: 'Knight',
            manaCost: '0',
            types: ['Creature', 'Knight'],
            basePower: 3,
            baseToughness: 3,
          },
          amount: 2,
        } satisfies Effect,
      ],
    },
  ],
};
