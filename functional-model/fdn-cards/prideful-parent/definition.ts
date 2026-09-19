import type { CardDefinition, Effect } from '../../card';

export const pridefulParent: CardDefinition = {
  name: 'Prideful Parent',
  provenance: 'forge-json-compiler',
  manaCost: '{2}{W}',
  typeLine: 'Creature — Cat',
  pt: [2, 2],
  keywords: ['Vigilance'],
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
