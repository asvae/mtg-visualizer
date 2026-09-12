import type { Scenario } from '../../harness';

// One combined scenario, not a bare top-level `trigger:` fire: that would
// skip the real cast->stack->enters lifecycle entirely (harness.ts's own
// `runScenario`/`selfZone` starts `self` directly on the Battlefield for a
// top-level `trigger`), leaving this card's own real cast/entersBattlefield
// SOURCE facts with no trace evidence at all — same real gap minwu-white-
// mage's own scenario comment documents and fixes the same way. Casting for
// real (no top-level `trigger`) plus `sequence` firing the named trigger
// afterward, once Sahagin is genuinely on the battlefield, backs every real
// fact (cast, enters, the +1/+1 counter, the real Unblockable grant) with
// one real trace, still exactly one scenario.
export const scenarios: Scenario[] = [
  {
    result: "is cast and enters the battlefield, then puts a +1/+1 counter on itself and gains Unblockable until end of turn (triggered by casting a real 4+-mana noncreature spell)",
    sequence: ['onCastNoncreatureSpell4Mana'],
  },
];
