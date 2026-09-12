import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // ONE consolidated scenario (2026-09-12, real cast-lifecycle fix — user:
  // "1 scenario is enough, also make it use cast, not just some mythical
  // enter"). The previous shape (top-level `trigger:'onEnter'`, matching
  // paladin-s-arms/sage-s-nouliths/white-mage-s-staff/astrologian-s-
  // planisphere's own 2026-09-12 fix) never actually cast this card —
  // `trigger:'onEnter'` starts `self` already on the Battlefield and skips
  // `cast`/`enters` outright, the exact "mythical enter" shortcut flagged.
  // That whole sibling family was stuck there because of a genuine
  // structural harness.ts gap: `lifecycleBefore`/`selfZone` unconditionally
  // treated ANY card with its own `activationCost` (this card's Equip {4})
  // as "only its activated ability is being tested," with no scenario
  // field able to opt back into a real cast — see
  // `isActivationCostPermanentBaselineFact` (verify-synergy.mjs) for the
  // structural writeup this closes. Fixed for real this time: a new
  // `Scenario.forceCast` (harness.ts) makes this scenario go through a
  // genuine `cast` (from Hand) -> `enters` (Battlefield) lifecycle even
  // though this permanent has its own `activationCost`, then `sequence`
  // fires the real Job select ETB trigger (creates the 1/1 Hero token,
  // auto-attaches to it) and finally a real Equip {4} activation
  // re-attaches this Equipment to the OTHER real creature already on the
  // battlefield (`you: {creaturesCount: 1}`, present BEFORE the trigger
  // creates the Hero token, so it's `getCreaturesInPlay()`'s own first/
  // default candidate — genuinely different from the Hero token Job
  // select already attached to, not a no-op re-target). One continuous,
  // real playthrough: cast -> enters -> Job select ETB -> real Equip {4}
  // activation, demonstrating every executable piece of this card (the
  // static "+1/+0 and is a Knight"/"during your turn, flying" clauses stay
  // real Facts, honest-but-structurally-inert per definition.ts's own
  // comment — no continuous-effect pipeline exists in this model for a
  // static bonus/type-grant broadcast from an Equipment to whatever it's
  // attached to).
  {
    result:
      'cast from hand and enters the battlefield, Job select creates a 1/1 colorless Hero creature token and attaches itself to it, then an Equip {4} activation re-attaches it to the other creature already on the battlefield instead',
    forceCast: true,
    you: { creaturesCount: 1 },
    sequence: ['onEnter', { activate: true }],
  },
];
