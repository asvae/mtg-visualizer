import type { CardDefinition, Effect } from '../../card';

export const clawsOut: CardDefinition = {
  name: 'Claws Out',
  manaCost: '{3}{W}{W}',
  typeLine: 'Instant',

  costReduction: { perControlled: { amountPerMatch: 1, subtype: 'Cat' } },

  // "Creatures you control get +2/+2 until end of turn."
  effects: [
    {
      kind: 'pumpAll',
      predicate: 'creatures-you-control',
      power: 2,
      toughness: 2,
      untilEndOfTurn: true,
    } satisfies Effect,
  ],
};
