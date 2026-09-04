import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'target creature gets +2/+2 until end of turn (2/2 -> 4/4)', castFrom: 'hand', mode: 0, you: { creaturesCount: 1, creaturePower: 2 } },
  { result: "doubles target creature's power and toughness until end of turn (3/3 -> 6/6)", castFrom: 'hand', mode: 1, you: { creaturesCount: 1, creaturePower: 3 } },
  { result: "triples target creature's power and toughness until end of turn (2/2 -> 6/6)", castFrom: 'hand', mode: 2, you: { creaturesCount: 1, creaturePower: 2 } },
  { result: 'no legal target on the battlefield, nothing happens', castFrom: 'hand', mode: 1 },
];
