// New recognizer (2026-09-15, fin/16-25 AI-fact-elimination pass) — third
// sibling of `continuousPTGrantsEquipped-structural.ts`/
// `continuousTypeGrantsEquipped-structural.ts`, same CARD-DEFINITION-LEVEL
// treatment applied to `continuousKeywordGrants` (never `effects`).
//
// **Real, whole-pool check done first**: 3 real cards carry a
// `continuousKeywordGrants` entry with `equippedBySelf: true` —
// `dragoon-s-lance` (`Flying`, `onlyDuringYourTurn: true` — "During your
// turn, equipped creature has flying"), `paladin-s-arms` (`Ward`, no
// `onlyDuringYourTurn` — "...has ward {1}, and is a Knight..."), and
// `sleep-magic` (`CantUntap`, no `onlyDuringYourTurn` — "Enchanted creature
// doesn't untap during its controller's untap step"). Two other real cards
// carry a DIFFERENT shape entirely (`dion-bahamut-s-dominant-...`'s own
// front face and `ardyn-the-usurper`, both `subtype`-scoped rather than
// `equippedBySelf` — a genuinely different real English template, "<self>
// and other <Subtype>s you control have..."/"<Subtype>s you control
// have...", covered by the separate sibling recognizer
// `continuousKeywordGrantsSubtype-structural.ts`, not this one).
//
// **Subject noun is derived from the face's own printed type line, not
// hardcoded** — an Equipment's broadcast reads "Equipped creature ...", an
// Aura's reads "Enchanted creature ..." (`sleep-magic`'s own real text) —
// both real, both confirmed, both mean exactly the same
// `RealCard.attachedToId` relationship (`equippedBySelf`'s own doc comment
// in `card.ts`). Any OTHER permanent type declines (scope) — no real card
// in the pool needs a third subject noun yet.
//
// **Keyword→English-word map is closed and small, same discipline as every
// other recognizer's own fixed vocabulary** — only the keywords actually
// granted this way in the real pool:
//   - `Flying` → the plain word "flying".
//   - `Ward` → "ward {N}" — the cost itself (`{1}` in the one real case) is
//     NOT tracked anywhere on this structured field (`card.ts`'s own
//     `Keyword` union has no parameterized "Ward{N}" variant), so this
//     recognizer only verifies the literal words "ward {" followed by any
//     digit — never asserting a specific cost it can't read structurally
//     (same "never assert an untracked magnitude" restraint
//     `putCounter-broadcast-structural.ts`'s own `\S+` quantifier
//     tolerance already establishes for a different field).
//   - **Widened 2026-09-16 (card-results/fin-51-75 triage backlog item
//     #6)**: `CantUntap` is no longer an unconditional decline. Its own
//     real English rendering ("doesn't untap during its controller's untap
//     step," `sleep-magic`'s own confirmed real text) is a FULL,
//     FIXED-SENTENCE paraphrase, not a single closed keyword word the way
//     Flying/Ward are — so this is handled as its own literal,
//     word-for-word template (`CANT_UNTAP_PHRASE`, checked ONLY against
//     this one real card, no generalized "paraphrase" machinery added),
//     never folded into the generic `KEYWORD_WORD`/`listPhrase` builder
//     below (a "doesn't untap..." clause could never sensibly join a
//     comma list the way "flying"/"ward {1}" do). Real, deliberately
//     narrow: no other real pool card grants `CantUntap` this way to
//     cross-check word order/boundary variance against.
//   - **Widened 2026-09-16 (static-ability audit follow-up)**: `Reach`
//     (bard-s-bow's own "...has reach, and is a Bard..."), `DoubleStrike`
//     (genji-glove's own "Equipped creature has double strike." — a
//     single-keyword full sentence, no new clause shape needed), `Trample`/
//     `Haste` (samurai-s-katana's own real 2-keyword list, "...has trample
//     and haste, and is a Samurai...").
//
// **Two real, distinct clause shapes, chosen by `onlyDuringYourTurn`**:
//   - `true` (Dragoon's Lance): the keyword clause is its OWN standalone
//     sentence, "During your turn, <subject> has <word list>." — required
//     as one contiguous phrase.
//   - `false`/absent (Paladin's Arms/Sleep Magic/bard-s-bow/samurai-s-
//     katana): the keyword clause can sit INSIDE a larger comma-joined list
//     ("Equipped creature gets +2/+1, has ward {1}, and is a Knight...")
//     — this recognizer only requires the subject noun to appear SOMEWHERE
//     earlier in the same sentence, then "has <word list>" later in that
//     same sentence (a same-sentence, non-greedy gap — same "tolerate
//     everything unconfirmed in between, verify only the real closed
//     anchor" discipline `token-creation-structural.ts` already uses for
//     its own adjective gaps).
//
// **Multi-keyword lists, widened 2026-09-16** — `continuousKeywordGrants`
// itself always allowed a `keywords: Keyword[]` array of any length; this
// recognizer used to require exactly 1 (every real card checked at the
// time only ever granted 1 this way). samurai-s-katana's own real "has
// trample and haste" is a genuine 2-keyword grant sharing ONE clause — same
// `listPhrase`/per-keyword-fact split `grantKeywordAll-effect-structural.ts`/
// `grantKeywordTarget-effect-structural.ts` already establish for their own
// analogous multi-keyword clauses (Oxford-comma 3-item list included, same
// closed list-length cap, even though no real card here needs a 3rd yet).
//
// **Widened again 2026-09-16 (`verify-text-coverage.mjs` pass): per-keyword
// annotation now spans the WHOLE matched clause, not just the bare keyword
// word/phrase** — same reasoning, and same real, whole-pool-checked
// justification, as `continuousKeywordGrantsSubtype-structural.ts`'s own
// identical widening the same pass: WHO has the keyword (the equipped
// creature — this recognizer's own `subject`, part of what each Fact's
// `target: {equippedBySelf: true}` already claims) and, for the
// `onlyDuringYourTurn` shape, the "During your turn" condition, are real
// content the clause conveys, not flavor around an otherwise-independent
// keyword word. Real, checked pool-wide impact: only `dragoon-s-lance`
// (its own standalone "During your turn, equipped creature has flying"
// sentence) and `genji-glove` (its own standalone "Equipped creature has
// double strike." sentence) were actually flagged by `verify-text-
// coverage.mjs` before this widening — the other 4 real cards using this
// recognizer (`paladin-s-arms`/`sleep-magic`/`bard-s-bow`/
// `samurai-s-katana`) already read 100% covered because their own keyword
// clause sits inside a larger sentence a SIBLING fact (the pump/type grant
// on the same clause) already separately annotates; this widening still
// applies uniformly to all 7 rather than special-casing the 2 that needed
// it, same "real, accepted duplication" acceptance
// `continuousKeywordGrantsSubtype-structural.ts`'s own widening comment
// already documents for an identical situation.
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type ContinuousKeywordGrantsRecognizerInput = RecognizerInput & Pick<CardDefinition, 'continuousKeywordGrants'>;

