import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'mills 3 cards from your library into your graveyard, you gain 3 life', trigger: 'onEnter', you: { libraryCount: 5 } },
];
