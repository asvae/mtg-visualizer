import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { renoAndRude } from './definition';

export const scenarios: Scenario[] = [
  {
    result: "exiles the top card of the opponent's library, sacrifices another creature or artifact",
    trigger: 'onDealsDamage',
    opponents: [{ libraryCount: 3 }],
    you: { creaturesCount: 2 },
  },
  {
    result: "exiles the top card of the opponent's library; nothing to sacrifice",
    trigger: 'onDealsDamage',
    opponents: [{ libraryCount: 3 }],
    you: { creaturesCount: 0, artifactsCount: 0 },
  },
  ...keywordScenarios(renoAndRude),
];
