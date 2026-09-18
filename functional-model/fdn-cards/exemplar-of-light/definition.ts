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
      // Note: Trigger "whenever you gain life" doesn't have an `on` value yet (ENGINE_GAPS.md).
      // Modeled as a named trigger for manual scenario invocation.
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
      // Note: Trigger "whenever you put one or more +1/+1 counters on this creature" doesn't have an
      // `on` value yet (ENGINE_GAPS.md). Modeled as a named trigger for manual scenario invocation.
      // The activationLimit applies: triggers only once each turn.
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
