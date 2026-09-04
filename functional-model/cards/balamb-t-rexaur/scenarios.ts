import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { balambTRexaur } from './definition';

export const scenarios: Scenario[] = [
  { result: 'you gain 3 life', trigger: 'onEnter' },
  ...keywordScenarios(balambTRexaur),
];
