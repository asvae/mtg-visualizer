import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { ultimeciaTemporalThreat } from './definition';

export const scenarios: Scenario[] = [
  { result: "taps both of the opponent's creatures", trigger: 'onEnter', opponents: [{ creaturesCount: 2 }] },
  { result: 'draws a card', trigger: 'onDealsCombatDamage', opponents: [{}] },
  ...keywordScenarios(ultimeciaTemporalThreat),
];
