import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'reveals the top library card, puts it into hand, and loses 3 life (its mana value)',
    trigger: 'onUpkeep',
    you: { libraryCount: 5 },
    triggerInput: { revealedCardManaValue: 3 },
  },
  {
    result: 'reveals a 0-mana-value card, puts it into hand, loses no life',
    trigger: 'onUpkeep',
    you: { libraryCount: 5 },
    triggerInput: { revealedCardManaValue: 0 },
  },
];
