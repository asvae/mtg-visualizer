import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { label: 'ETB', trigger: 'onEnter', you: { life: 20 } },
  { label: 'attacks, has fodder to sacrifice', trigger: 'onAttack', you: { creaturesCount: 2, artifactsCount: 1 } },
  { label: 'attacks, no fodder', trigger: 'onAttack', you: { creaturesCount: 0, artifactsCount: 0 } },
];
