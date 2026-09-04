import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'draws a card, then discards a card', trigger: 'onAttacks', you: { libraryCount: 1, handCount: 1 } },
];
