import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { castFrom: 'hand', result: 'creates a 2/2 green Bird token (the X-damage half of this card is not modeled — see definition.ts comment)' },
];
