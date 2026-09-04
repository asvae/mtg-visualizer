import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates a 1/1 Hero token', trigger: 'onEnter' },
  { result: 'becomes an artifact creature', you: { creaturesCount: 1 } },
];
