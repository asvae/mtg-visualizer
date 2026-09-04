import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'mills 2 cards, then sacrifices Eden itself, then returns another permanent card from the graveyard to hand',
    you: { graveyardCreatureCount: 2, libraryCount: 2 },
  },
  {
    result: 'mills 2 cards (library exhausted after), then sacrifices Eden itself; no OTHER permanent card in the graveyard to return',
    you: { libraryCount: 2 },
  },
];
