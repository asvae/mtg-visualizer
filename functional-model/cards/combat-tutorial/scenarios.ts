import type { Scenario } from '../../harness';

// One scenario, per SYNERGY_DESIGN.md's own "default 1, basic function
// only" rule — this card has exactly one real mode (no "Choose one"/tiered
// branching), so its own real, basic function (cast, draw, put a counter on
// a creature you control) is enough; the "no legal creature to target"
// no-op edge case doesn't get its own scenario (same anti-pattern the rule
// calls out for magitek-infantry's own tutor no-op branch).
export const scenarios: Scenario[] = [
  { result: 'draws 2 cards; puts a +1/+1 counter on the one target creature you control', castFrom: 'hand', you: { creaturesCount: 1 } },
];
