// New recognizer (2026-09-16, fin/26-50 follow-up) — card-definition-level,
// same family as `spellCostReductionGrants-structural.ts`/`crewCost-
// structural.ts` (reads a top-level `CardDefinition` field, `keywords`,
// directly): covers the `'LifegainDouble'` member of `card.ts`'s own
// `Keyword` union — a real CR 614.2 lifegain-doubling self-replacement
// (ENGINE_GAPS.md gap #8b), approximated via the same keyword-grant
// machinery real MTG keywords (Flying, Trample, ...) already use on this
// same field, not a literal printed `K:` keyword line.
//
// **Real, whole-pool check done first**: exactly 1 real card uses
// `'LifegainDouble'` — The Wind Crystal, whose own real, fixed, non-
// parametric printed clause is "If you would gain life, you gain twice
// that much life instead." A genuinely closed, single-template vocabulary
// (same restraint `ptFormulaSetToCreaturesControlled-structural.ts`'s own
// single-real-card scope already establishes for a different field) — grow
// only when a second real card needs it.
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type LifegainDoubleKeywordRecognizerInput = RecognizerInput & Pick<CardDefinition, 'keywords'>;

const RULE = 'lifegainDoubleKeyword-structural' as const;

const CLAUSE_PATTERN = /\bIf you would gain life, you gain twice that much life instead\b/i;

export function recognizeLifegainDoubleKeywordStructural(input: LifegainDoubleKeywordRecognizerInput): RecognizerResult {
  if (!(input.keywords ?? []).includes('LifegainDouble')) {
    return { matched: false, reason: "no 'LifegainDouble' entry in keywords on this face" };
  }

  const global = new RegExp(CLAUSE_PATTERN.source, CLAUSE_PATTERN.flags + 'g');
  const matches = [...input.oracleText.matchAll(global)];
  if (matches.length !== 1) {
    return {
      matched: false,
      kind: 'mismatch',
      reason: `expected clause /${CLAUSE_PATTERN.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
    };
  }
  const m = matches[0]!;
  const start = m.index!;
  const end = start + m[0]!.length;
  const annotation = toLineOffset(input.oracleText, start, end);
  if (!annotation) {
    return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
  }

  return {
    matched: true,
    facts: [
      {
        role: 'source',
        fact: { event: 'lifegainDouble', controller: 'you', annotations: [annotation] },
        provenance: { origin: 'parser', rule: RULE },
      },
    ],
  };
}
