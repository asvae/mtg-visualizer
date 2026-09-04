import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'pumps your target creature +1/+1, grants it hexproof, and untaps it',
    castFrom: 'hand',
    you: { creaturesCount: 1 },
    opponents: [{ creaturesCount: 1 }],
  },
  { result: 'no legal target — you control no creatures, nothing happens', castFrom: 'hand', opponents: [{ creaturesCount: 1 }] },
];
