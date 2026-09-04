import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { castFrom: 'hand', you: { libraryCount: 5 }, result: '3 of the top 5 cards go to your hand, the other 2 to the bottom of your library' },
  { castFrom: 'graveyard', you: { libraryCount: 5 }, result: 'cast via Flashback for {7}{U}{U}; same dig, then exiled instead of going to the graveyard' },
];
