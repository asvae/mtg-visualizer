import type { Scenario } from '../../harness';

// The front face's own "enters tapped" scenario was dropped — its facts
// are now covered by verify-synergy.mjs's static-check exemptions (see
// hasStaticLandTapSelfTrigger's doc comment); the back face's own facts
// below still need real scenario evidence.
export const scenarios: Scenario[] = [
  {
    result: 'creates a 0/1 black Wizard creature token (its granted "deals 1 damage on noncreature cast" ability is not modeled — see definition.ts)',
    face: 'back',
    castFrom: 'hand',
  },
];
