import type { Scenario } from '../../harness';

// Real Forge script (coeurl.txt): `ValidTgts$ Creature.nonEnchantment` — no
// controller restriction at all ("target nonenchantment creature," not
// "target creature an opponent controls"). So no `owner` field belongs on
// this effect: an unrestricted `owner: 'opponents'` would misrepresent the
// real card, which genuinely can target Coeurl's own controller's creatures
// (including itself). What both scenarios below show is a real, standing
// modeling limitation instead — `chooseTarget` always takes the first pool
// candidate (no actual player-choice engine exists here), and `playersFor`
// orders `[you, ...opponents]`, so "self" (the only creature its own
// controller has) is always that first candidate when nothing else forces a
// different pool order. Confirmed NOT a card-text bug; left as-is.
// ONE scenario (2026-09-12, effort-calibration trim — SYNERGY_DESIGN.md's
// own dated entry: a second scenario needs a genuinely different real
// MODE, not another premise producing the identical real outcome). Both
// former scenarios ended in the exact same real behavior (Coeurl taps
// itself) — the dropped one ("only legal target," no opponent creature
// present) didn't demonstrate anything the kept one doesn't already show
// more informatively (a legal alternative target existing and still
// losing to the same real `chooseTarget` limitation).
export const scenarios: Scenario[] = [
  {
    result:
      "taps itself — the card text (\"target nonenchantment creature\") allows this legally (Coeurl is already tapped as an activation cost, but a legal retarget), and chooseTarget's own first-pool-candidate rule picks it over the opponent's creature",
    opponents: [{ creaturesCount: 1 }],
  },
];
