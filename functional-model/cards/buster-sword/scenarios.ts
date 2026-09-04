import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'attaches to the target creature you control', you: { creaturesCount: 2 } },
  { result: 'draws a card (the free-cast clause is not modeled)', trigger: 'onEquippedDealsDamage' },
];
