import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'returns a creature card from your graveyard to the battlefield with two +1/+1 counters on it', castFrom: 'hand', you: { graveyardCreatureCount: 1 } },
  { result: 'no legal target — your graveyard has no creature card, nothing returned', castFrom: 'hand', you: { graveyardCreatureCount: 0 } },
];
