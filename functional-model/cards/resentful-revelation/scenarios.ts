import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'looks at the top 3 library cards: 1 to hand, 2 to graveyard', castFrom: 'hand', you: { libraryCount: 5 } },
  { result: 'cast via Flashback from the graveyard, then exiled instead of returning to the graveyard afterward', castFrom: 'graveyard', you: { libraryCount: 5 } },
];
