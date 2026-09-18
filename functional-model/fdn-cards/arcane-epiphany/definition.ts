import type { CardDefinition, Effect } from '../../card';

export const arcaneEpiphany: CardDefinition = {
  name: 'Arcane Epiphany',
  manaCost: '{3}{U}{U}',
  typeLine: 'Instant',

  costReduction: {
    perControlled: {
      amountPerMatch: 1,
      subtype: 'Wizard',
    },
  },

  effects: [
    {
      kind: 'drawCard',
      amount: 3,
    } satisfies Effect,
  ],
};
