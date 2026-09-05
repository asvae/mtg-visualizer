import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'for each of 2 target permanents, creates 2 token copies of that permanent (4 total)',
    xPaid: 2,
    you: { creaturesCount: 2, nontokenCreaturesCount: 2 },
  },
  { result: 'X is 0 — no targets, no copies', xPaid: 0 },
];
