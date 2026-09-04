import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'puts a +1/+1 counter on the target creature you control', trigger: 'onLandfall', you: { creaturesCount: 1 } },
  { result: 'no legal creature target you control, no counter placed', trigger: 'onLandfall', you: { creaturesCount: 0 } },
  { result: 'becomes a 7/7 Beast creature in addition to its other types (types animated; power/toughness set from a default 1/1 base to 7/7 via a computed pump delta)' },
];
