import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'returns a creature card from graveyard to the battlefield tapped', mode: 0, you: { graveyardCreatureCount: 2 } },
  { result: 'no creature card in graveyard, no-op', mode: 0, you: { graveyardCreatureCount: 0 } },
  { result: 'exiles the Zombie', mode: 1, opponents: [{ creaturesCount: 1, creatureSubtypes: ['Zombie'] }] },
  { result: 'no legal Skeleton/Spirit/Zombie target, no-op', mode: 1, opponents: [{ creaturesCount: 1 }] },
];
