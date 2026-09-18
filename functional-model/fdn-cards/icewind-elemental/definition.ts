import type { CardDefinition, Effect } from '../../card';

export const icewindElemental: CardDefinition = {
  name: 'Icewind Elemental',
  manaCost: '{4}{U}',
  typeLine: 'Creature — Elemental',
  pt: [3, 4],
  keywords: ['Flying'],
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'drawCard',
          amount: 1,
        } satisfies Effect,
        {
          kind: 'discard',
          owner: 'you',
          qty: 1,
        } satisfies Effect,
      ],
    },
  ],
};
