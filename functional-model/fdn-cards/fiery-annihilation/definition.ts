import type { CardDefinition, Effect } from '../../card';

export const fieryAnnihilation: CardDefinition = {
  name: 'Fiery Annihilation',
  manaCost: '{2}{R}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'dealDamageTarget',
      amount: 5,
    } satisfies Effect,
  ],
};
