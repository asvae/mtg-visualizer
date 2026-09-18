import type { CardDefinition, Effect } from '../../card';

export const cephalidInkmage: CardDefinition = {
  name: 'Cephalid Inkmage',
  manaCost: '{2}{U}',
  typeLine: 'Creature — Octopus Wizard',
  pt: [2, 2],

  // "Threshold — This creature can't be blocked as long as there are seven
  // or more cards in your graveyard."
  continuousKeywordGrants: [
    {
      keywords: ['Unblockable'],
      includeSelf: true,
      condition: { kind: 'graveyardCountAtLeast', min: 7 },
    },
  ],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'surveil',
          qty: 3,
        } satisfies Effect,
      ],
    },
  ],
};
