import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'every creature on the battlefield, yours and the opponent\'s alike, gets -1/-1',
    castFrom: 'hand',
    mode: 0,
    you: { creaturesCount: 1 },
    opponents: [{ creaturesCount: 1 }],
  },
  { result: 'the opponent discards a card (front of hand — no real player choice of which)', castFrom: 'hand', mode: 1, opponents: [{ handCount: 1 }] },
];
