import type { CardDefinition, Effect } from '../../card';

export const sabotender: CardDefinition = {
  name: 'Sabotender',
  manaCost: '{1}{R}',
  typeLine: 'Creature — Plant',

  pt: [2, 1],
  keywords: ['Reach'],

  triggers: [
    {
      name: 'onLandfall',
      effects: [{ kind: 'dealDamage', target: 'opponents', amount: 1 } satisfies Effect],
    },
  ],
};
