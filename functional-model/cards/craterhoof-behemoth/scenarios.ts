import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'enters the battlefield (its own ETB trigger fires separately below)' },
  {
    result: 'creatures you control gain trample and get +X/+X until end of turn, where X is the number of creatures you control (3, including Craterhoof itself)',
    trigger: 'onEnter',
    you: { creaturesCount: 2 },
  },
  { result: 'no other creatures — X is 1 (Craterhoof itself)', trigger: 'onEnter', you: { creaturesCount: 0 } },
];
