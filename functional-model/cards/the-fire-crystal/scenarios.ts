import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: "creates a token copy of the target creature you control", you: { creaturesCount: 1 } },
  { result: 'no creature to copy, no token created', you: { creaturesCount: 0 } },
];
