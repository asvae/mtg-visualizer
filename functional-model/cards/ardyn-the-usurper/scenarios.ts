import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { ardynTheUsurper } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'exiles the opponent graveyard creature and creates a 5/5 black Demon token copy of it',
    trigger: 'onBeginCombat',
    opponents: [{ graveyardCreatureCount: 1 }],
  },
  ...keywordScenarios(ardynTheUsurper),
];
