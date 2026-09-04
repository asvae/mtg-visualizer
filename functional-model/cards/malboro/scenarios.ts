import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { label: 'ETB, 1 opponent', trigger: 'onEnter', opponents: [{ handCount: 4, life: 20, libraryCount: 40 }] },
  { label: 'ETB, 2 opponents', trigger: 'onEnter', opponents: [{ handCount: 4, life: 20, libraryCount: 40 }, { handCount: 2, life: 12, libraryCount: 30 }] },
];
