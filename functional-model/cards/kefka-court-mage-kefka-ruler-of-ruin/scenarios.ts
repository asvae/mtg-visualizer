import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { kefkaCourtMage } from './definition';

export const scenarios: Scenario[] = [
  { result: 'each player discards a card, then you draw 2 cards', trigger: 'onEnter', you: { handCount: 1, libraryCount: 2 }, opponents: [{ handCount: 1 }] },
  { result: 'each player discards a card, then you draw 2 cards', trigger: 'onAttacks', you: { handCount: 1, libraryCount: 2 }, opponents: [{ handCount: 1 }] },
  {
    result: "each opponent sacrifices a permanent, then exiles Kefka and returns it transformed into Kefka, Ruler of Ruin",
    opponents: [{ artifactsCount: 1 }],
  },
  { result: 'draws 5 cards (the opponent lost 5 life)', face: 'back', trigger: 'onOpponentLosesLife', triggerInput: { lifeLostAmount: 5 }, you: { libraryCount: 5 } },
  ...keywordScenarios(kefkaCourtMage),
];
