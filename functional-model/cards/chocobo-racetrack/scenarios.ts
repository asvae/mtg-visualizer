import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates a 2/2 green Bird creature token (its own landfall +1/+0 ability is not modeled — see definition.ts comment)', trigger: 'onLandfall' },
];
