import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { rydiaSummonerOfMist } from './definition';

export const scenarios: Scenario[] = [
  { result: 'discards a card, then draws a card', trigger: 'onLandfall', you: { handCount: 2, libraryCount: 1 } },
  { result: 'no card in hand to discard; still draws a card (documentary-only "if you do" gate)', trigger: 'onLandfall', you: { handCount: 0, libraryCount: 1 } },
  {
    result: 'no legal target (no Saga card of mana value X in the graveyard — this model has no way to seed a subtype/cmc-matching graveyard card), nothing returned',
    xPaid: 2,
    you: { graveyardCreatureCount: 1 },
  },
  ...keywordScenarios(rydiaSummonerOfMist),
];
