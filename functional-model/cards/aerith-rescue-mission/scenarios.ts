import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates three 1/1 colorless Hero creature tokens', castFrom: 'hand', mode: 0 },
  { result: 'taps all three creatures and puts a stun counter on the first one tapped', castFrom: 'hand', mode: 1, you: { creaturesCount: 3 } },
  { result: 'no creatures to tap, no effect', castFrom: 'hand', mode: 1 },
];
