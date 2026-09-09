import type { Scenario } from '../../harness';

// Empty: this card's own facts are all covered by verify-synergy.mjs's
// static-check exemptions (see its own isStaticOnlyLand/
// hasStaticLandTapSelfTrigger doc comments) — no scenario/trace evidence
// is required to reconcile them.
export const scenarios: Scenario[] = [];
