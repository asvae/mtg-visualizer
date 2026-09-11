import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // 2 consolidated scenarios (2026-09-11, same "either one realistic
  // scenario, or 0 scenarios" consolidation the user asked for on
  // dwarven-castle-guard, applied here too since this card hits the
  // identical redundant shape and the fix is a strict improvement with no
  // evidence tradeoff — see that card's own scenarios.ts comment for the
  // full mechanism). Neither scenario sets a top-level `trigger`, so
  // `harness.ts`'s own `selfZone` rule starts this card on the Stack and
  // runs the REAL cast->resolve->enters lifecycle first (real
  // `fn:'cast'`/`fn:'enters'` evidence for the baseline `self-cast`/
  // `self-enters` facts) — `sequence` below then fires `onEnter` AFTER
  // that lifecycle, against the same shared GameState, demonstrating each
  // of the card's own two real branches (a target creature present vs.
  // not) without a third, purely-boilerplate cast-only scenario alongside
  // them.
  { result: 'is cast from hand, enters the battlefield, then puts a +1/+1 counter on the other creature', you: { creaturesCount: 1 }, sequence: ['onEnter'] },
  { result: 'is cast from hand, enters the battlefield; no other creature present, so it puts the +1/+1 counter on itself', you: { creaturesCount: 0 }, sequence: ['onEnter'] },
];
