import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'puts a +1/+1 counter on the other creature', trigger: 'onEnter', you: { creaturesCount: 1 } },
  { result: 'no other creature present, so it puts the +1/+1 counter on itself', trigger: 'onEnter', you: { creaturesCount: 0 } },
];
