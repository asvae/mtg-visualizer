import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates a 1/1 colorless Hero creature token and attaches itself to it', trigger: 'onEnter' },
  { result: 'attaches itself to the target creature', you: { creaturesCount: 1 } },
];
