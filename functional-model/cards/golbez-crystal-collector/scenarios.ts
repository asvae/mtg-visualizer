import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { golbezCrystalCollector } from './definition';

export const scenarios: Scenario[] = [
  { result: 'surveils 1', trigger: 'onArtifactEnters' },
  { result: 'fewer than 4 artifacts: nothing happens', trigger: 'onEndStep', you: { artifactsCount: 2, graveyardCreatureCount: 1 } },
  {
    result: 'returns the creature card from graveyard to hand (4-7 artifacts, no life loss)',
    trigger: 'onEndStep',
    you: { artifactsCount: 4, graveyardCreatureCount: 1 },
  },
  {
    result: "returns the creature card to hand, then each opponent loses life equal to that card's power (1)",
    trigger: 'onEndStep',
    you: { artifactsCount: 8, graveyardCreatureCount: 1 },
    opponents: [{}],
  },
  ...keywordScenarios(golbezCrystalCollector),
];
