import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { ultrosObnoxiousOctopus } from './definition';

// No top-level `trigger` on the first two scenarios (same
// dwarven-castle-guard/cloudbound-moogle/ice-flan consolidation —
// see ice-flan/scenarios.ts's own comment for the full mechanism):
// `harness.ts`'s own `selfZone` rule starts Ultros on the Stack and runs the
// REAL cast->enters lifecycle first (real `fn:'cast'`/`fn:'enters'` evidence
// for the baseline `self-cast`/`self-enters` facts), then `sequence` fires
// the named trigger(s) AFTER that lifecycle, against the same shared
// GameState.
//
// The two triggers are two INDEPENDENT thresholds on the same real trigger
// condition ("cast a noncreature spell, if at least N mana was spent"), not
// a modal choice — one scenario casting a single big enough (8+ mana)
// noncreature spell genuinely fires BOTH (a real spell that spent 8+ mana
// also spent 4+), so one `sequence` naturally demonstrates both real
// effects without inventing two redundant "just the threshold" scenarios.
export const scenarios: Scenario[] = [
  {
    result:
      'enters the battlefield; later, an opponent creature is present when you cast a big enough noncreature spell — both mana-spent thresholds are met at once, so it taps and stuns the opponent creature, then puts 8 +1/+1 counters on itself',
    opponents: [{ creaturesCount: 1 }],
    sequence: ['onNoncreatureSpellCastGE4Mana', 'onNoncreatureSpellCastGE8Mana'],
  },
  {
    result: 'no opponent creature present — the 4-mana threshold trigger fires but finds no legal target',
    sequence: ['onNoncreatureSpellCastGE4Mana'],
  },
  ...keywordScenarios(ultrosObnoxiousOctopus),
];
