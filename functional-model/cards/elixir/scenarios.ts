import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'enters tapped', trigger: 'onEnter' },
  { result: '2 nonland cards shuffled from graveyard into library; gains 2 life', you: { graveyardCreatureCount: 2 } },
  { result: 'no cards in graveyard, nothing shuffled, no life gained', you: { graveyardCreatureCount: 0 } },
];
