import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { castFrom: 'hand', you: { graveyardCreatureCount: 2 }, result: '2 creature cards moved from graveyard to hand' },
  { castFrom: 'hand', you: { graveyardCreatureCount: 1 }, result: '1 creature card moved from graveyard to hand' },
  { castFrom: 'hand', you: { graveyardCreatureCount: 0 }, result: 'nothing to return, no legal targets' },
];
