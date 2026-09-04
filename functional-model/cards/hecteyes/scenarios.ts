import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'the opponent discards a card', trigger: 'onEnter', opponents: [{ handCount: 3 }] },
  { result: 'each opponent discards a card', trigger: 'onEnter', opponents: [{ handCount: 3 }, { handCount: 5 }] },
];
