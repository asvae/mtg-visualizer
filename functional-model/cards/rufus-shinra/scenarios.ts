import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { rufusShinra } from './definition';

export const scenarios: Scenario[] = [
  { result: 'creates Darkstar, a legendary 2/2 white and black Dog token (you don\'t control one)', trigger: 'onAttacks' },
  ...keywordScenarios(rufusShinra),
];
