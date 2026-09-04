import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { balthierAndFran } from './definition';

export const scenarios: Scenario[] = [
  { result: 'no mechanically-executable effect (no phase/turn-structure Effect shape exists here — see definition.ts)', trigger: 'onCrewedVehicleAttacksFirstCombat' },
  ...keywordScenarios(balthierAndFran),
];
