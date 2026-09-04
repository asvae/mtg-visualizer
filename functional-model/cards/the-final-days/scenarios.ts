import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates two 2/2 Horror tokens, tapped', castFrom: 'hand' },
  { result: 'creates three 2/2 Horror tokens, tapped, then exiles itself', castFrom: 'graveyard', you: { graveyardCreatureCount: 3 } },
  { result: 'creates no Horror tokens (empty graveyard), then exiles itself', castFrom: 'graveyard', you: { graveyardCreatureCount: 0 } },
];
