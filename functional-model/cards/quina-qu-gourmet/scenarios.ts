import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { quinaQuGourmet } from './definition';

export const scenarios: Scenario[] = [
  { result: 'sacrifices the Frog and puts a +1/+1 counter on Quina', you: { creaturesCount: 1, creatureSubtypes: ['Frog'] } },
  ...keywordScenarios(quinaQuGourmet),
];
