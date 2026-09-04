import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { theWanderingMinstrel } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'fewer than five Towns controlled (this model has no way to seed a Town-subtype land) — no token created',
    trigger: 'onBeginCombat',
    you: { landsCount: 3 },
  },
  {
    result: 'no Towns controlled — other creatures you control get +0/+0 until end of turn',
    you: { creaturesCount: 2 },
  },
  ...keywordScenarios(theWanderingMinstrel),
];
