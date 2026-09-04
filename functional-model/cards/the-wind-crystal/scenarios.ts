import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { theWindCrystal } from './definition';

export const scenarios: Scenario[] = [
  { result: 'activated (no resolvable effect in this model — keyword-only grants are not mechanically enforced)', you: { creaturesCount: 2 } },
  ...keywordScenarios(theWindCrystal),
];
