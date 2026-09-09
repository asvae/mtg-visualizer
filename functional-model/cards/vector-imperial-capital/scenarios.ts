import type { Scenario } from '../../harness';

// Empty — every real ability on this card is already covered by the static
// "known from definition.ts alone" exemptions in scripts/verify-synergy.mjs
// (isStaticOnlyLand-adjacent reasoning): the "enters tapped" replacement
// (isLandEntersTappedSelfFact), its two `addMana` colors (staticManaColorsFor),
// and — as of this pass — its own `playLand` fact too (isSelfPlayableLand):
// a plain land's own "I get played, from hand, when someone plays me" is
// just as tautologically true-by-construction as those other facts, since
// nothing about THIS card's own definition.ts is ambiguous about how it
// reaches the battlefield. The real risk `playLand` guards against is a
// DIFFERENT card fetching/putting a land other than itself onto the
// battlefield without going through CR 305 at all (cards/elven-passage's own
// library fetch, e.g., which correctly declares no `playLand` fact for the
// land it finds) — that stays a real, structural, trace-checked negative
// control; it just isn't a reason to force scenario authorship on every
// ordinary land's own self-play fact.
export const scenarios: Scenario[] = [];
