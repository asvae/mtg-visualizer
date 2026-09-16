// New recognizer (2026-09-16, fin/26-50 pass) — card-definition-level, same
// family as `manaAbilitiesSimple-structural.ts`/`crewCost-structural.ts`
// (reads a top-level `CardDefinition` field directly, not an `Effect[]`
// container): `CardDefinition.spellCostReductionGrants` (real Forge `S:Mode$
// ReduceCost | ValidCard$ Card.<Color> | Type$ Spell | Activator$ You |
// Amount$ N` — see `card.ts`'s own `SpellCostReductionGrant` doc comment).
//
// **Real, whole-pool check done first** — grepped every real
// `spellCostReductionGrants:` entry (exactly 2 real cards: The Water
// Crystal `{amount:1, colors:['U']}`, The Wind Crystal `{amount:1,
// colors:['W']}`) — both single-color, both `amount:1`, both real printed
// text templating identically: "<Color word> spells you cast cost {N} less
// to cast." No 2+-color or `amount!==1` real card exists yet — a genuinely
// closed, single-template vocabulary (grow only when a real card forces a
// second shape, same restraint every other small closed-vocabulary
// recognizer in this catalog already documents).
//
// No paired SINK fact — checked directly: neither real card's own
// pre-existing hand-authored facts carry one for this claim (a broadcast
// cost discount has no "wants a matching card present" companion want the
// way a targeted/zone-shaped effect does), so none is invented here either.
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type SpellCostReductionGrantsRecognizerInput = RecognizerInput & Pick<CardDefinition, 'spellCostReductionGrants'>;

const RULE = 'spellCostReductionGrants-structural' as const;

/** Real WUBRG color words (Forge `Card.White`/`Card.Blue`/etc.) — closed,
 * same small vocabulary `addMana-effect-structural.ts`'s own color-word
 * mapping already establishes for a different field. */
const COLOR_WORD: Record<string, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };

export function recognizeSpellCostReductionGrantsStructural(input: SpellCostReductionGrantsRecognizerInput): RecognizerResult {
  const grants = input.spellCostReductionGrants ?? [];
  if (grants.length === 0) {
    return { matched: false, reason: 'no spellCostReductionGrants entry on this face' };
  }

  const claimed = new Set<number>();
  const facts: RecognizedFact[] = [];
  for (const grant of grants) {
    if (grant.colors.length !== 1) {
      return { matched: false, reason: `no confirmed English template for a spellCostReductionGrants entry with ${grant.colors.length} colors (only single-color grants are confirmed)` };
    }
    const colorWord = COLOR_WORD[grant.colors[0]!];
    if (!colorWord) {
      return { matched: false, reason: `unrecognized color letter "${grant.colors[0]}" in spellCostReductionGrants` };
    }

    const pattern = new RegExp(`\\b${colorWord} spells you cast cost \\{${grant.amount}\\} less to cast\\b`, 'i');
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
      fact: { event: 'costReduction', controller: 'you', colors: { has: [grant.colors[0]!] }, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
