// New recognizer (2026-09-16, static-ability audit) — CARD-DEFINITION-LEVEL
// structural (reads `continuousPTGrants` directly, never `effects`), the
// `subtype`-scoped sibling of `continuousPTGrantsEquipped-structural.ts`
// (that recognizer's own scope is `equippedBySelf:true` only) — same real
// family split `continuousKeywordGrantsSubtype-structural.ts` already
// establishes relative to its own `...Equipped-structural.ts` sibling.
//
// **Real, whole-pool check**: exactly 3 real cards carry a
// `continuousPTGrants` entry with a `subtype` (no `equippedBySelf`) —
// `elvish-archdruid` (`{power:1, toughness:1, includeSelf:false,
// subtype:'Elf'}` — "Other Elf creatures you control get +1/+1"),
// `thranduil-sindarin-liege` (`{power:1, toughness:1, includeSelf:false,
// subtype:'Elf'}` — "Other Elves you control get +1/+1," a DIFFERENT real
// English phrasing for the identical grant shape — no "creatures" word,
// the subtype pluralized standalone instead), and `serah-farron-
// crystallized-serah`'s own back face (`{power:2, toughness:2,
// includeSelf:false, subtype:'Legendary'}` — "Legendary creatures you
// control get +2/+2," no "Other" prefix at all since the granting
// permanent, Crystallized Serah, isn't itself a Creature and so was never
// going to be included regardless — `state.ts`'s own
// `qualifiesForContinuousGrant` was fixed the same pass to guarantee this
// self-exclusion structurally, not just by lucky real-card wording).
//
// **One combined pattern covers all 3 real phrasings** rather than three
// separate templates — `(?:Other )?` (optional) followed by an alternation
// of "`<subtype> creatures`" (elvish-archdruid's/serah-farron's own shape)
// or the subtype's own irregular plural alone (thranduil's own shape,
// `Elf` -> `Elves`) — deliberately NOT derived from `includeSelf`/typeLine
// (whether "Other"/"creatures" appears is a genuine real-English-wording
// choice this field's own data doesn't encode), just tried together as one
// pattern and required to match EXACTLY once, same "decline rather than
// guess which of several real shapes applies" discipline every other
// multi-shape recognizer in this catalog already holds to.
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type ContinuousPTGrantsSubtypeRecognizerInput = RecognizerInput & Pick<CardDefinition, 'continuousPTGrants'>;

const RULE = 'continuousPTGrantsSubtype-structural' as const;

/** Same small, closed, real irregular-plural map every sibling subtype-broadcast recognizer needs (`Elf` -> `Elves`) — extend only when a real card needs another. */
const IRREGULAR_PLURAL: Partial<Record<string, string>> = { Elf: 'Elves' };

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatSigned(n: number): string {
  return (n >= 0 ? '+' : '') + n;
}

export function recognizeContinuousPTGrantsSubtypeStructural(input: ContinuousPTGrantsSubtypeRecognizerInput): RecognizerResult {
  const qualifying = (input.continuousPTGrants ?? []).filter(
    (g) => g.subtype !== undefined && g.equippedBySelf === undefined && g.onlyDuringYourTurn === undefined && !('scalePerType' in g) && !('scalePerSelfCounter' in g),
  );
  if (qualifying.length === 0) {
    return {
      matched: false,
      reason: 'no continuousPTGrants entry shaped {subtype, no equippedBySelf/onlyDuringYourTurn, fixed power/toughness} — the one real, confirmed template family this recognizer covers',
    };
  }

  const facts: RecognizedFact[] = [];
  for (const grant of qualifying) {
    if ('scalePerType' in grant || 'scalePerSelfCounter' in grant) continue; // excluded by `qualifying` already; narrows the type for TS below
    const subtype = grant.subtype!;
    const plural = IRREGULAR_PLURAL[subtype] ?? `${subtype}s`;
    const pattern = new RegExp(
      `\\b(?:Other )?(?:${escapeRegExp(subtype)} creatures|${escapeRegExp(plural)}) you control get ${escapeRegExp(formatSigned(grant.power))}\\/${escapeRegExp(formatSigned(grant.toughness))}\\b`,
      'i',
    );
    const globalPattern = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(globalPattern)];
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const m = matches[0]!;
    const annotation = toLineOffset(input.oracleText, m.index!, m.index! + m[0]!.length);
    if (!annotation) {
      return { matched: false, reason: `matched span [${m.index},${m.index! + m[0]!.length}) did not resolve to a single real oracle-text line` };
    }
    facts.push({
      role: 'source',
      fact: { event: 'pump', controller: 'you', target: { types: { has: [subtype] } }, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
