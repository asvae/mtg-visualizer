import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { coralSword } from './definition';

export const scenarios: Scenario[] = [
  { result: 'attaches to the creature and grants it first strike until end of turn', trigger: 'onEnter', you: { creaturesCount: 1 } },
  { result: 'Equip {1} activated: attaches to the target creature', you: { creaturesCount: 1 } },
  ...keywordScenarios(coralSword),
];
