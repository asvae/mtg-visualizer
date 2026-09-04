import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates a 1/1 colorless Hero creature token, then attaches to it', trigger: 'onEnter' },
  { result: 'attaches to target creature you control', you: { creaturesCount: 1 } },
];
