import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'enters the battlefield (its own ETB trigger fires separately below)' },
  { result: 'pays 2 life (modeled as always paying — see definition.ts comment; the tapped/free branch is not modeled)', trigger: 'onEnter' },
];
