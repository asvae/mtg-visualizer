import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'target creature gets +1/+0 until end of turn (the granted death-trigger text is not modeled — see definition.ts comment)', you: { creaturesCount: 1 } },
];
