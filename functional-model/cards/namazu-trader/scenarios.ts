import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'loses 1 life, creates a Treasure token', trigger: 'onEnter', you: { life: 20 } },
  { result: 'sacrifices a permanent, then surveils 2', trigger: 'onAttack', you: { creaturesCount: 2, artifactsCount: 1 } },
  { result: 'no fodder to sacrifice; surveils 2 anyway (sacrifice-success gate not modeled)', trigger: 'onAttack', you: { creaturesCount: 0, artifactsCount: 0 } },
];
