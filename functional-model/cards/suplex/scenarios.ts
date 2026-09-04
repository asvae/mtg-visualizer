import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'deals 3 damage to target creature (exile-instead-of-dying not modeled)', castFrom: 'hand', mode: 0, opponents: [{ creaturesCount: 1 }] },
  { result: 'exiles target artifact', castFrom: 'hand', mode: 1, opponents: [{ artifactsCount: 1 }] },
];
