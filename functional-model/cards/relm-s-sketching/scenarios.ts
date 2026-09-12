import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    castFrom: 'hand',
    you: { creaturesCount: 1, creaturePower: 4 },
    result: "targets the creature on the battlefield and creates a token that's a copy of it (same name, types, power, and toughness)",
  },
];
