import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'draws a card', trigger: 'onEnter', you: { libraryCount: 1 } },
  { result: 'you gain 3 life' },
];
