import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'your creature (power 3) and the opponent creature (power 2) fight, each dealing damage equal to its power to the other',
    mode: 0,
    you: { creaturesCount: 1, creaturePower: 3 },
    opponents: [{ creaturesCount: 1, creaturePower: 2 }],
  },
  {
    result: 'removes a lore counter from the target Saga you control (this model has no way to seed a pre-existing counter on a chosen, non-self permanent, so the count goes to -1)',
    mode: 1,
    you: { enchantmentsCount: 1 },
  },
  { result: 'puts a lore counter on the target Saga you control', mode: 2, you: { enchantmentsCount: 1 } },
];
