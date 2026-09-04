import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'draws a card, then discards a card (the front of hand — this model has no real player choice for which card)', ability: 'cantrip', you: { libraryCount: 1, handCount: 1 } },
  { result: 'draws 3 cards', ability: 'bigDraw', you: { libraryCount: 3 } },
];
