import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'enters tapped', trigger: 'onEnter' },
  { result: 'creates a 1/1 colorless Hero creature token with three +1/+1 counters on it (3 lands controlled)', face: 'back', castFrom: 'hand', you: { landsCount: 3 } },
  { result: 'creates a 1/1 colorless Hero creature token, no counters (no lands controlled)', face: 'back', castFrom: 'hand' },
];
