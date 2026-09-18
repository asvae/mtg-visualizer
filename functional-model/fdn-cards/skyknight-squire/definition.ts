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
  // targeting, not counter-based conditions. Migrated from `staticAbilities`
  // to `missingSchemaFunctionality` (2026-09-18, FDN schema-tightness
  // redesign).
  missingSchemaFunctionality: [
    {
      clause: 'As long as this creature has three or more +1/+1 counters on it, it has flying and is a Knight in addition to its other types.',
      demand: 'A COUNTER-COUNT-conditional variant of `continuousKeywordGrants`/`continuousTypeGrants` — both fields gate a recipient on subtype/self/Equipment-attachment only, never on a counter threshold on the recipient itself (contrast `ptFormula.kind:\'thresholdBonus\'`, which DOES support a counter-count gate, but only for a P/T delta, not a keyword/type grant).',
    },
  ],
};
