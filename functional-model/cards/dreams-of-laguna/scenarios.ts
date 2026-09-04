import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'surveils 1, then draws a card', castFrom: 'hand' },
  { result: 'cast via Flashback from the graveyard; surveils 1, then draws a card; exiled afterward instead of going to the graveyard', castFrom: 'graveyard' },
];
