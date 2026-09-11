import type { Scenario } from '../../harness';

// One real, continuous scenario (2026-09-12 migration, standing rule:
// "default to one scenario") in place of 4 near-identical flat scenarios —
// every chapter (I-IV) fires the exact same real `pumpAll` effect
// (definition.ts's own comment on the repeated Forge SVar), so demonstrating
// it once per chapter added nothing chapters II-IV didn't already show.
// `sequence` (harness.ts, built for Summon: Bahamut's own real 714.3a/b
// chapter progression) fires all four named triggers back-to-back against
// ONE shared board state, with no top-level `trigger`/`ability`/
// `activationCost` set — so `lifecycleBefore` still runs the real cast ->
// resolve -> enters lifecycle first (real evidence for the baseline
// self-cast/self-enters facts), then all 4 chapters fire for real (real
// `fn:'pump'` evidence for each), then `sacrificeSelfAfter` fires the real
// 714.4 "Sacrifice after IV" rule action. `you.creaturesCount: 2` seeds two
// OTHER real creatures on the battlefield so `notSelf`'s exclusion is
// genuinely exercised (self never gets pumped) rather than vacuously true
// with nothing else around to pump.
export const scenarios: Scenario[] = [
  {
    result:
      'Choco/Mog enters (714.2b/c fires chapter I immediately); chapters II-IV fire the same real way on later draw steps, each pumping the other 2 creatures you control +1/+0 until end of turn; once chapter IV resolves, 714.4 sacrifices it.',
    sequence: ['chapterI', 'chapterII', 'chapterIII', 'chapterIV'],
    sacrificeSelfAfter: true,
    you: { creaturesCount: 2 },
  },
];
