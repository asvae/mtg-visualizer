import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'no land-typed library filler exists in this model to actually match (see definition.ts), so nothing is found', ability: 'searchBasic', you: { libraryCount: 2 } },
  { result: 'no land-typed library filler exists in this model to actually match (see definition.ts), so nothing is found', ability: 'searchAny', you: { libraryCount: 2 } },
];
