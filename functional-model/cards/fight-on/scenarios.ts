import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { label: 'cast from hand, 2 creature cards in graveyard', castFrom: 'hand', you: { graveyardCreatureCount: 2 } },
  { label: 'cast from hand, 1 creature card in graveyard', castFrom: 'hand', you: { graveyardCreatureCount: 1 } },
  { label: 'cast from hand, empty graveyard', castFrom: 'hand', you: { graveyardCreatureCount: 0 } },
];
