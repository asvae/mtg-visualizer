import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { theMasamune } from './definition';

export const scenarios: Scenario[] = [
  { result: 'attaches to the target creature you control', you: { creaturesCount: 1 } },
  ...keywordScenarios(theMasamune),
];
