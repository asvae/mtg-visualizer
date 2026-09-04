import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    label: 'deals 2 combat damage to opponent 0',
    trigger: 'onDealsDamage',
    opponents: [{}],
    triggerInput: { damagedPlayerIndex: 0, damageAmount: 2 },
  },
  {
    label: 'deals 5 combat damage to opponent 0',
    trigger: 'onDealsDamage',
    opponents: [{}],
    triggerInput: { damagedPlayerIndex: 0, damageAmount: 5 },
  },
];
