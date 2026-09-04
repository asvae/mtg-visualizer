import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'opponent discards a card, loses 2 life, and has the top 3 cards of their library exiled', trigger: 'onEnter', opponents: [{ handCount: 4, life: 20, libraryCount: 40 }] },
  { result: 'each opponent discards a card, loses 2 life, and has the top 3 cards of their library exiled', trigger: 'onEnter', opponents: [{ handCount: 4, life: 20, libraryCount: 40 }, { handCount: 2, life: 12, libraryCount: 30 }] },
];
