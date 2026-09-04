import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'no creatures to pump, no-op', you: { creaturesCount: 0 } },
  { result: 'creatures you control get +1/+1', you: { creaturesCount: 3 } },
];
