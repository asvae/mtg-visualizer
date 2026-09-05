import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'draws a card', trigger: 'onActivateCreatureAbility' },
  {
    result: 'exiles up to two other nonland permanents you control now, then returns them to the battlefield only once the game reaches the end step (not immediately)',
    you: { creaturesCount: 2, nontokenCreaturesCount: 2 },
    advanceToPhase: 'EndOfTurn',
  },
  { result: 'no other nonland permanents you control — exiles/returns nothing', you: { creaturesCount: 0 } },
];
