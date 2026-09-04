import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { jenovaAncientCalamity } from './definition';

export const scenarios: Scenario[] = [
  { result: "puts 1 +1/+1 counter on the other creature (Jenova's power) and it becomes a Mutant", trigger: 'onBeginCombat', you: { creaturesCount: 1 } },
  { result: 'no other creature present, nothing happens', trigger: 'onBeginCombat', you: { creaturesCount: 0 } },
  { result: 'draws 4 cards (the dying Mutant was power 4)', trigger: 'onMutantDies', triggerInput: { dyingCreaturePower: 4 }, you: { libraryCount: 4 } },
  ...keywordScenarios(jenovaAncientCalamity),
];
