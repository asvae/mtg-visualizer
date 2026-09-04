import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { theLunarWhale } from './definition';

export const scenarios: Scenario[] = [
  { result: 'becomes an artifact creature (crewed)', you: { creaturesCount: 1 } },
  ...keywordScenarios(theLunarWhale),
];
