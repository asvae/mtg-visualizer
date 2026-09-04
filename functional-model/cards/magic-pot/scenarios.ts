import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates a Treasure token', trigger: 'onDies' },
  { result: 'exiles a target card from your own graveyard (this model approximates "any graveyard" as your own — see definition.ts)', you: { graveyardCreatureCount: 1 } },
];
