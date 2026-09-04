import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { zidaneTantalusThief } from './definition';

export const scenarios: Scenario[] = [
  { result: 'gains control of an opposing creature, untaps it, grants it lifelink and haste', trigger: 'onEnter', opponents: [{ creaturesCount: 1 }] },
  { result: 'no opposing creature, no legal target', trigger: 'onEnter', opponents: [{ creaturesCount: 0 }] },
  { result: 'creates a Treasure token', trigger: 'onOpponentGainsControlFromYou' },
  ...keywordScenarios(zidaneTantalusThief),
];
