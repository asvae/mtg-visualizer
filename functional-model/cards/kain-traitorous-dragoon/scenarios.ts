import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'the opponent gains control of Kain; you draw 2 cards, create 2 tapped Treasure tokens, then lose 2 life',
    trigger: 'onDealsDamage',
    opponents: [{}],
    triggerInput: { damagedPlayerIndex: 0, damageAmount: 2 },
  },
  {
    result: 'the opponent gains control of Kain; you draw 5 cards, create 5 tapped Treasure tokens, then lose 5 life',
    trigger: 'onDealsDamage',
    opponents: [{}],
    triggerInput: { damagedPlayerIndex: 0, damageAmount: 5 },
  },
];
