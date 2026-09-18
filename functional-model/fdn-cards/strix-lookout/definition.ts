import type { CardDefinition } from '../../card';

export const strixLookout: CardDefinition = {
  name: 'Strix Lookout',
  manaCost: '{1}{U}',
  typeLine: 'Creature — Bird',
  pt: [1, 2],
  keywords: ['Flying', 'Vigilance'],
  activationCost: '{1}{U}{T}',
  effects: [
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
