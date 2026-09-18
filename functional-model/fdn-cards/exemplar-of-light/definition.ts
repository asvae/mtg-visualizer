import type { CardDefinition, Effect } from '../../card';

export const exemplarOfLight: CardDefinition = {
  name: 'Exemplar of Light',
  manaCost: '{2}{W}{W}',
  typeLine: 'Creature — Angel',
  pt: [3, 3],
  keywords: ['Flying'],

  triggers: [
    {
      name: 'onLifeGain',
      on: 'lifeGained',
      effects: [
        {
          kind: 'putCounter',
          target: 'self',
          counterType: '+1/+1',
          amount: 1,
        } satisfies Effect,
      ],
    },
    {
      name: 'onCounterAdded',
      activationLimit: 1,
      effects: [
        {
          kind: 'drawCard',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
