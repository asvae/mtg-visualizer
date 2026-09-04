import type { CardDefinition, Effect } from '../../card';

export const dreamsOfLaguna: CardDefinition = {
  name: 'Dreams of Laguna',
  manaCost: '{1}{U}',
  typeLine: 'Instant',

  // Same real Flashback shape the-final-days/definition.ts already establishes
  // — a second, alternate-cost cast mode, exiled afterward instead of
  // returning to the graveyard.
  alternateCosts: [{ name: 'Flashback', cost: '{3}{U}', from: 'graveyard', thenExile: true }],

  effects: [
    { kind: 'surveil', qty: 1 } satisfies Effect,
    { kind: 'drawCard', amount: 1 } satisfies Effect,
  ],
};
