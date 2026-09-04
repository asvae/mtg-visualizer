import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { label: 'ETB, 1 opponent', trigger: 'onEnter', opponents: [{ handCount: 3 }] },
  { label: 'ETB, 2 opponents', trigger: 'onEnter', opponents: [{ handCount: 3 }, { handCount: 5 }] },
];
