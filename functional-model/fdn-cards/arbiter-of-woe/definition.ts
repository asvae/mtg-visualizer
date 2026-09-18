import type { CardDefinition, Effect } from '../../card';

export const arbiterOfWoe: CardDefinition = {
  name: 'Arbiter of Woe',
  manaCost: '{4}{B}{B}',
  typeLine: 'Creature — Demon',
  pt: [5, 4],

  keywords: ['Flying'],

  staticAbilities: [
    'As an additional cost to cast this spell, sacrifice a creature.',
  ],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'discard',
          owner: 'opponents',
          qty: 1,
        } satisfies Effect,
        {
          kind: 'loseLife',
          owner: 'opponents',
          amount: 2,
        } satisfies Effect,
        {
          kind: 'drawCard',
          amount: 1,
        } satisfies Effect,
        {
          kind: 'gainLife',
          amount: 2,
        } satisfies Effect,
      ],
    },
  ],
};
