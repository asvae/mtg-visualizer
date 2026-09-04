import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { cecilDarkKnight } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'you lose 2 life (18 remaining); above half starting life, no transform',
    trigger: 'onDealsDamage',
    triggerInput: { damageAmount: 2 },
  },
  {
    result: 'you lose 5 life (7 remaining, at or below half of 20); untaps and transforms into Cecil, Redeemed Paladin',
    trigger: 'onDealsDamage',
    you: { life: 12 },
    triggerInput: { damageAmount: 5 },
  },
  {
    result: 'other attacking creatures gain indestructible until end of turn (not mechanically enforced)',
    face: 'back',
    trigger: 'onAttacks',
    you: { creaturesCount: 1 },
  },
  ...keywordScenarios(cecilDarkKnight),
];
