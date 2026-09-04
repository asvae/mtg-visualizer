import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { shantottoTacticianMagician } from './definition';

export const scenarios: Scenario[] = [
  { result: 'Shantotto gets +4/+0 until end of turn and draws a card (4 mana spent)', trigger: 'onCastNoncreatureSpell', triggerInput: { manaSpent: 4 } },
  { result: 'Shantotto gets +2/+0 until end of turn, no draw (below 4 mana spent)', trigger: 'onCastNoncreatureSpell', triggerInput: { manaSpent: 2 } },
  ...keywordScenarios(shantottoTacticianMagician),
];