const RULE = 'continuousKeywordGrantsEquipped-structural' as const;

const KEYWORD_WORD: Partial<Record<string, string>> = {
  Flying: 'flying',
  Reach: 'reach',
  Trample: 'trample',
  Haste: 'haste',
  DoubleStrike: 'double strike',
};

/** `Ward` alone keeps its own untracked-cost regex shape (`ward \{\d+\}`,
 * never a plain word) — kept as a SEPARATE map since it can't share
 * `escapeRegExp`-style literal-word handling with the closed-vocabulary
 * words above, and (checked) no real card combines `Ward` with another
 * keyword in one grant, so it never needs to appear inside a `listPhrase`. */
const WARD_PHRASE = 'ward \\{\\d+\\}';

/** `CantUntap`'s own real, fixed-sentence rendering — see module doc
 * comment. Deliberately its own literal template, never merged into the
 * generic `KEYWORD_WORD` word-substitution machinery. */
const CANT_UNTAP_PHRASE = "doesn't untap during its controller's untap step";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function subjectNounFor(typeLine: string): string | undefined {
  if (/\bEquipment\b/.test(typeLine)) return 'equipped creature';
  if (/\bAura\b/.test(typeLine)) return 'enchanted creature';
  return undefined;
}

export function recognizeContinuousKeywordGrantsEquippedStructural(input: ContinuousKeywordGrantsRecognizerInput): RecognizerResult {
  const qualifying = (input.continuousKeywordGrants ?? []).filter(
    (g) => g.equippedBySelf === true && g.includeSelf === false && g.subtype === undefined,
  );
  if (qualifying.length === 0) {
    return {
      matched: false,
      reason:
        'no continuousKeywordGrants entry shaped exactly {equippedBySelf:true, includeSelf:false} with no subtype — the one real, confirmed template family this recognizer covers',
    };
  }

  const subject = subjectNounFor(input.typeLine);
  if (!subject) {
    return { matched: false, reason: `typeLine "${input.typeLine}" is neither Equipment nor Aura — no confirmed subject-noun template` };
  }

  const facts: RecognizedFact[] = [];
  for (const grant of qualifying) {
    let phrase: string;
    if (grant.keywords.length === 1 && grant.keywords[0] === 'Ward') {
      phrase = WARD_PHRASE;
    } else if (grant.keywords.length === 1 && grant.keywords[0] === 'CantUntap') {
      phrase = CANT_UNTAP_PHRASE;
    } else {
      const words = grant.keywords.map((k) => KEYWORD_WORD[k]);
      if (words.some((w) => w === undefined)) {
        return { matched: false, reason: `one of [${grant.keywords.join(', ')}] has no confirmed short English template` };
      }
      if (words.length === 1) phrase = escapeRegExp(words[0]!);
      else if (words.length === 2) phrase = `${escapeRegExp(words[0]!)} and ${escapeRegExp(words[1]!)}`;
      else if (words.length === 3) phrase = `${escapeRegExp(words[0]!)}, ${escapeRegExp(words[1]!)}, and ${escapeRegExp(words[2]!)}`;
      else return { matched: false, reason: `${grant.keywords.length} keywords in one grant — no confirmed real English list template beyond 3` };
    }

    // Not every real phrase ends in a word character (Ward's own untracked
    // cost ends in a literal `}`, immediately followed by a comma in real
    // text) — a trailing `\b` would require a word/non-word transition that
    // genuinely isn't there, so the boundary is only appended when the
    // phrase itself ends in a word character.
    const trailingBoundary = /\w$/.test(phrase) ? '\\b' : '';
    // `CantUntap`'s own fixed sentence already contains its own verb
    // ("doesn't untap..."), unlike every other keyword here which needs
    // the shared "has <word[ list]>" verb prepended — see module doc
    // comment.
    const verb = phrase === CANT_UNTAP_PHRASE ? '' : 'has ';
    const pattern = grant.onlyDuringYourTurn
      ? new RegExp(`\\bDuring your turn, ${subject} ${verb}${phrase}${trailingBoundary}`, 'i')
      : new RegExp(`\\b${subject}\\b[^.\\n]*?\\b${verb}${phrase}${trailingBoundary}`, 'i');
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
    const clauseStart = m.index!;
    const clauseText = m[0]!;
    const clauseEnd = clauseStart + clauseText.length;

    const annotation = toLineOffset(input.oracleText, clauseStart, clauseEnd);
    if (!annotation) {
      return { matched: false, reason: `matched span [${clauseStart},${clauseEnd}) did not resolve to a single real oracle-text line` };
    }
    for (const keyword of grant.keywords) {
      facts.push({
        role: 'source',
        fact: { event: 'grantKeyword', keyword, target: { equippedBySelf: true }, annotations: [annotation] },
        provenance: { origin: 'parser', rule: RULE },
      });
    }
  }

  return { matched: true, facts };
}
