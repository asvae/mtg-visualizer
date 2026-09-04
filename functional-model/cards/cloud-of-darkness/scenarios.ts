import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { cloudOfDarkness } from './definition';

export const scenarios: Scenario[] = [
  {
    result: "target creature an opponent controls gets -3/-3 until end of turn (3 permanent cards in this player's graveyard)",
    trigger: 'onEnter',
    you: { graveyardCreatureCount: 3 },
    opponents: [{ creaturesCount: 1 }],
  },
  {
    result: 'no permanent cards in the graveyard: target creature an opponent controls gets -0/-0',
    trigger: 'onEnter',
    opponents: [{ creaturesCount: 1 }],
  },
  ...keywordScenarios(cloudOfDarkness),
];
