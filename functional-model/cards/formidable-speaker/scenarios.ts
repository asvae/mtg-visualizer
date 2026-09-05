import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'discards a card, then searches library for a creature card and puts it into hand',
    trigger: 'onEnter',
    you: { handCount: 1, libraryCount: 2, librarySubtypeCount: 1 },
  },
  {
    result: 'no creature card in library — discards but finds nothing',
    trigger: 'onEnter',
    you: { handCount: 1, libraryCount: 2 },
  },
  { result: 'untaps another target permanent', you: { creaturesCount: 1, nontokenCreaturesCount: 1 } },
];
