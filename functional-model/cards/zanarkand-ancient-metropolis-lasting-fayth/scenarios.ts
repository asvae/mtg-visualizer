import type { Scenario } from '../../harness';

// The front face's own "enters tapped" scenario was dropped — its facts
// are now covered by verify-synergy.mjs's static-check exemptions (see
// hasStaticLandTapSelfTrigger's doc comment); the back face's own facts
// below still need real scenario evidence.
export const scenarios: Scenario[] = [
  { result: 'creates a 1/1 colorless Hero creature token with three +1/+1 counters on it (3 lands controlled)', face: 'back', castFrom: 'hand', you: { landsCount: 3 } },
  { result: 'creates a 1/1 colorless Hero creature token, no counters (no lands controlled)', face: 'back', castFrom: 'hand' },
];
