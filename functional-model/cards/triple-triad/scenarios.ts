import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'you and each opponent exile the top card of their library (the free-cast permission grant is not modeled)',
    trigger: 'onUpkeep',
    you: { libraryCount: 2 },
    opponents: [{ libraryCount: 2 }],
  },
];
