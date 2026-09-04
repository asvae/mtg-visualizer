import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'enters the battlefield, no other effect (attack trigger not modeled — see definition.ts comment; requires "attacking" and "equipped" predicates, neither of which exist on Card)' },
];
