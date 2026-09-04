import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { firionWildRoseWarrior } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'creates a token copy of the entering Coral Sword',
    trigger: 'onEquipmentEnters',
    triggerInput: { equipmentName: 'Coral Sword' },
  },
  ...keywordScenarios(firionWildRoseWarrior),
];
