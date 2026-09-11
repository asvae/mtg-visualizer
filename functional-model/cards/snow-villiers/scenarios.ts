import type { Scenario } from '../../harness';

// Real lifecycle only, no keywordScenarios() spread (2026-09-12, scenario-
// count standing rule — SYNERGY_DESIGN.md's "default to 1 scenario"):
// Vigilance is recognized-but-inert (see card.ts's own doc comment, and the
// "bare printed keyword, no grant/broadcast, gets no Fact either" standing
// rule) so it has nothing worth a separate probe regardless; the power CDA
// IS real and live (`ptFormula`) and genuinely worth demonstrating, but one
// scenario with 2 other real creatures present already shows it live-
// recalculating (self + 2 = 3, not the printed base) — harness.ts's own flat
// `runScenario` automatically appends a real `read:getNetPower` line for any
// `ptFormula` card once self is on the battlefield, so this single scenario
// already carries real evidence for both the baseline cast/enters facts AND
// the CDA fact, with no extra scenario needed. The old 0-/3-creature CDA
// re-probes and the legend-rule probe (`keywordScenarios`) were dropped as
// redundant under the new default — no fact on this card depends on either.
export const scenarios: Scenario[] = [
  { result: 'enters the battlefield; power CDA sets it to 3 (2 other creatures + self), toughness fixed at 3', you: { creaturesCount: 2 } },
];
