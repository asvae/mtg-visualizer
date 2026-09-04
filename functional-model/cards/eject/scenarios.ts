import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { castFrom: 'hand', opponents: [{ creaturesCount: 1 }], result: "returns the opponent's nonland permanent (a creature) to hand and draws a card" },
  { castFrom: 'hand', opponents: [{ artifactsCount: 1 }], result: "returns the opponent's nonland permanent (an artifact) to hand and draws a card" },
  { castFrom: 'hand', opponents: [{}], result: 'no legal nonland permanent to target; nothing bounced, but still draws a card' },
];
