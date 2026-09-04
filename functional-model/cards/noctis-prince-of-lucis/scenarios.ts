import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { noctisPrinceOfLucis } from './definition';

export const scenarios: Scenario[] = [
  { result: 'creature enters, no other effect (Lifelink and the graveyard-casting permission are both continuous, not resolvable effects)' },
  ...keywordScenarios(noctisPrinceOfLucis),
];
