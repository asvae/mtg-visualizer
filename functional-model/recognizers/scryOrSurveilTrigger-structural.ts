// New recognizer (2026-09-16, recognizer-lane escalation — card-results-lane
// triage) — plain TEXT recognizer, same family as `lifegain-trigger-
// structural.ts` (no `CardDefinition` field read at all, just the literal
// trigger-precondition clause): "Whenever you scry or surveil,". Unlike
// `lifegain-trigger-structural.ts`'s own single sink, this clause names TWO
// independent OR-branch conditions in one sentence, so it emits TWO sinks —
// `event:'scry'` anchored on the word "scry", `event:'surveil'` anchored on
// the word "surveil" — matching Matoya, Archon Elder's own pre-existing
// hand-authored fact pair exactly (same two-word, two-annotation shape).
//
// **Real, whole-pool check done first**: grepped every real
// `functional-model/cards/*/definition.ts` for an `onScry`/`onSurveil`-named
// trigger, and every real `synergy.json` for a `scry`/`surveil` SINK fact —
// Matoya, Archon Elder (fin/62) is the sole real card with either (10 other
// pool cards have `scry`/`surveil` SOURCE facts — a card that itself does
// the scrying/surveiling — none has a SINK, the "wants a scry/surveil to
// have happened" want this recognizer covers). Single-card, same accepted
// bar `lifegainDoubleKeyword-structural.ts`/
// `ptFormulaSetToCreaturesControlled-structural.ts` already set elsewhere in
// this catalog — grow only when a second real card needs it.
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

const RULE = 'scryOrSurveilTrigger-structural' as const;

const CLAUSE_RE = /\bWhenever you scry or surveil\b/i;
const SCRY_WORD_RE = /\bscry\b/i;
const SURVEIL_WORD_RE = /\bsurveil\b/i;

export function recognizeScryOrSurveilTriggerStructural(input: RecognizerInput): RecognizerResult {
  const clauseMatch = CLAUSE_RE.exec(input.oracleText);
  if (!clauseMatch) {
    return { matched: false, reason: 'no "Whenever you scry or surveil" clause found' };
  }
  const clauseStart = clauseMatch.index;
  const clauseEnd = clauseStart + clauseMatch[0].length;
  const clause = input.oracleText.slice(clauseStart, clauseEnd);

  const scryMatch = SCRY_WORD_RE.exec(clause);
  const surveilMatch = SURVEIL_WORD_RE.exec(clause);
  if (!scryMatch || !surveilMatch) {
    return { matched: false, reason: 'matched clause did not contain both a "scry" and a "surveil" word — recognizer bug' };
  }

  const scryAnnotation = toLineOffset(input.oracleText, clauseStart + scryMatch.index, clauseStart + scryMatch.index + scryMatch[0].length);
  const surveilAnnotation = toLineOffset(input.oracleText, clauseStart + surveilMatch.index, clauseStart + surveilMatch.index + surveilMatch[0].length);
  if (!scryAnnotation || !surveilAnnotation) {
    return { matched: false, reason: 'a matched span did not resolve to a single real oracle-text line' };
  }

  const facts: RecognizedFact[] = [
    {
      role: 'sink',
      fact: { event: 'scry', controller: 'you', annotations: [scryAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
    {
      role: 'sink',
      fact: { event: 'surveil', controller: 'you', annotations: [surveilAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
