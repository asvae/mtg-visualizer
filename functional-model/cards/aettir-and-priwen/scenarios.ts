import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { aettirAndPriwen } from './definition';

export const scenarios: Scenario[] = [
  { result: 'attaches to the target creature you control', you: { creaturesCount: 2 } },
  ...keywordScenarios(aettirAndPriwen),
];
