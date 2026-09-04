import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { hillGigas } from './definition';

export const scenarios: Scenario[] = [
  { result: 'enters the battlefield, no other effect (Mountaincycling not modeled — see definition.ts comment)' },
  ...keywordScenarios(hillGigas),
];
