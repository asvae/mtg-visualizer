import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'draws 2 cards; puts a +1/+1 counter on the one target creature you control', castFrom: 'hand', you: { creaturesCount: 1 } },
  { result: 'draws 2 cards; no legal creature to target, no counter placed', castFrom: 'hand', you: { creaturesCount: 0 } },
];
