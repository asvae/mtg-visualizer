import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'mills 2 cards, then returns one permanent card from the graveyard to hand (the meld ability is out of scope — see definition.ts)',
    trigger: 'onEnter',
    you: { libraryCount: 2 },
  },
];
