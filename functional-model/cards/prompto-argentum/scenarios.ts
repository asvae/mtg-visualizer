import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { promptoArgentum } from './definition';

export const scenarios: Scenario[] = [
  { result: 'creates a Treasure token', trigger: 'onNoncreatureSpellCast4Mana' },
  ...keywordScenarios(promptoArgentum),
];
