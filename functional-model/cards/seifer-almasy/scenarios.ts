import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { seiferAlmasy } from './definition';

export const scenarios: Scenario[] = [
  { result: 'the attacking creature gains double strike until end of turn', trigger: 'onAttacksAlone', you: { creaturesCount: 1 } },
  { result: '(not mechanically enforced — see definition.ts comment)', trigger: 'onDealsCombatDamageToPlayer' },
  ...keywordScenarios(seiferAlmasy),
];
