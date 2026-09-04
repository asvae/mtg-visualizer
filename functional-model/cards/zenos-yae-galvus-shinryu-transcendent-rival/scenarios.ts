import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { zenosYaeGalvus } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'chooses an opponent creature; every other creature (both players\', except Zenos and the chosen one) gets -2/-2 until end of turn',
    trigger: 'onEnter',
    you: { creaturesCount: 1 },
    opponents: [{ creaturesCount: 2 }],
  },
  { result: 'no opponent creature to choose, no resolvable effect', trigger: 'onEnter', opponents: [{ creaturesCount: 0 }] },
  { result: 'the chosen creature left the battlefield: Zenos transforms into Shinryu (represented as exile-then-return)', trigger: 'onChosenCreatureLeaves' },
  {
    result: 'Burning Chains — no resolvable effect in this model (loses-the-game and chosen-player tracking are both missing — see this batch\'s final report)',
    face: 'back',
    trigger: 'onChosenPlayerLosesGame',
  },
  ...keywordScenarios(zenosYaeGalvus),
];
