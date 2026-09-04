import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'target creature gets +2/+2 until end of turn', castFrom: 'hand', you: { creaturesCount: 1 } },
  { result: 'you control 3+ creatures: target creature gets +4/+4 until end of turn instead', castFrom: 'hand', you: { creaturesCount: 3 } },
];
