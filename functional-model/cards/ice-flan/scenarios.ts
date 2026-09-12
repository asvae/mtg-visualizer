import type { Scenario } from '../../harness';

// No top-level `trigger` on any of these (2026-09-12 consolidation, same
// "either one realistic scenario, or 0 scenarios" fix already applied to
// dwarven-castle-guard/cloudbound-moogle — see cloudbound-moogle's own
// scenarios.ts comment for the full mechanism): `harness.ts`'s own
// `selfZone` rule starts Ice Flan on the Stack and runs the REAL
// cast->resolve->enters lifecycle first (real `fn:'cast'`/`fn:'enters'`
// evidence for the baseline `self-cast`/`self-enters` facts), then
// `sequence: ['onEnter']` fires the ETB trigger AFTER that lifecycle,
// against the same shared GameState — demonstrating the card's own real
// tap+stun branches without a separate, purely-boilerplate cast-only
// scenario alongside them. Islandcycling ({2}, Discard this card: search
// for an Island) has no engine-modeled Effect at all (a special action
// from hand, not a cast/activated/triggered ability — same real gap
// Cloudbound Moogle's own Plainscycling documents) and so gets no scenario
// here; it's captured purely via `synergy.json` facts + verify-synergy.mjs's
// `isIceFlanDiscardSelfWant`/`isIceFlanTutorFact` exemptions, same
// treatment as Cloudbound Moogle's own Plainscycling.
export const scenarios: Scenario[] = [
  { result: "taps the opponent's target creature and puts a stun counter on it", opponents: [{ creaturesCount: 1 }], sequence: ['onEnter'] },
  { result: 'no legal target — the opponent controls no creatures, nothing tapped or countered', opponents: [{ creaturesCount: 0 }], sequence: ['onEnter'] },
  {
    result: "with a creature on both sides, still taps only the opponent's — self's own controller isn't a legal target",
    you: { creaturesCount: 1 },
    opponents: [{ creaturesCount: 1 }],
    sequence: ['onEnter'],
  },
];
