import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'the creature you control (power 2) deals 2 damage to the target creature an opponent controls',
    mode: 0,
    you: { creaturesCount: 1, creaturePower: 2 },
    opponents: [{ creaturesCount: 1 }],
  },
  {
    result: 'returns a land to hand; the creature you control (power 2) deals twice its power (4) damage to the target creature',
    mode: 1,
    you: { creaturesCount: 1, creaturePower: 2, landsCount: 1 },
    opponents: [{ creaturesCount: 1 }],
  },
];
