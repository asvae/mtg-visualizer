import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'target creature you control set to 3/2 until end of turn (2/2 -> 3/2)', castFrom: 'hand', mode: 0, you: { creaturesCount: 1, creaturePower: 2 } },
  { result: 'target creature you control set to 5/2 until end of turn (2/2 -> 5/2)', castFrom: 'hand', mode: 1, you: { creaturesCount: 1, creaturePower: 2 } },
  { result: 'target creature you control set to 7/2 until end of turn (2/2 -> 7/2)', castFrom: 'hand', mode: 2, you: { creaturesCount: 1, creaturePower: 2 } },
  { result: 'no creature you control on the battlefield, nothing happens', castFrom: 'hand', mode: 0 },
];
