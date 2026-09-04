import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { label: '0 creatures in play', you: { creaturesCount: 0 } },
  { label: '3 creatures in play', you: { creaturesCount: 3 } },
];
