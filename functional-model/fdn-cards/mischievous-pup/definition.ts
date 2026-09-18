import type { CardDefinition, Effect } from '../../card';

export const mischievousPup: CardDefinition = {
  name: 'Mischievous Pup',
  manaCost: '{2}{W}',
  typeLine: 'Creature — Dog',
  pt: [3, 1],
  keywords: ['Flash'],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'move',
          owner: 'you',
          from: 'Battlefield',
          to: 'Hand',
          validType: 'any',
          notSelf: true,
          qty: 1,
          target: true,
          optional: true,
        } satisfies Effect,
      ],
    },
  ],
};
