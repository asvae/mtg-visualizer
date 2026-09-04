import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'attaches to the target creature and grants it first strike until end of turn (the "must be blocked" restriction is not modeled)', trigger: 'onEnter', you: { creaturesCount: 1 } },
  { result: 'Equip {2} activated: attaches to the target creature', you: { creaturesCount: 1 } },
];
