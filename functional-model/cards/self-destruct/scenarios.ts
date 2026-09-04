import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'the source creature (power 4) deals 4 damage to the other target creature and 4 damage to itself',
    castFrom: 'hand',
    you: { creaturesCount: 1, creaturePower: 4 },
    opponents: [{ creaturesCount: 1 }],
  },
  { result: 'no other creature to hit; it only deals damage to itself equal to its own power', castFrom: 'hand', you: { creaturesCount: 1, creaturePower: 3 } },
];
