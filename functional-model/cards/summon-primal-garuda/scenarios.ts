import type { Scenario } from '../../harness';

// One real, continuous scenario (standing rule: "default to one scenario"),
// mirroring summon-choco-mog's own real chapter-sequence shape (same batch,
// same day). `sequence` (harness.ts, built for Summon: Bahamut's own real
// 714.3a/b chapter progression) fires all three named triggers back-to-back
// against ONE shared board state, with no top-level `trigger`/`ability`/
// `activationCost` set — so `lifecycleBefore` still runs the real cast ->
// resolve -> enters lifecycle first (real evidence for the baseline
// self-cast/self-enters facts), then chapter I's real Aerial Blast fires
// (real `fn:'dealDamage'` evidence, amount 4), then chapters II/III's real
// Slipstream fires twice (real `fn:'pump'`/`fn:'grantKeyword'` evidence
// each), then `sacrificeSelfAfter` fires the real 714.4 "Sacrifice after
// III" rule.
//
// `opponents: [{ creaturesCount: 1 }]` gives Aerial Blast a real legal
// target (this card's own `custom` effect doesn't engine-enforce the real
// "tapped" restriction — see definition.ts's own comment on why: the fact
// model's own `Constraints.tapped` is documentary-only, same as Fate of
// the Sun-Cryst's identical-shaped condition, so there's no real matching
// benefit to wiring it, only the cost of a scenario with no legal target
// at all under the harness's own generic (untapped) filler). `you:
// {creaturesCount: 2}` seeds one OTHER real creature besides Garuda itself
// so Slipstream's own "another target creature you control" `notSelf`
// exclusion is genuinely exercised (self never gets pumped/granted
// flying) rather than vacuously true with nothing else around to target.
export const scenarios: Scenario[] = [
  {
    result:
      "Garuda enters (714.2b/c fires chapter I immediately) and Aerial Blast deals 4 damage to the opponent's creature; chapters II/III fire the same way on later draw steps, each giving the other creature you control +1/+0 and flying until end of turn; once chapter III resolves, 714.4 sacrifices it.",
    sequence: ['chapterI', 'chapterII', 'chapterIII'],
    sacrificeSelfAfter: true,
    you: { creaturesCount: 2 },
    opponents: [{ creaturesCount: 1 }],
  },
];
