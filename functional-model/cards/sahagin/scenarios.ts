import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: "puts a +1/+1 counter on itself (and can't be blocked this turn, not tracked in this model)", trigger: 'onNoncreatureSpellCast' },
];
