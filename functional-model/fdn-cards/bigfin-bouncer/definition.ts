import type { CardDefinition, Effect } from '../../card';

export const bigfinBouncer: CardDefinition = {
  name: 'Bigfin Bouncer',
  provenance: 'forge-json-compiler',
  manaCost: '{3}{U}',
  typeLine: 'Creature — Shark Pirate',
  pt: [3, 2],
  triggers: [
    {
      name: 'onChangesZone',
      cause: {
        on: 'enter',
      },
      effects: [
        {
          kind: 'move',
          from: 'Battlefield',
          to: 'Hand',
          qty: 1,
          validType: 'creature',
          target: true,
          owner: 'opponents',
        } satisfies Effect,
      ],
    },
  ],
};
