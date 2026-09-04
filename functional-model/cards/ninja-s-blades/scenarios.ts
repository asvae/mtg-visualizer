import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'attaches to a creature you control', you: { creaturesCount: 2 } },
  {
    result: 'draws a card, discards a card, target opponent loses 3 life',
    trigger: 'onEquippedDealsDamage',
    opponents: [{}],
    triggerInput: { damagedPlayerIndex: 0, discardedCardManaValue: 3 },
  },
];
