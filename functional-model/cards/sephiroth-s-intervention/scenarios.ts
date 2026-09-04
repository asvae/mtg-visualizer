import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'destroys target creature, you gain 2 life', castFrom: 'hand', opponents: [{ creaturesCount: 1 }] },
  { result: 'no legal target, nothing destroyed; you still gain 2 life', castFrom: 'hand', opponents: [{ creaturesCount: 0 }] },
];
