// New recognizer (2026-09-16, recognizer-lane escalation — card-results-lane
// triage) — card-definition-level, same family as `lifegainDoubleKeyword-
// structural.ts` (reads a top-level `CardDefinition` field, `keywords`,
// directly): covers the `'TwoHeadedCoin'` member of `card.ts`'s own
// `Keyword` union — a real CR-614-style replacement effect on a coin flip's
// own OUTCOME (`state.flipCoin`, ENGINE_GAPS.md gap #15, closed), mirrored
// via the same keyword-grant machinery real MTG keywords (Flying, Trample,
// ...) already use on this same field, not a literal printed `K:` keyword
// line.
//
// **Real, whole-pool check done first**: exactly 1 real card uses
// `'TwoHeadedCoin'` — Edgar, King of Figaro (fin/51), whose own real, fixed,
// non-parametric printed clause is "Two-Headed Coin — The first time you
// flip one or more coins each turn, those coins come up heads and you win
// those flips." A genuinely closed, single-template vocabulary (same
// restraint `lifegainDoubleKeyword-structural.ts`'s own single-real-card
// scope already establishes for a different keyword) — grow only when a
// second real card needs it.
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type WinCoinFlipRecognizerInput = RecognizerInput & Pick<CardDefinition, 'keywords'>;

const RULE = 'winCoinFlip-structural' as const;

const CLAUSE_PATTERN =
  /\bTwo-Headed Coin — The first time you flip one or more coins each turn, those coins come up heads and you win those flips\b/i;

export function recognizeWinCoinFlipStructural(input: WinCoinFlipRecognizerInput): RecognizerResult {
  if (!(input.keywords ?? []).includes('TwoHeadedCoin')) {
    return { matched: false, reason: "no 'TwoHeadedCoin' entry in keywords on this face" };
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
        fact: { event: 'winCoinFlip', controller: 'you', annotations: [annotation] },
        provenance: { origin: 'parser', rule: RULE },
      },
    ],
  };
}
