import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { theEmperorOfPalamecia } from './definition';

export const scenarios: Scenario[] = [
  { result: 'less than four mana spent: no effect', trigger: 'onNoncreatureSpellCast', triggerInput: { manaSpent: 2 } },
  {
    result: 'four or more mana spent: puts a +1/+1 counter on itself (now at 3, so it transforms into The Lord Master of Hell)',
    trigger: 'onNoncreatureSpellCast',
    triggerInput: { manaSpent: 4 },
    selfCounters: { '+1/+1': 2 },
  },
  {
    result: 'four or more mana spent: puts a +1/+1 counter on itself (now at 1, not enough to transform)',
    trigger: 'onNoncreatureSpellCast',
    triggerInput: { manaSpent: 4 },
  },
  {
    result: 'no noncreature, nonland cards in the graveyard: deals 0 damage to each opponent',
    face: 'back',
    trigger: 'onAttacks',
    opponents: [{}],
  },
  ...keywordScenarios(theEmperorOfPalamecia),
];
