import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // ONE consolidated scenario (2026-09-12, unified Fact model migration;
  // then 2026-09-13, real cast-lifecycle fix — the same fin/28
  // (paladin-s-arms) regression the user reported: "should have been cast,
  // onEnter trigger doesn't magically trigger"). The prior shape (top-level
  // `trigger:'onEnter'`) started `self` already on the Battlefield and
  // skipped `cast`/`enters` outright — the "mythical enter" shortcut
  // dragoon-s-lance's own sibling regression documents. Fixed the same real
  // way: `Scenario.forceCast` (harness.ts) makes this scenario go through a
  // genuine `cast` (from Hand) -> `enters` (Battlefield) lifecycle even
  // though this permanent has its own `activationCost` (Equip {3}). Job
  // select creates the Hero token and auto-attaches (now the first
  // `sequence` step, `'onEnter'`, rather than the scenario's top-level
  // `trigger`), then a real Equip {3} activation re-attaches it to the
  // other creature already on the battlefield (`you: {creaturesCount: 1}`,
  // present BEFORE the trigger creates the Hero token, so it's
  // `getCreaturesInPlay()`'s own first/default candidate), then the granted
  // "whenever this creature attacks, untap target attacking creature"
  // ability fires (`onEquippedAttacks`, modeled as Sage's Nouliths' own
  // trigger — see definition.ts) and untaps that same creature. This single
  // chain gives real trace evidence for both sink wants at once:
  // `onEquippedAttacks`'s own `chooseTarget` pool reads BOTH
  // `you.getCreaturesInPlay()` (the Equip-target want) and every opponent's
  // `getCreaturesInPlay()` (the "or an attacking creature an opponent
  // controls" want) even though no opponent creature is present here (a
  // real `read:getCreaturesInPlay` line with `count:0` still counts as real
  // evidence — verify-synergy.mjs never checks `controller` on a sink's own
  // supporting read).
  {
    result:
      'cast from hand and enters the battlefield, Job select creates a 1/1 colorless Hero creature token and attaches itself to it, then an Equip {3} activation re-attaches it to the other creature already on the battlefield, whose attack then untaps a target attacking creature',
    forceCast: true,
    you: { creaturesCount: 1 },
    sequence: ['onEnter', { activate: true }, 'onEquippedAttacks'],
  },
];
