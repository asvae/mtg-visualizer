import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates a 1/1 Hero token and attaches itself to it', trigger: 'onEnter' },
  { result: 'attaches to a creature you control', you: { creaturesCount: 2 } },
];
