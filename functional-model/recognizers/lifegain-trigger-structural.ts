// New recognizer (`PRD_AUTOMATED_AUTHORING.md`, 2026-09-13, tier-3
// elimination pass for fin/1-5) — text-based, like Recognizers A/B: "Whenever
// you gain life, <effect>" — the trigger's own firing PRECONDITION, a SINK
// this card carries no other structural field to express (the effect that
// fires is often a plain declarative `putCounter` with no `custom` closure
// at all — `aerith-gainsborough`'s own `onLifeGained` trigger, e.g. — so
// there is no `Effect`-shape signal anywhere to read this off of;
// `CardDefinition.authoredFacts`, per its own doc comment, exists
// specifically for this "no single owning Effect" shape).
//
// **Real, whole-pool verification done first**: grepped every real `name:
// 'onLifeGained'`-named trigger across `functional-model/cards/*/
// definition.ts` (3 real occurrences: `excalibur-ii`, `minwu-white-mage`,
// `aerith-gainsborough`) and read each one's own real Scryfall oracle text
// directly — all three are the IDENTICAL literal clause, "Whenever you gain
// life,", no compound/qualified variant anywhere in the pool. All three
// already carry a matching hand-authored sink fact today
// (`{event:'lifegain', controller:'you'}`), confirming this is a
// real, established, checkable shape, not a guess.
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

const RULE = 'lifegain-trigger-structural' as const;

const CLAUSE_RE = /\bWhenever you gain life\b/i;

export function recognizeLifegainTriggerStructural(input: RecognizerInput): RecognizerResult {
  const match = CLAUSE_RE.exec(input.oracleText);
  if (!match) {
    return { matched: false, reason: 'no "Whenever you gain life" clause found' };
  }

  const start = match.index;
  const end = start + match[0].length;
  const annotation = toLineOffset(input.oracleText, start, end);
  if (!annotation) {
    return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
  }

  const facts: RecognizedFact[] = [
    {
      role: 'sink',
      fact: { event: 'lifegain', controller: 'you', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
