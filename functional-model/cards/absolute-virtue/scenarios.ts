import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { absoluteVirtue } from './definition';

export const scenarios: Scenario[] = [
  { result: 'enters the battlefield with no resolvable effect — "can\'t be countered" and protection from opponents are both continuous static rules' },
  ...keywordScenarios(absoluteVirtue),
];
