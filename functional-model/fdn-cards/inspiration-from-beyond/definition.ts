import type { CardDefinition } from '../../card';

export const inspirationFromBeyond: CardDefinition = {
  name: 'Inspiration from Beyond',
  manaCost: '{2}{U}',
  typeLine: 'Sorcery',
  alternateCosts: [
    {
      name: 'Flashback',
      cost: '{5}{U}{U}',
      from: 'graveyard',
      thenExile: true,
    },
  ],
  effects: [
    {
      kind: 'mill',
      owner: 'you',
      amount: 3,
    },
    {
      kind: 'move',
      from: 'Graveyard',
      to: 'Hand',
      qty: 1,
      owner: 'you',
      validType: 'any',
      subtype: ['Instant', 'Sorcery'],
      target: true,
    },
  ],
};
