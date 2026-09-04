import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { giottKingOfTheDwarves } from './definition';

export const scenarios: Scenario[] = [
  { result: 'discards a card, then draws a card', trigger: 'onDwarfOrEquipmentEnters', you: { handCount: 1 } },
  ...keywordScenarios(giottKingOfTheDwarves),
];
