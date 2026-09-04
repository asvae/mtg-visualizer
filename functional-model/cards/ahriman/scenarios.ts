import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { ahriman } from './definition';

export const scenarios: Scenario[] = [
  { result: 'sacrifices another creature and draws a card', you: { creaturesCount: 1 } },
  { result: 'sacrifices an artifact (no other creature present) and draws a card', you: { artifactsCount: 1 } },
  ...keywordScenarios(ahriman),
];
