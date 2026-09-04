import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { summonAnima } from './definition';

export const scenarios: Scenario[] = [
  { result: 'Pain — you draw a card and lose 1 life', trigger: 'chapterI' },
  { result: 'Pain — you draw a card and lose 1 life', trigger: 'chapterII' },
  { result: 'Pain — you draw a card and lose 1 life', trigger: 'chapterIII' },
  { result: 'Oblivion — each opponent sacrifices a creature of their choice and loses 3 life', trigger: 'chapterIV', opponents: [{ creaturesCount: 1 }] },
  ...keywordScenarios(summonAnima),
];
