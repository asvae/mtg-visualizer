import type { Scenario } from '../../harness';

// The front face's own "enters tapped" scenario was dropped — its facts
// are now covered by verify-synergy.mjs's static-check exemptions (see
// hasStaticLandTapSelfTrigger's doc comment); the back face's own facts
// below still need real scenario evidence.
export const scenarios: Scenario[] = [
  {
    result: 'sacrifices a creature, then draws 2 cards',
    face: 'back',
    castFrom: 'hand',
    you: { creaturesCount: 1, libraryCount: 2 },
  },
];
