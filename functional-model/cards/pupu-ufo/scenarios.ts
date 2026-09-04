import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'no land-typed hand filler exists in this model to actually match (see definition.ts), so nothing is put onto the battlefield', ability: 'landDrop', you: { handCount: 1 } },
  { result: "this creature's base power becomes equal to the number of Towns you control, until end of turn (not modeled — see definition.ts)", ability: 'becomePowerOfTowns' },
];
