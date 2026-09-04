import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { thePrimaVista } from './definition';

export const scenarios: Scenario[] = [
  { result: 'becomes an artifact creature (triggered by casting a 4+-mana noncreature spell)', trigger: 'onCastNoncreatureSpell4Mana' },
  { result: 'becomes an artifact creature (crewed)', you: { creaturesCount: 1 } },
  ...keywordScenarios(thePrimaVista),
];
