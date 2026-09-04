import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'deals 3 damage to target creature', castFrom: 'hand', you: { creaturesCount: 2, equipmentCount: 1, artifactsCount: 1 }, opponents: [{ creaturesCount: 1 }] },
  { result: 'deals 0 damage to target creature', castFrom: 'hand', opponents: [{ creaturesCount: 1 }] },
];
