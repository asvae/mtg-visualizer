import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { theWaterCrystal } from './definition';

// {4}{U}{U}, {T}: Each opponent mills cards equal to the number of cards in
// your hand — the real, mechanically-modeled base mill amount (below, both
// scenarios show it scaling with real hand size). The cost-reduction clause
// ("Blue spells you cast cost {1} less to cast") is ALSO now real
// (spellCostReductionGrants, same mechanism ENGINE_GAPS.md gap #7's own
// second example/The Wind Crystal's White-spell discount use) but gets no
// scenario of its own here — same "real mechanism, zero possible trace
// evidence given THIS card's own scenario shape" treatment progress.json's
// own notes explain (this card's own activation never casts a second spell
// for the discount to apply to). The mill-doubling replacement ("mill that
// many cards plus four instead.") is NOT modeled at all — no scenario can
// demonstrate it (see definition.ts's own comment, ENGINE_GAPS.md gap #19).
export const scenarios: Scenario[] = [
  {
    result: 'each opponent mills 3 cards (equal to your hand size)',
    you: { handCount: 3 },
    opponents: [{ libraryCount: 5 }],
  },
  {
    result: 'no cards in your hand, opponent mills nothing',
    you: { handCount: 0 },
    opponents: [{ libraryCount: 5 }],
  },
  ...keywordScenarios(theWaterCrystal),
];
