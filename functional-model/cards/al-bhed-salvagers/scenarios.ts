import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'target opponent loses 1 life, you gain 1 life', trigger: 'onDies', opponents: [{}] },
];
