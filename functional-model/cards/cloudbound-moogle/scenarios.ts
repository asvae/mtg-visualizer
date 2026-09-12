import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // 1 real scenario (2026-09-12, replacing the earlier 2nd "no other
  // creature present, counter goes on self" branch per the user's own
  // explicit call: that branch wasn't a distinct mechanism, just an
  // edge-case variant of the same ETB trigger, and the user asked for
  // Plainscycling in its place if a 2nd scenario is kept at all).
  // Plainscycling checked first and confirmed NOT achievable as a real
  // engine-piloted trace: this engine has zero machinery for an
  // activated-from-hand, discard-this-card-as-cost, library-search
  // ability — `harness.ts`'s `ability`/`activationCost` scenario paths
  // both assume the source permanent is already on the Battlefield
  // (`selfZone` only goes to `'Battlefield'` for those, never a
  // from-Hand activation), and `card.ts`'s `Effect` union has no
  // search/tutor kind at all (only `move`/`dig`, neither of which model
  // "search library for a card of a type, reveal, put into hand,
  // shuffle"). Same real, already-documented gap as Ice Flan's own
  // Islandcycling (migrated today, zero possible trace evidence either)
  // and 4 other pool cards' own *cycling abilities — see this card's
  // `progress.json.knownGaps` and `SYNERGY_DESIGN.md`'s dated entries.
  // Plainscycling's discard-as-cost SINK / tutor-for-Plains SOURCE facts
  // stay as-is (real, textually backed, `verify-synergy.mjs`-exempted,
  // zero trace evidence by design) — this file only drops the redundant
  // self-target scenario, it does not touch those facts.
  //
  // This single scenario sets no top-level `trigger`, so `harness.ts`'s
  // own `selfZone` rule starts this card on the Stack and runs the REAL
  // cast->resolve->enters lifecycle first (real `fn:'cast'`/`fn:'enters'`
  // evidence for the baseline `self-cast`/`self-enters` facts) —
  // `sequence` below then fires `onEnter` AFTER that lifecycle, against
  // the same shared GameState, demonstrating the card's one real ETB
  // branch.
  { result: 'is cast from hand, enters the battlefield, then puts a +1/+1 counter on the other creature', you: { creaturesCount: 1 }, sequence: ['onEnter'] },
];
