import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { chocoSeekerOfParadise } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'looks at 2 cards, may put one into hand (the land-to-battlefield-tapped/rest-to-graveyard half is out of scope — see definition.ts)',
    trigger: 'onBirdsAttack',
    triggerInput: { attackingBirdsCount: 2 },
    you: { libraryCount: 2 },
  },
  { result: 'gets +1/+0 until end of turn', trigger: 'onLandfall' },
  ...keywordScenarios(chocoSeekerOfParadise),
];
