import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'Fire: deals 1 damage to each creature (2 total)', castFrom: 'hand', mode: 0, you: { creaturesCount: 1 }, opponents: [{ creaturesCount: 1 }] },
  { result: 'Fira: deals 2 damage to each creature (2 total)', castFrom: 'hand', mode: 1, you: { creaturesCount: 1 }, opponents: [{ creaturesCount: 1 }] },
  { result: 'Firaga: deals 3 damage to each creature (2 total)', castFrom: 'hand', mode: 2, you: { creaturesCount: 1 }, opponents: [{ creaturesCount: 1 }] },
];
