import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { label: 'equip to a creature', you: { creaturesCount: 2 } },
  {
    label: 'equipped creature deals damage, discarded card MV 3',
    trigger: 'onEquippedDealsDamage',
    opponents: [{}],
    triggerInput: { damagedPlayerIndex: 0, discardedCardManaValue: 3 },
  },
];
