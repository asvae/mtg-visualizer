import type { CardDefinition, Effect } from '../../card';

export const skyknightSquire: CardDefinition = {
  name: 'Skyknight Squire',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Cat Scout',
  pt: [1, 1],

  // "Whenever another creature you control enters, put a +1/+1 counter on
  // this creature."
  triggers: [
    {
      name: 'onOtherCreatureEnters',
      on: 'otherPermanentEnters',
      otherPermanentEntersMatch: { sameController: true },
      effects: [
        {
          kind: 'putCounter',
          target: 'self',
          counterType: '+1/+1',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],

  // "As long as this creature has three or more +1/+1 counters on it, it
  // has flying and is a Knight in addition to its other types."
  continuousKeywordGrants: [
    {
      keywords: ['Flying'],
      includeSelf: true,
      condition: { kind: 'selfCounterCountAtLeast', counterType: '+1/+1', min: 3 },
    },
  ],
  continuousTypeGrants: [
    {
      types: ['Knight'],
      includeSelf: true,
      condition: { kind: 'selfCounterCountAtLeast', counterType: '+1/+1', min: 3 },
    },
  ],
};
