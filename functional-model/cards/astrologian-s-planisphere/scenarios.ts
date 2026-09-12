import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // ONE consolidated scenario (2026-09-13, real cast-lifecycle fix — the
  // same fin/28 (paladin-s-arms) regression the user reported: "should
  // have been cast, onEnter trigger doesn't magically trigger"). This card
  // was the one sibling in the Job-select-Equipment family that never even
  // got the 2026-09-12 "chain into one continuous story" retrofit
  // (paladin-s-arms/machinist-s-arsenal/etc's own fix) — it still had TWO
  // separate scenarios, the first a bare `trigger:'onEnter'` (the exact
  // "mythical enter" shortcut dragoon-s-lance's own regression documents:
  // starts `self` already on the Battlefield, skips `cast`/`enters`
  // outright) and the second a bare-activate scenario relying on
  // `harness.ts`'s own automatic top-level `activate` (this card's
  // `activationCost`, Equip {2}) with no cast lifecycle either. Replaced
  // with the same real fix every sibling now uses: `Scenario.forceCast`
  // (harness.ts) makes this scenario go through a genuine `cast` (from
  // Hand) -> `enters` (Battlefield) lifecycle even though this permanent
  // has its own `activationCost`, then `sequence` fires the real Job
  // select ETB trigger (creates the 1/1 Hero token, auto-attaches to it)
  // and finally a real Equip {2} activation re-attaches this Equipment to
  // the OTHER real creature already on the battlefield (`you:
  // {creaturesCount: 1}`, present BEFORE the trigger creates the Hero
  // token, so it's `getCreaturesInPlay()`'s own first/default candidate —
  // genuinely different from the Hero token Job select already attached
  // to, not a no-op re-target, and still real `read:getCreaturesInPlay`
  // evidence for the "wants a creature you control" sink the old second
  // scenario was providing). One continuous, real playthrough: cast ->
  // enters -> Job select ETB -> real Equip {2} activation.
  {
    result:
      'cast from hand and enters the battlefield, Job select creates a 1/1 colorless Hero creature token and attaches itself to it, then an Equip {2} activation re-attaches it to the other creature already on the battlefield instead',
    forceCast: true,
    you: { creaturesCount: 1 },
    sequence: ['onEnter', { activate: true }],
  },
];
