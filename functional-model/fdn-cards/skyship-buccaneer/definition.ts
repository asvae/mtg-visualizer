import type { CardDefinition, Effect } from '../../card';

export const skyshipBuccaneer: CardDefinition = {
  name: 'Skyship Buccaneer',
  provenance: 'forge-json-compiler',
  manaCost: '{3}{U}{U}',
  typeLine: 'Creature — Human Pirate',
  pt: [4, 3],
  keywords: ['Flying'],
  triggers: [
    {
      name: 'onChangesZone',
      cause: {
        on: 'enter',
        condition: {
          kind: 'attackedThisTurn',
        },
      },
      effects: [
        {
          kind: 'drawCard',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
