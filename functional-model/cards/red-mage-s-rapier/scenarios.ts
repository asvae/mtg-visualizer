import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates a 1/1 colorless Hero creature token and attaches itself to it', trigger: 'onEnter' },
  { result: 'attaches itself to the target creature', you: { creaturesCount: 2 } },
  { result: 'the equipped creature gets +2/+0 until end of turn', trigger: 'onEquippedCastsNoncreatureSpell', you: { creaturesCount: 1 } },
];
