import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { castFrom: 'hand', result: 'creates a 3/3 blue Robot Warrior artifact creature token, no counters' },
  { castFrom: 'graveyard', result: 'creates the token, then puts two +1/+1 counters on it (cast via Flashback)' },
];
