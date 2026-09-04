import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { emetSelchUnsundered } from './definition';

export const scenarios: Scenario[] = [
  { result: 'draws a card, then discards a card', trigger: 'onEnter', you: { libraryCount: 1, handCount: 1 } },
  { result: 'draws a card, then discards a card', trigger: 'onAttacks', you: { libraryCount: 1, handCount: 1 } },
  { result: 'transforms into Hades, Sorcerer of Eld (14+ cards in the graveyard)', trigger: 'onUpkeep', you: { graveyardCreatureCount: 14 } },
  { result: 'stays Emet-Selch, Unsundered (fewer than 14 cards in the graveyard)', trigger: 'onUpkeep', you: { graveyardCreatureCount: 5 } },
  ...keywordScenarios(emetSelchUnsundered),
];
