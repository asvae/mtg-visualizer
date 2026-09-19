import type { CardDefinition, Effect } from '../../card';

export const helpfulHunter: CardDefinition = {
  name: 'Helpful Hunter',
  provenance: 'forge-json-compiler',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Cat',
  pt: [1, 1],
  triggers: [
    {
      name: 'onChangesZone',
      cause: {
        on: 'enter',
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
