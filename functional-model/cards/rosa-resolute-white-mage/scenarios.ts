import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { rosaResoluteWhiteMage } from './definition';

export const scenarios: Scenario[] = [
  { result: 'puts a +1/+1 counter on the target creature you control and it gains lifelink until end of turn', trigger: 'onBeginCombat', you: { creaturesCount: 1 } },
  ...keywordScenarios(rosaResoluteWhiteMage),
];
