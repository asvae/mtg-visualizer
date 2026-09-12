import type { Scenario } from '../../harness';

// One real, continuous scenario (2026-09-12 default-1-scenario standing
// rule), same treatment summon-choco-mog's own migration just established
// for the identical Saga shape (I-IV repeat one real ability, V is the
// distinct finale, then 714.4 sacrifice). `sequence` fires all five named
// chapter triggers back-to-back against ONE shared, real board state, with
// no top-level `trigger`/`ability`/`activationCost` set — so `lifecycleBefore`
// still runs the real cast -> resolve -> enters lifecycle first (real
// evidence for the baseline self-cast/self-enters facts), then chapters
// I-IV each really create three 2/2 white Knight tokens (the SAME real
// repeated Forge SVar, definition.ts's own comment) — up to 12 real tokens
// on the battlefield by the time chapter V fires, no external filler needed
// since this card's own effect supplies its own "other creatures" — then
// chapter V (Ultimate End) really pumps and grants an indestructible
// counter to every one of them, then `sacrificeSelfAfter` fires the real
// 714.4 "Sacrifice after V" rule action.
export const scenarios: Scenario[] = [
  {
    result:
      'Knights of Round enters (714.2b/c fires chapter I immediately, creating three 2/2 white Knight tokens); chapters II-IV fire the same way on later draw steps, each creating three more (up to 12 total); chapter V — Ultimate End — pumps every other creature you control (the Knight tokens) +2/+2 until end of turn and puts an indestructible counter on each of them; once chapter V resolves, 714.4 sacrifices it.',
    sequence: ['chapterI', 'chapterII', 'chapterIII', 'chapterIV', 'chapterV'],
    sacrificeSelfAfter: true,
  },
];
