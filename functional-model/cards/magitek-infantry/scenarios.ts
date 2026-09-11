import type { Scenario } from '../../harness';

// `harness.ts`'s `PlayerState.libraryNamedCount`/`libraryNamedCard` (added
// alongside this card's own migration) seeds a real, specifically-NAMED
// library card — before this, no PlayerState field could seed one (every
// generated library card was named `<player>-library-<i>`, never "Magitek
// Infantry"), so the "found a second copy" branch of this card's own tutor
// ability couldn't be exercised at all. The scenario below now demonstrates
// the real success path: the search finds a genuine second copy, moves it
// onto the battlefield, and taps it (CR 701.19-style search-and-battlefield
// entry). The other two scenarios keep exercising the real, common
// no-match cases (no second copy in library; empty library).
export const scenarios: Scenario[] = [
  {
    result: 'finds a second copy of Magitek Infantry in the library, puts it onto the battlefield tapped',
    you: { libraryNamedCount: 1, libraryNamedCard: 'Magitek Infantry', libraryCount: 3 },
  },
  { result: 'no second copy found in library, no-op', you: { libraryCount: 3 } },
  { result: 'empty library, no-op', you: { libraryCount: 0 } },
  // The static "gets +1/+0 as long as you control another artifact"
  // condition (Gaelicat's own identical-shaped "as long as you control two
  // or more artifacts" threshold has no engine hook either — see
  // isGaelicatArtifactThresholdPumpFact/isMagitekInfantryArtifactThresholdPumpFact,
  // scripts/verify-synergy.mjs) is real STATIC TEXT with no threshold-CDA
  // machinery in this engine — this scenario documents the real board
  // premise (a second real artifact present) for the replay UI even though
  // it produces no distinguishing trace line versus the scenario above.
  {
    result: 'controls another real artifact; static pump condition is text-only (no threshold-CDA engine hook — see isMagitekInfantryArtifactThresholdPumpFact)',
    you: { artifactsCount: 1, libraryCount: 3 },
  },
];
