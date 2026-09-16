// New recognizer (2026-09-15, fin/16-25 AI-fact-elimination pass) — sibling
// of `continuousPTGrantsEquipped-structural.ts`, same CARD-DEFINITION-LEVEL
// treatment (reads `continuousTypeGrants`, never `effects`) applied to the
// "is a[n] <Type> in addition to its other types" clause instead of the
// "gets ±P/±T" one.
//
// **Real, whole-pool check done first**: exactly 8 real cards carry a
// `continuousTypeGrants` entry at all
// (`black-mage-s-rod`/`astrologian-s-planisphere`/`sage-s-nouliths`/
// `dragoon-s-lance`/`paladin-s-arms`/`machinist-s-arsenal`/`thief-s-knife`/
// `white-mage-s-staff`), and every one of them has the exact same shape —
// `{ types: [<one type>], includeSelf: false, equippedBySelf: true }` — this
// recognizer only ever builds the ONE confirmed real English template that
// shape corresponds to, and declines (scope, not mismatch) anything with
// `equippedBySelf` false/absent, `includeSelf` true, `subtype`/
// `onlyDuringYourTurn` set, or more than one granted type — no real card
// exercises those combinations with this field yet.
//
// **Article ("a"/"an") is derived, not guessed per-card**: every real granted
// type in the pool (Knight, Artificer, Wizard, Cleric, Rogue) is a plain
// English noun; the article is mechanically picked off whether the type's
// own first letter is a vowel (matches all 5 real cases: "a Knight"/"an
// Artificer"/"a Wizard"/"a Cleric"/"a Rogue") — same closed, checked
// vocabulary discipline every other recognizer in this catalog already uses,
// not a general English-grammar solver.
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type ContinuousTypeGrantsRecognizerInput = RecognizerInput & Pick<CardDefinition, 'continuousTypeGrants'>;

const RULE = 'continuousTypeGrantsEquipped-structural' as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function articleFor(word: string): 'a' | 'an' {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

export function recognizeContinuousTypeGrantsEquippedStructural(input: ContinuousTypeGrantsRecognizerInput): RecognizerResult {
  const qualifying = (input.continuousTypeGrants ?? []).filter(
    (g) => g.equippedBySelf === true && g.includeSelf === false && g.subtype === undefined && g.onlyDuringYourTurn === undefined && g.types.length === 1,
  );
  if (qualifying.length === 0) {
    return {
      matched: false,
      reason:
        'no continuousTypeGrants entry shaped exactly {equippedBySelf:true, includeSelf:false, types:[<one type>]} with no subtype/onlyDuringYourTurn — the one real, confirmed template this recognizer covers',
    };
  }

  const facts: RecognizedFact[] = [];
  for (const grant of qualifying) {
    const type = grant.types[0]!;
    const pattern = new RegExp(`\\bis ${articleFor(type)} ${escapeRegExp(type)} in addition to its other types\\b`, 'i');
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
      fact: { event: 'grantType', type, target: { equippedBySelf: true }, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
