import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { adelbertSteiner } from './definition';

export const scenarios: Scenario[] = [
  { result: 'creature enters, no other effect (Lifelink and the Equipment-count P/T bonus are both continuous, not resolvable effects)' },
  ...keywordScenarios(adelbertSteiner),
];
