import type { Scenario } from '../../harness';

// ONE scenario (2026-09-12, effort-calibration course-correction — see
// SYNERGY_DESIGN.md's own dated entry: "scenarios demonstrate a card's
// real, basic function for a human reviewer, not unit-test every no-op/
// failure branch"). Dropped the old separate "no second copy found"/"empty
// library" no-op scenarios — neither demonstrates anything about what this
// card DOES, only what happens when it doesn't. `harness.ts`'s
// `PlayerState.libraryNamedCount`/`libraryNamedCard` seeds a real,
// specifically-NAMED library card so the real success path is genuinely
// exercised: the search finds a real second copy, moves it onto the
// battlefield, and taps it (CR 701.19-style search-and-battlefield entry).
// Also folds in the real board premise for the static "+1/+0 as long as
// you control another artifact" clause (`artifactsCount: 1`) — cheap to
// combine into this same scenario rather than a separate one, even though
// it produces no distinguishing trace line (real STATIC TEXT with no
// threshold-CDA engine hook — see isMagitekInfantryArtifactThresholdPumpFact,
// scripts/verify-synergy.mjs).
export const scenarios: Scenario[] = [
  {
    result: 'finds a second copy of Magitek Infantry in the library, puts it onto the battlefield tapped; also controls another artifact (static +1/+0 condition is text-only, no threshold-CDA engine hook)',
    you: { libraryNamedCount: 1, libraryNamedCard: 'Magitek Infantry', libraryCount: 3, artifactsCount: 1 },
  },
];
