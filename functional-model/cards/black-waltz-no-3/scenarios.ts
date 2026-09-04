import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { blackWaltzNo3 } from './definition';

export const scenarios: Scenario[] = [
  { result: 'deals 2 damage to each opponent', trigger: 'onNoncreatureSpellCast', opponents: [{}, {}] },
  ...keywordScenarios(blackWaltzNo3),
];
