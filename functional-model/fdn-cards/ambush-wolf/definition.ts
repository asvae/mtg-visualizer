import type { CardDefinition, Effect } from '../../card';

export const ambushWolf: CardDefinition = {
  name: 'Ambush Wolf',
  manaCost: '{2}{G}',
  typeLine: 'Creature — Wolf',
  pt: [4, 2],
  keywords: ['Flash'],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'move',
          from: 'Graveyard',
          to: 'Exile',
          qty: 1,
          target: true,
          optional: true,
        } satisfies Effect,
      ],
    },
  ],
};
