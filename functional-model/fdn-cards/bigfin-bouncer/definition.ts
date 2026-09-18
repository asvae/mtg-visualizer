import type { CardDefinition, Effect } from '../../card';

export const bigfinBouncer: CardDefinition = {
  name: 'Bigfin Bouncer',
  manaCost: '{3}{U}',
  typeLine: 'Creature — Shark Pirate',
  pt: [3, 2],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'move',
          owner: 'opponents',
          from: 'Battlefield',
          to: 'Hand',
          qty: 1,
          validType: 'creature',
          target: true,
        } satisfies Effect,
      ],
    },
  ],
};
