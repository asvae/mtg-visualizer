import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // No PlayerState field seeds a non-creature graveyard card (only
  // `graveyardCreatureCount` exists) — the real "return target instant or
  // sorcery" success case can't be scenario-tested at all with this
  // harness. This is the only honest scenario available: empty graveyard,
  // no legal target.
  { result: 'no instant/sorcery card in graveyard, nothing to return', castFrom: 'hand' },
];
