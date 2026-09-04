import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { yunaHopeOfSpira } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'no enchantment card in the graveyard (this model has no way to seed a typed graveyard card), no legal target, nothing returned',
    trigger: 'onEndStep',
    you: { graveyardCreatureCount: 1 },
  },
  ...keywordScenarios(yunaHopeOfSpira),
];
