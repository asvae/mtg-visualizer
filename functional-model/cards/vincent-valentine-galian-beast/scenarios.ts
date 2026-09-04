import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { vincentValentine } from './definition';

export const scenarios: Scenario[] = [
  { result: 'puts 3 +1/+1 counters on Vincent Valentine (the dying creature was power 3)', trigger: 'onOpponentCreatureDies', triggerInput: { dyingCreaturePower: 3 } },
  { result: 'transforms into Galian Beast (represented as exile-then-return)', trigger: 'onAttacks' },
  { result: 'returns to the battlefield tapped, front face up', face: 'back', trigger: 'onDies' },
  { result: 'Lifelink: deals 3 combat damage to an opponent', face: 'back', dealsCombatDamage: { amount: 3 } },
  ...keywordScenarios(vincentValentine),
];
