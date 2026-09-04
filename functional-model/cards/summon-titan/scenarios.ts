import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { summonTitan } from './definition';

export const scenarios: Scenario[] = [
  { result: 'mills 5 cards from your library to your graveyard', trigger: 'chapterI', you: { libraryCount: 8 } },
  {
    result: 'no land cards in graveyard (this harness has no way to seed a land-typed graveyard card — see definition.ts), nothing returned',
    trigger: 'chapterII',
    you: { graveyardCreatureCount: 3 },
  },
  {
    result: 'another target creature you control gets +2/+2 and gains trample until end of turn (X = 2 lands you control)',
    trigger: 'chapterIII',
    you: { creaturesCount: 1, landsCount: 2 },
  },
  ...keywordScenarios(summonTitan),
];
