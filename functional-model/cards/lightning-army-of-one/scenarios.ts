import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { lightningArmyOfOne } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'triggers Stagger (no replacement-effect machinery in this model — see definition.ts, flagged as a gap)',
    trigger: 'onDealsCombatDamageToPlayer',
    opponents: [{}],
  },
  ...keywordScenarios(lightningArmyOfOne),
];
