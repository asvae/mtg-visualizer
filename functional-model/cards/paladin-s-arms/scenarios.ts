import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // ONE consolidated scenario (2026-09-13, real cast-lifecycle fix — this
  // is the exact fin/28 regression the user reported: "should have been
  // cast, onEnter trigger doesn't magically trigger"). The prior shape
  // (top-level `trigger:'onEnter'`, added 2026-09-12 to fix a DIFFERENT,
  // real `read:getCreaturesInPlay` hard failure) started `self` already on
  // the Battlefield and skipped `cast`/`enters` outright — the same
  // "mythical enter" shortcut dragoon-s-lance's own sibling regression
  // documents. Fixed the same real way: `Scenario.forceCast` (harness.ts)
  // makes this scenario go through a genuine `cast` (from Hand) -> `enters`
  // (Battlefield) lifecycle even though this permanent has its own
  // `activationCost` (Equip {4}), then `sequence` fires the real Job select
  // ETB trigger (creates the 1/1 Hero token, auto-attaches to it) and
  // finally a real Equip {4} activation re-attaches this Equipment to the
  // OTHER real creature already on the battlefield (`you: {creaturesCount:
  // 1}`, present BEFORE the trigger creates the Hero token, so it's
  // `getCreaturesInPlay()`'s own first/default candidate — genuinely
  // different from the Hero token Job select already attached to, not a
  // no-op re-target, and still real `read:getCreaturesInPlay` evidence for
  // the "wants a creature you control" sink the 2026-09-12 fix was
  // protecting). One continuous, real playthrough: cast -> enters -> Job
  // select ETB -> real Equip {4} activation.
  {
    result:
      'cast from hand and enters the battlefield, Job select creates a 1/1 colorless Hero creature token and attaches itself to it, then an Equip {4} activation re-attaches it to the other creature already on the battlefield instead',
    forceCast: true,
    you: { creaturesCount: 1 },
    sequence: ['onEnter', { activate: true }],
  },
];
