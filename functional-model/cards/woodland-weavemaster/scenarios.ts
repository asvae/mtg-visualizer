import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'enters the battlefield (its own ETB-adjacent trigger fires separately below)' },
  { result: 'gets +1/+1 until end of turn', trigger: 'onOtherElfEnters' },
];
