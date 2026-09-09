import type { Scenario } from '../../harness';

// The front face's own "enters tapped" scenario was dropped — its facts
// are now covered by verify-synergy.mjs's static-check exemptions (see
// hasStaticLandTapSelfTrigger's doc comment); the back face's own facts
// below still need real scenario evidence.
export const scenarios: Scenario[] = [
  { result: 'mills 3 cards (opponent has 7 in library, half rounded down)', face: 'back', castFrom: 'hand', opponents: [{ libraryCount: 7 }] },
  { result: 'mills 0 cards (opponent has an empty library)', face: 'back', castFrom: 'hand', opponents: [{}] },
];
