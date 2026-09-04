import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'enters the battlefield, unattached (no ETB effect)' },
  { result: 'Equip {7} activated: attaches to the target creature', you: { creaturesCount: 1 } },
  { result: "destroys the target creature an opponent controls", trigger: 'onEquippedAttacks', opponents: [{ creaturesCount: 1 }] },
];
