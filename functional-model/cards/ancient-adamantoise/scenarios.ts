import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { ancientAdamantoise } from './definition';

export const scenarios: Scenario[] = [
  { result: 'exiles itself and creates ten tapped Treasure tokens', trigger: 'onDies' },
  ...keywordScenarios(ancientAdamantoise),
];
