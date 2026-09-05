import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { elvishArchdruid } from './definition';

export const scenarios: Scenario[] = [
  { result: 'enters the battlefield, no other effect (both abilities are documentary text — see definition.ts comment)' },
  ...keywordScenarios(elvishArchdruid),
];
