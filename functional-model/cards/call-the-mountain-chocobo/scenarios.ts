import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    castFrom: 'hand',
    you: { libraryCount: 3 },
    result: "creates a 2/2 green Bird token; the Mountain search finds no candidate (no scenario field can seed a land-typed library card — see definition.ts comment)",
  },
  {
    castFrom: 'graveyard',
    result: 'cast via Flashback for {5}{R}; creates the Bird token, then Call the Mountain Chocobo is exiled instead of going to the graveyard',
  },
];
