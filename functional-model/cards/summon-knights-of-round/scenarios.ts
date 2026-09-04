import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { summonKnightsOfRound } from './definition';

export const scenarios: Scenario[] = [
  { result: 'creates three 2/2 Knight tokens', trigger: 'chapterI' },
  { result: 'creates three 2/2 Knight tokens', trigger: 'chapterII' },
  { result: 'creates three 2/2 Knight tokens', trigger: 'chapterIII' },
  { result: 'creates three 2/2 Knight tokens', trigger: 'chapterIV' },
  { result: 'other creatures you control get +2/+2 and an indestructible counter', trigger: 'chapterV', you: { creaturesCount: 3 } },
  { result: 'no other creatures to affect, no-op', trigger: 'chapterV', you: { creaturesCount: 0 } },
  ...keywordScenarios(summonKnightsOfRound),
];
