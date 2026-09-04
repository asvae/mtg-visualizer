import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { lockeCole } from './definition';

export const scenarios: Scenario[] = [
  { result: 'draws a card, then discards a card', trigger: 'onDealsCombatDamageToPlayer', you: { libraryCount: 1, handCount: 1 }, opponents: [{}] },
  ...keywordScenarios(lockeCole),
];
