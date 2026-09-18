import type { CardDefinition } from '../../card';

export const refute: CardDefinition = {
  name: 'Refute',
  manaCost: '{1}{U}{U}',
  typeLine: 'Instant',
  effects: [
    {
      kind: 'counter',
      describe: 'Counter target spell',
    },
    {
      kind: 'drawCard',
      amount: 1,
    },
    {
      kind: 'discard',
      owner: 'you',
      qty: 1,
    },
  ],
};
