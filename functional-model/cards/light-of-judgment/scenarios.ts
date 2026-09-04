import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'deals 6 damage to the target creature', castFrom: 'hand', opponents: [{ creaturesCount: 1 }] },
  { result: 'deals 6 damage to your own target creature', castFrom: 'hand', you: { creaturesCount: 1 } },
];
