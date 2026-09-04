import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'taps the enchanted creature', trigger: 'onEnter', you: { creaturesCount: 1 } },
  { result: 'sacrifices this Aura', trigger: 'onEnchantedDealtDamage' },
];
