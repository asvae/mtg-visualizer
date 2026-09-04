import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'the opponent sacrifices a creature; you create a 0/1 black Wizard token', castFrom: 'hand', opponents: [{ creaturesCount: 1 }] },
  { result: 'no legal creature for the opponent to sacrifice; you still create the token', castFrom: 'hand', opponents: [{}] },
];
