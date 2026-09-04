import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates a 2/2 green Bird creature token', castFrom: 'hand' },
  { result: 'cast via Flashback from the graveyard, creates a 2/2 green Bird creature token, then this card is exiled instead of going to the graveyard', castFrom: 'graveyard' },
];
