import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { matoyaArchonElder } from './definition';

export const scenarios: Scenario[] = [
  { result: 'draws a card', trigger: 'onScry' },
  { result: 'draws a card', trigger: 'onSurveil' },
  ...keywordScenarios(matoyaArchonElder),
];
