import type { CardDefinition, Effect } from '../../card';

export const ajanisPridemate: CardDefinition = {
  name: 'Ajani\'s Pridemate',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Cat Soldier',

  pt: [2, 2],

  triggers: [
    {
      name: 'onLifeGained',
      on: 'lifeGained',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    },
  ],
};
