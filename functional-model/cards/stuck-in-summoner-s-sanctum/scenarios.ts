import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { stuckInSummonersSanctum } from './definition';

export const scenarios: Scenario[] = [
  { result: 'taps the enchanted permanent', trigger: 'onEnter', you: { creaturesCount: 1 } },
  ...keywordScenarios(stuckInSummonersSanctum),
];
