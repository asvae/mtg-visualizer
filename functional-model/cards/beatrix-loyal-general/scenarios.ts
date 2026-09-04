import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { beatrixLoyalGeneral } from './definition';

export const scenarios: Scenario[] = [
  { result: 'attaches both Equipment to the target creature you control', trigger: 'onBeginCombat', you: { creaturesCount: 1, equipmentCount: 2 } },
  { result: 'no creature to attach to, nothing happens', trigger: 'onBeginCombat', you: { equipmentCount: 2 } },
  ...keywordScenarios(beatrixLoyalGeneral),
];
