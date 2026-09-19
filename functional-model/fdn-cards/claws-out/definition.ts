import type { CardDefinition, Effect } from '../../card';

export const clawsOut: CardDefinition = {
  name: 'Claws Out',
  provenance: 'forge-json-compiler',
  manaCost: '{3}{W}{W}',
  typeLine: 'Instant',
  abilityType: 'spell',
  costReduction: {
    perControlled: {
      amountPerMatch: 1,
      subtype: 'Cat',
    },
  },
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
