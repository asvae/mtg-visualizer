import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { tellahGreatSage } from './definition';

export const scenarios: Scenario[] = [
  { result: 'creates a 1/1 Hero token; below 4 mana spent, no draw, no sacrifice', trigger: 'onCastNoncreatureSpell', triggerInput: { manaSpent: 2 } },
  { result: 'creates a 1/1 Hero token and draws 2 cards; below 8 mana spent, no sacrifice', trigger: 'onCastNoncreatureSpell', triggerInput: { manaSpent: 4 }, you: { libraryCount: 2 } },
  {
    result: 'creates a 1/1 Hero token, draws 2 cards, then sacrifices Tellah and it deals 8 damage to each opponent',
    trigger: 'onCastNoncreatureSpell',
    triggerInput: { manaSpent: 8 },
    you: { libraryCount: 2 },
    opponents: [{}],
  },
  ...keywordScenarios(tellahGreatSage),
];
