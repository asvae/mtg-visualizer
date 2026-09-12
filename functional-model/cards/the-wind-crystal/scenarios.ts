import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { theWindCrystal } from './definition';

// {4}{W}{W}, {T}: Creatures you control gain flying and lifelink until end
// of turn — the activated ability, mechanically real via `grantKeywordAll`.
// "If you would gain life, you gain twice that much life instead." — ALSO
// now mechanically real (ENGINE_GAPS.md gap #8b, closed): a second real
// scenario demonstrates it via `Scenario.playerGainsLife` (a synthetic
// probe, same shape `dealsCombatDamage` already establishes for Lifelink —
// no card ability of THIS card's own actually causes lifegain, only
// doubles someone else's, so a real-but-unspecified lifegain source is the
// only way to exercise the replacement at all). The cost-reduction clause
// is ALSO now real (ENGINE_GAPS.md gap #7's own second example,
// `spellCostReductionGrants`) but gets no scenario of its own here — same
// "real mechanism, zero possible trace evidence given THIS card's own
// scenario shape" treatment `progress.json`'s own notes explain (this
// card's own activation never casts a second spell for the discount to
// apply to).
export const scenarios: Scenario[] = [
  {
    result: 'activates {4}{W}{W}, {T}: creatures you control (2 Grizzly Bears) gain flying and lifelink until end of turn',
    you: { creaturesCount: 2 },
  },
  {
    result: 'a real lifegain event (3 life) is genuinely DOUBLED to 6 by this card\'s own presence on the battlefield (CR 614.2)',
    playerGainsLife: { amount: 3 },
  },
  ...keywordScenarios(theWindCrystal),
];
