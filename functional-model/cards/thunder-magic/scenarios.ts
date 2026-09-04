import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'deals 2 damage to target creature (Thunder)', castFrom: 'hand', mode: 0, opponents: [{ creaturesCount: 1 }] },
  { result: 'deals 4 damage to target creature (Thundara)', castFrom: 'hand', mode: 1, opponents: [{ creaturesCount: 1 }] },
  { result: 'deals 8 damage to target creature (Thundaga)', castFrom: 'hand', mode: 2, opponents: [{ creaturesCount: 1 }] },
];
