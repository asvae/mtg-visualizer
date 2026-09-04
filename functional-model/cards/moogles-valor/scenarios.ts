import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates 3 Moogle tokens (indestructible grant not mechanically enforced)', castFrom: 'hand', you: { creaturesCount: 3 } },
  { result: 'creates no tokens — no creatures to count', castFrom: 'hand', you: { creaturesCount: 0 } },
];
