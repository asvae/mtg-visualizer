import type { Scenario } from '../../harness';

// One real scenario (standing rule: "default to one scenario") — Magic
// Damper's three clauses (pump, hexproof grant, untap) all resolve
// simultaneously against the SAME chosen target, not three branching modes,
// so this is real basic function, not an edge case needing its own
// scenario. The old "no legal target" no-op branch is dropped per the same
// standing rule (a defensive/no-op variant of the single real mode adds no
// distinguishing evidence — see SYNERGY_DESIGN.md's own magitek-infantry
// worked example).
export const scenarios: Scenario[] = [
  {
    result: 'pumps your target creature +1/+1, grants it hexproof until end of turn, and untaps it',
    castFrom: 'hand',
    you: { creaturesCount: 1 },
    opponents: [{ creaturesCount: 1 }],
  },
];
