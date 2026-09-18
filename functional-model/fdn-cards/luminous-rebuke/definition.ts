import type { CardDefinition, Effect } from '../../card';

export const luminousRebuke: CardDefinition = {
  name: 'Luminous Rebuke',
  manaCost: '{4}{W}',
  typeLine: 'Instant',

  costReduction: {
    amount: 3,
    condition: 'tappedCreatureTarget',
  },

  effects: [
    {
      kind: 'destroy',
      validType: 'creature',
      qty: 1,
    } satisfies Effect,
  ],
};
