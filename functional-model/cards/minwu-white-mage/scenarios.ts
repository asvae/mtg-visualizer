import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { minwuWhiteMage } from './definition';

export const scenarios: Scenario[] = [
  { result: 'puts a +1/+1 counter on self and both other Clerics (3 total)', trigger: 'onLifeGained', you: { creaturesCount: 2, creatureSubtypes: ['Cleric'] } },
  { result: 'puts a +1/+1 counter on self only — the other 2 creatures are not Clerics', trigger: 'onLifeGained', you: { creaturesCount: 2 } },
  ...keywordScenarios(minwuWhiteMage),
];
