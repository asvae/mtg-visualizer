import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { garlandKnightOfCornelia } from './definition';

export const scenarios: Scenario[] = [
  { result: 'surveils 1', trigger: 'onNoncreatureSpellCast' },
  { result: 'no mechanically-executable effect (see definition.ts)', ability: 'returnTransformed' },
  { result: "put on the bottom of its owner's library", face: 'back', trigger: 'onDies' },
  ...keywordScenarios(garlandKnightOfCornelia),
];
