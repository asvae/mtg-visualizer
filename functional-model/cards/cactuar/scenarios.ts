import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { cactuar } from './definition';

export const scenarios: Scenario[] = [
  { result: "returns itself to its owner's hand", trigger: 'onEndStep' },
  ...keywordScenarios(cactuar),
];
