import type { CardDefinition } from '../../card';

export const elendaSaintOfDusk: CardDefinition = {
  name: 'Elenda, Saint of Dusk',
  manaCost: '{2}{W}{B}',
  typeLine: 'Legendary Creature — Vampire Knight',
  pt: [4, 4],
  keywords: ['Lifelink'],

  missingSchemaFunctionality: [
    {
      clause: 'hexproof from instants',
      demand: 'The `Keyword` union only has plain, unqualified `\'Hexproof\'` — no protection/hexproof-from-a-specific-card-quality variant (mirrors the same gap `elenda`\'s own qualified hexproof would need generalized from `\'Hexproof\'`).',
    },
    {
      clause:
        'As long as your life total is greater than your starting life total, Elenda gets +1/+1 and has menace. Elenda gets an additional +5/+5 as long as your life total is at least 10 greater than your starting life total.',
      demand: 'No `BoardStateCondition` variant reads a live life-total comparison (only `graveyardCountAtLeast`/`attackedThisTurn`/`selfCounterCountAtLeast`) — needs a new life-total-threshold condition.',
    },
  ],
};
