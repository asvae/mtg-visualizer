import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { zodiarkUmbralGod } from './definition';

export const scenarios: Scenario[] = [
  {
    result:
      'each player sacrifices 2 of their own creatures (half of 4 non-God creatures each, rounded down) — Zodiark itself excluded from both the count and the sacrifice pool',
    trigger: 'onEnter',
    you: { creaturesCount: 4 },
    opponents: [{ creaturesCount: 4 }],
  },
  {
    result: 'too few non-God creatures on either side to halve into a whole one, nobody sacrifices',
    trigger: 'onEnter',
    you: { creaturesCount: 1 },
    opponents: [{ creaturesCount: 1 }],
  },
  { result: 'puts a +1/+1 counter on Zodiark', trigger: 'onCreatureSacrificed' },
  ...keywordScenarios(zodiarkUmbralGod),
];
