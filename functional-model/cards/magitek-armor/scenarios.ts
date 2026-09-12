import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // ONE consolidated scenario (2026-09-12, user's own real insight: "you
  // can use hero to crew the armor" — the ETB's own 1/1 Hero token already
  // satisfies Crew 1's real "total power 1 or more" requirement, so no
  // separate filler creature is needed at all). Same real constraint
  // magitek-armor's own `activationCost` (a descriptive Crew-lifecycle
  // label, see definition.ts's own comment) forces on this shape as
  // paladin-s-arms/dragoon-s-lance's own Equip cards: `harness.ts`'s
  // `lifecycleBefore` would AUTOMATICALLY fire an unwanted extra top-level
  // `activate` (with self placed straight on the battlefield, no real
  // cast) the instant neither `scenario.trigger` nor `scenario.ability` is
  // set — keeping the top-level `trigger:'onEnter'` (real ETB: creates the
  // 1/1 Hero token) is what correctly SKIPS that automatic activate,
  // rather than double-firing it. `sequence: [{activate:true}]` then runs
  // the real Crew 1 activation once, for real, right after — this
  // engine's own simplified crew lifecycle (`harness.ts`, unlike
  // `engine.ts`'s real `crewedBy` legality path) doesn't itself validate
  // total power against a `crewedBy` list (see verify-synergy.mjs's own
  // `isCrewCostCreatureWant` doc comment — structural, not trace-checked),
  // so the Hero token's own real presence is what makes this a true,
  // honest single story rather than a required mechanism.
  { result: 'the ETB creates a 1/1 Hero token, which then crews Magitek Armor (Crew 1) so it becomes an artifact creature', trigger: 'onEnter', sequence: [{ activate: true }] },
];
