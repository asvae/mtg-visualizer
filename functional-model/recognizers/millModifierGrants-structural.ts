// New recognizer (2026-09-16, card-results/fin-76-100 re-triage backlog
// item #3) — card-definition-level, same family as `spellCostReductionGrants
// -structural.ts` (reads a top-level `CardDefinition` field directly, not
// an `Effect[]` container — that recognizer's own module doc comment is
// this card's own adjacent-field sibling, `spellCostReductionGrants`):
// `CardDefinition.millModifierGrants` (real CR 614.2 mill-event replacement
// — `card.ts`'s own `MillModifierGrant` doc comment, real Forge citation
// `res/cardsfolder/t/the_water_crystal.txt`: `R:Event$ Mill | ActiveZones$
// Battlefield | ValidPlayer$ Player.Opponent | ReplaceWith$ MillPlus4 | ...`
// + `SVar:X:ReplaceCount$Number/Plus.4` — ENGINE_GAPS.md gap #19, closed).
//
// **Real, whole-pool check done first** — grepped every real
// `millModifierGrants:` entry: exactly ONE real card, `the-water-crystal`
// (`{amount:4}`), real printed text "If an opponent would mill one or more
// cards, they mill that many cards plus four instead." No other real card
// in this pool has this field at all — a genuinely closed, single-template
// vocabulary, same restraint `spellCostReductionGrants-structural.ts`'s own
// module doc comment already documents for its own single-template field
// (grow only when a second real card forces a second shape).
//
// No paired SINK fact — checked directly: this card's own pre-existing
// hand-authored fact for this clause carries no sink (a broadcast
// replacement effect on every opponent's OWN mill event has no "wants a
// matching card present" companion want the way a targeted/zone-shaped
// effect does), so none is invented here either — same check that
// recognizer's own module doc comment already performed for its own field.
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type MillModifierGrantsRecognizerInput = RecognizerInput & Pick<CardDefinition, 'millModifierGrants'>;

const RULE = 'millModifierGrants-structural' as const;

/** Real NUMBER WORDS — Forge's own `ReplaceCount$Number/Plus.N` templates
 * as "plus <word>" in printed English (real Magic templating always spells
 * out small numbers here, same convention `token-creation-structural.ts`'s
 * own `NUMBER_WORDS` already establishes for a different field). Only `4`
 * is confirmed real; widen when a second real card needs another. */
const NUMBER_WORDS: Partial<Record<number, string>> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five' };

export function recognizeMillModifierGrantsStructural(input: MillModifierGrantsRecognizerInput): RecognizerResult {
  const grants = input.millModifierGrants ?? [];
  if (grants.length === 0) {
    return { matched: false, reason: 'no millModifierGrants entry on this face' };
  }

  const claimed = new Set<number>();
  const facts: RecognizedFact[] = [];
  for (const grant of grants) {
    const word = NUMBER_WORDS[grant.amount];
    if (!word) {
      return { matched: false, reason: `no confirmed English number word for a millModifierGrants entry with amount ${grant.amount}` };
    }

    const pattern = new RegExp(
      `\\bIf an opponent would mill one or more cards, they mill that many cards plus ${word} instead\\.`,
      'i',
    );
    const globalPattern = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(globalPattern)].filter((m) => !claimed.has(m.index!));
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} unclaimed times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const m = matches[0]!;
    claimed.add(m.index!);
    const annotation = toLineOffset(input.oracleText, m.index!, m.index! + m[0]!.length);
    if (!annotation) {
      return { matched: false, reason: `matched span [${m.index},${m.index! + m[0]!.length}) did not resolve to a single real oracle-text line` };
    }
    facts.push({
      role: 'source',
      fact: { event: 'millIncrease', controller: 'opp', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
