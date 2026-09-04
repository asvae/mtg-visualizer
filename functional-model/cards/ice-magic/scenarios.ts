import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { castFrom: 'hand', mode: 0, opponents: [{ creaturesCount: 1 }], result: "Blizzard: returns the opponent's creature to hand" },
  { castFrom: 'hand', mode: 1, opponents: [{ creaturesCount: 1 }], result: "Blizzara: moves the opponent's creature to their library (top-or-bottom choice not tracked)" },
  { castFrom: 'hand', mode: 2, opponents: [{ creaturesCount: 1 }], result: "Blizzaga: moves the opponent's creature to their library (shuffle not tracked)" },
];
