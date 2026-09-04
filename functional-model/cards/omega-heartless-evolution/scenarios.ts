import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { omegaHeartlessEvolution } from './definition';

export const scenarios: Scenario[] = [
  {
    result: "taps the opponent's nonland permanent, puts 2 stun counters on it, and you gain 2 life (2 lands controlled)",
    trigger: 'onEnter',
    you: { landsCount: 2 },
    opponents: [{ creaturesCount: 1 }],
  },
  ...keywordScenarios(omegaHeartlessEvolution),
];
