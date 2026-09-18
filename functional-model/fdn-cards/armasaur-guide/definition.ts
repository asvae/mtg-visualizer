import type { CardDefinition, Effect } from '../../card';

export const armasaurGuide: CardDefinition = {
  name: 'Armasaur Guide',
  manaCost: '{4}{W}',
  typeLine: 'Creature — Dinosaur',
  pt: [4, 4],
  keywords: ['Vigilance'],

  triggers: [
    {
      name: 'onMassAttack',
      effects: [
        {
          kind: 'putCounterTarget',
          validType: 'creature',
          counterType: '+1/+1',
          amount: 1,
          owner: 'you',
        } satisfies Effect,
      ],
    },
  ],
};
