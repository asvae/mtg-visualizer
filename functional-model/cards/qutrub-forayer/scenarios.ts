import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'destroys the target creature (damage-this-turn not tracked — approximated as any creature)', trigger: 'onEnter', mode: 0, opponents: [{ creaturesCount: 1 }] },
  { result: 'exiles up to 2 cards from your graveyard', trigger: 'onEnter', mode: 1, you: { graveyardCreatureCount: 2 } },
  { result: 'only 1 card in your graveyard — exiles that one', trigger: 'onEnter', mode: 1, you: { graveyardCreatureCount: 1 } },
];
