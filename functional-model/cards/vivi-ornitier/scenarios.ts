import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { viviOrnitier } from './definition';

export const scenarios: Scenario[] = [
  { result: 'puts a +1/+1 counter on Vivi and it deals 1 damage to each opponent', trigger: 'onCastNoncreatureSpell', opponents: [{}] },
  ...keywordScenarios(viviOrnitier),
];
