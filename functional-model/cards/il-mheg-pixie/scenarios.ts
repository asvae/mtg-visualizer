import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { ilMhegPixie } from './definition';

export const scenarios: Scenario[] = [
  { trigger: 'onAttack', result: 'surveils 1' },
  ...keywordScenarios(ilMhegPixie),
];
