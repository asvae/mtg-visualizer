import type { Scenario } from '../../harness';

// One scenario, per SYNERGY_DESIGN.md's "no real branching justification"
// standing rule for a single escalating/tiered-cost effect (as opposed to
// a true "choose one of several different effects" modal like Phoenix
// Down) — Curaga is the most complete real demonstration (the broadcast
// grant AND the lifegain bonus both fire), and every fact on this card
// (self-cast/self-graveyard, both keyword-grant scopes, lifegain, the
// wants-a-permanent-to-target sink) is real, oracle-backed vocabulary that
// doesn't need a second scenario to justify.
export const scenarios: Scenario[] = [
  {
    result: 'creatures and artifacts you control gain hexproof and indestructible until end of turn; you gain 6 life',
    mode: 2,
    you: { creaturesCount: 2, artifactsCount: 1 },
  },
];
