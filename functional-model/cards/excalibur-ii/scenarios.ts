import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { excaliburIi } from './definition';

export const scenarios: Scenario[] = [
  { result: 'puts a charge counter on itself', trigger: 'onLifeGained' },
  { result: 'attaches to the target creature you control', you: { creaturesCount: 2 } },
  ...keywordScenarios(excaliburIi),
];
