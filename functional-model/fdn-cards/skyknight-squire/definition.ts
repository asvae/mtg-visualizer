import type { CardDefinition, Effect } from '../../card';

export const skyknightSquire: CardDefinition = {
  name: 'Skyknight Squire',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Cat Scout',
  pt: [1, 1],

  // Trigger: "Whenever another creature you control enters, put a +1/+1 counter
  // on this creature."
  // GAP: Current engine only models ETB triggers on self; firing when OTHER
  // creatures enter requires gap closure (no ValidCard$ filter/condition).
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
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

  // Static ability: "As long as this creature has three or more +1/+1 counters
  // on it, it has flying and is a Knight in addition to its other types."
  // GAP: Conditional grants (keywords/types) based on counter state are not
  // yet supported; continuousKeywordGrants only supports subtype/self/Equipment
  // targeting, not counter-based conditions.
  staticAbilities: [
    'As long as this creature has three or more +1/+1 counters on it, it has flying and is a Knight in addition to its other types.',
  ],
};
