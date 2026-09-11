import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // ONE consolidated scenario (2026-09-12, real hard-failure fix): the
  // earlier 1-scenario migration (top-level `trigger:'onEnter'` only) lost
  // real `read:getCreaturesInPlay` evidence for the "wants a creature you
  // control" sink — dragoon-s-lance's own identical sink relies on a
  // SEPARATE Equip {4}-activation scenario for that evidence, but per the
  // standing "default to 1 scenario" rule (SYNERGY_DESIGN.md), the fix
  // here is to CHAIN both real abilities into one continuous story instead
  // of reintroducing a second scenario. Real, checked constraint: this
  // card's own `activationCost` (Equip {4}) means `harness.ts`'s own
  // `lifecycleBefore`/`selfZone` would AUTOMATICALLY fire an unwanted
  // extra top-level `activate` (and force self straight onto the
  // battlefield with no cast) the instant NEITHER `scenario.trigger` NOR
  // `scenario.ability` is set — real cast/enters evidence can never exist
  // for this shape either way (same reason `isActivationCostPermanentBase
  // lineFact`'s own general exemption covers it), so keeping the top-level
  // `trigger:'onEnter'` (Job select: creates a 1/1 Hero token, auto-
  // attaches to it) is what correctly SKIPS that automatic activate rather
  // than double-firing it. `sequence: [{activate:true}]` then runs the
  // real Equip {4} activation ONCE, for real, right after — it re-attaches
  // this Equipment to the OTHER real creature already on the battlefield
  // (a real vanilla Grizzly Bears, `you: {creaturesCount: 1}` — present
  // BEFORE the trigger creates the Hero token, so it's `getCreaturesInPlay
  // ()`'s own first/default candidate, a genuinely different creature from
  // the one Job select already attached to, not a no-op re-target).
  // Confirmed in the regenerated trace.json: exactly one `equip` to the
  // Hero token (from the trigger), then exactly one more `equip` to
  // Grizzly Bears (from the real activation) — no double-fire.
  {
    result:
      'Job select creates a 1/1 colorless Hero creature token and attaches itself to it, then a real Equip {4} activation re-attaches it to the other creature already on the battlefield instead',
    trigger: 'onEnter',
    you: { creaturesCount: 1 },
    sequence: [{ activate: true }],
  },
];
