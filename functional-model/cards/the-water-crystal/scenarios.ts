import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { theWaterCrystal } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'each opponent mills 3 cards (equal to your hand size)',
    you: { handCount: 3 },
    opponents: [{ libraryCount: 5 }],
  },
  {
    result: 'no cards in your hand, opponent mills nothing',
    you: { handCount: 0 },
    opponents: [{ libraryCount: 5 }],
  },
  ...keywordScenarios(theWaterCrystal),
];
