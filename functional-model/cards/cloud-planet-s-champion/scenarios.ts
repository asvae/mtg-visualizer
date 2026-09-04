import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { cloudPlanetsChampion } from './definition';

export const scenarios: Scenario[] = [
  { result: 'creature enters, no resolvable effect (both abilities are conditional continuous statics — see definition.ts comment)' },
  ...keywordScenarios(cloudPlanetsChampion),
];
