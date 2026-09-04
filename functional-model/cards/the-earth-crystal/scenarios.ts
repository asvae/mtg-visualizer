import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { theEarthCrystal } from './definition';

export const scenarios: Scenario[] = [
  { result: 'puts a +1/+1 counter on each of the 2 target creatures you control', you: { creaturesCount: 2 } },
  { result: 'only one creature you control: puts a +1/+1 counter on it', you: { creaturesCount: 1 } },
  ...keywordScenarios(theEarthCrystal),
];
