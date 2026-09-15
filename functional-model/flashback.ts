// Shared authoring factory for the real "Flashback" alternate cost
// (702.32/CR 118.9) — a plain top-level module, same precedent
// `saga.ts`/`tokens.ts`/`cycling.ts` already establish for "shared logic
// more than one real card definition needs," NOT under
// `functional-model/keywords/` (that tree is the SEPARATE keyword-
// COVERAGE-SCENARIO suite for the Keywords page — `keywords/registry.ts`'s
// own header: "NOT scanned by verify-synergy.mjs or run-scenarios.mjs ...
// no interaction with the per-card fact-matching pipeline" — an
// authoring-time factory used BY card definitions doesn't belong there;
// same reasoning `cycling.ts`'s own header already gives for
// `basicLandcycling`).
//
// **Real, whole-pool check before building this** (not assumed) — grepped
// every real `name: 'Flashback'` `alternateCosts` entry across
// `functional-model/cards/*/definition.ts`: exactly 14 real occurrences
// (dreams-of-laguna, auron-s-inspiration, esper-origins-summon-esper-
// maduin, from-father-to-son, resentful-revelation, call-the-mountain-
// chocobo, memories-returning, gysahl-greens, retrieve-the-esper, random-
// encounter, the-final-days, laughing-mad, sorceress-s-schemes,
// nibelheim-aflame), and — cross-checked directly against
// `flashback-alternateCost-structural.ts`'s own module doc comment (the
// recognizer already built for this shape, same 14-card count) rather than
// re-deriving the same real-pool fact twice — EVERY one of them sets
// `from: 'graveyard', thenExile: true`, one single-entry `alternateCosts`
// array each (never combined with a second alternate cost in the same
// array). **Only `cost` varies.** No real pool card combines `name:
// 'Flashback'` with `from: 'exile'` (a real, different, Jump-start-shaped
// alternate cost) — that recognizer's own doc comment already confirms
// this and correctly declines (scope) rather than guesses a template for
// it; this factory follows the same real, closed scope and only ever
// builds the one confirmed real shape.
import type { AlternateCost } from './card';

/** One `CardDefinition.alternateCosts[]` entry for the real, closed
 * Flashback shape every real pool card uses (`from:'graveyard',
 * thenExile:true` always baked in — see this module's own doc comment for
 * the whole-pool confirmation). Only `cost` (the card's own printed
 * Flashback cost, e.g. `'{3}{U}'`) varies card to card. */
export function flashback(cost: string): AlternateCost {
  return { name: 'Flashback', cost, from: 'graveyard', thenExile: true };
}
