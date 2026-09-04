import type { Scenario } from '../../harness';

// `PlayerState` (harness.ts) has no field to seed a LAND card into the
// graveyard specifically (only `graveyardCreatureCount` exists) — so the
// real "repeat if the exiled card was a land" branch can't be independently
// demonstrated here, only documented in definition.ts's own comment. Same
// class of gap several other cards in this corpus already carry (no
// PlayerState field for a typed library/graveyard card).
export const scenarios: Scenario[] = [
  { trigger: 'onEnterOrAttacks', you: { graveyardCreatureCount: 1 }, result: 'exiles the creature card from the graveyard and creates a tapped token copy of it' },
  { trigger: 'onEnterOrAttacks', you: { graveyardCreatureCount: 0 }, result: 'empty graveyard, nothing to exile' },
];
