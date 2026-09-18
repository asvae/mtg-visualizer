import type { CardDefinition, Effect } from '../../card';

export const highSocietyHunter: CardDefinition = {
  name: 'High-Society Hunter',
  manaCost: '{3}{B}{B}',
  typeLine: 'Creature — Vampire Noble',
  pt: [5, 3],

  keywords: ['Flying'],

  triggers: [
    {
      name: 'onAttack',
      on: 'attacks',
      effects: [
        { kind: 'sacrifice', owner: 'you', validType: 'creature', notSelf: true, optional: true } satisfies Effect,
        { kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect,
      ],
    },
    {
      name: 'onCreatureDies',
      on: 'otherCreatureDies',
      otherCreatureDiesMatch: { nonToken: true },
      effects: [
        {
          kind: 'drawCard',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
