import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { sabotender } from './definition';

export const scenarios: Scenario[] = [
  { result: 'deals 1 damage to each opponent', trigger: 'onLandfall', opponents: [{}] },
  ...keywordScenarios(sabotender),
];
