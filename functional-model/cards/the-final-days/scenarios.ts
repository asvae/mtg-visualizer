import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { label: 'cast from hand', castFrom: 'hand' },
  { label: 'flashback, 3 creature cards in graveyard', castFrom: 'graveyard', you: { graveyardCreatureCount: 3 } },
  { label: 'flashback, empty graveyard', castFrom: 'graveyard', you: { graveyardCreatureCount: 0 } },
];
