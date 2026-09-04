import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'attaches to the target creature you control', you: { creaturesCount: 1 } },
  {
    result: "self has no equipped creature yet (this scenario's own setup doesn't attach it first, so nothing is untapped); the additional-combat-phase clause is not modeled",
    trigger: 'onEquippedAttacksFirstCombat',
  },
];
