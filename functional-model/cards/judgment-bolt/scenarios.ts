import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: "deals 5 damage to the target creature and 2 damage to its controller", castFrom: 'hand', opponents: [{ creaturesCount: 1 }], you: { equipmentCount: 2 } },
  { result: 'deals 5 damage to the target creature and 0 damage to its controller (no Equipment controlled)', castFrom: 'hand', opponents: [{ creaturesCount: 1 }] },
];
