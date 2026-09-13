// Recognizer C — PROTOTYPE ONLY, 2026-09-13 (`PRD_AUTOMATED_AUTHORING.md`'s
// "Prototype findings" section documents the ORIGINAL two-recognizer
// prototype this deliberately mirrors in spirit; this is a follow-up, bounded
// exploration of a SECOND recognition strategy, not itself part of that PRD's
// wired catalog — `types.ts`'s own `RecognizerId` union is intentionally left
// untouched, `apply-recognizers.mjs` does not know this file exists).
//
// "A permanent (creature or artifact) token, created via Forge's own `DB$
// Token` / `SP$ Token` ability, enters the battlefield" — same target Fact
// shape the real hand-authored pool already uses everywhere a card makes a
// token (`moogles-valor`, `aerith-rescue-mission`, `battle-menu`,
// `retrieve-the-esper`, `dwarven-castle-guard` all carry this exact shape):
//   `{ event: 'entersBattlefield', to: 'Battlefield', controller: 'you',
//      subject: { token: <id> }, value: -1, annotations: [...] }`
// `value: -1` always, never a literal count read off `TokenAmount$` — this
// is a real, structurally-grounded finding, not just cautious mirroring of
// the existing `-1` "pending compute-weights.mjs" convention: `scripts/
// compute-weights.mjs`'s own `sourceMagnitude` ALWAYS re-derives a
// token-subject fact's magnitude from the real execution trace
// (`Math.max(1, maxAmount(log, 'createToken', 'qty'))`), unconditionally,
// regardless of whatever value was authored — confirmed directly against
// `ancient-adamantoise` (Forge's own script says `TokenAmount$ 10` literally,
// yet its real, current `synergy.json` shows `value: 5`, the trace-observed
// count, not Forge's literal number) and `aerith-rescue-mission` (Forge says
// `TokenAmount$ 3` literally, real `synergy.json` shows `value: 5`). Baking
// in a Forge-script literal here would be actively WRONG more often than
// right; `-1` is the only honest choice regardless of whether the source
// script's own amount is a fixed integer or a variable (Moogles' Valor's own
// "X").
//
// **THE open problem this recognizer exists to probe**
// (`PRD_AUTOMATED_AUTHORING.md`'s task brief) — unlike the two oracle-text
// recognizers, this one's structured source (Forge's script) carries NO
// character offset into this card's OWN printed oracle text at all: Forge's
// script is a wholly separate, differently-shaped document. A real
// `AnnotationRef` (`Fact.annotations`, `.claude/contracts/state-event-format.
// md`) still has to anchor into the real Scryfall oracle text for the Facts
// tab, so this recognizer has to independently re-derive which SPAN of that
// text corresponds to what it just read out of Forge's structured fields.
//
// The strategy landed on: locate every `create`/`creates` occurrence in the
// oracle text, bound each one to its own "clause" (quote-aware — stops at
// the first period that is NOT inside an open `"..."` span, so a token whose
// own granted ability is quoted inline, e.g. `circle-of-power`'s "Whenever
// you cast a noncreature spell, this token deals 1 damage to each
// opponent.", doesn't get cut off mid-clause by ITS OWN internal period),
// then keep only the clause(s) that structurally corroborate the SAME
// attributes just read off the token script: the literal `P/T` string (for a
// creature token), every subtype word (`Types:` minus known supertype
// words), and the color word (`Colors:`, which conveniently already reads as
// plain English matching oracle wording verbatim — no W/U/B/R/G translation
// needed). Exactly one structurally-corroborated clause = accept that span;
// zero or more-than-one = decline, never guess.
//
// **How honest is this, generalization-wise? Deliberately NOT overstated
// here** — this only works at all because Magic's own templating for a
// "create a token" clause is close to formulaic, and even then it took real
// domain knowledge (not just field-reading) to get right:
//   - Word ORDER isn't uniform: `retrieve-the-esper`'s oracle prints "3/3
//     blue Robot Warrior ARTIFACT creature token" — Forge's own `Types:`
//     field lists `Artifact Creature Robot Warrior` in a DIFFERENT order
//     than the oracle sentence does. This recognizer sidesteps needing the
//     exact order by checking unordered containment only (every subtype
//     word + the color word + the P/T string, each independently present
//     ANYWHERE in the clause) rather than building one exact phrase to
//     string-match — a deliberate design choice, not a byproduct.
//   - Word PRESENCE isn't uniform either: `ancient-adamantoise`'s Treasure
//     token is `Types: Artifact Treasure` in Forge's script, but the real
//     oracle text says only "ten tapped Treasure tokens" — the word
//     "artifact" is skipped entirely for this iconic/common token type, a
//     real templating convention no amount of Forge-field-reading would
//     have predicted. This recognizer never requires supertype words
//     (`Artifact`/`Creature`) to literally appear — only the SUBTYPE word(s)
//     (the leftover `Types:` words once known supertypes are stripped),
//     which happen to always survive in every real case checked.
//   - Quantity words ("three", "ten") are NOT cross-checked against
//     `TokenAmount$` at all — a real, acknowledged gap (see this file's own
//     `findCreateClause` doc comment) that happens not to matter for any of
//     the 6 real cards this prototype was checked against (each has exactly
//     one create-token clause, so ambiguity never arises), but WOULD matter
//     for a real card that creates two DIFFERENT token types in one spell —
//     not attempted here, flagged as a known limitation rather than silently
//     assumed solved.
//   - This whole strategy is a genuinely SEPARATE, ADDITIONAL layer of
//     Magic-templating knowledge, not a byproduct of parsing Forge's fields
//     the way the oracle-text recognizers get their spans "for free" by
//     construction. Building it took real trial against 6 real cards with
//     genuinely different clause shapes (a plain sentence, a modal bullet,
//     an embedded quoted reminder ability, a mid-sentence subordinate
//     clause) — it is NOT a trivial reverse-mapping, and a card with an even
//     less formulaic phrasing than these 6 could plausibly defeat it. See
//     this prototype's own findings write-up (relayed in the dispatching
//     session's final report, not duplicated here) for the honest
//     generalization verdict.
//
// **A second, independent limitation found while building this — the
// `subject.token` id itself is not always mechanically derivable either.**
// This app's own token catalog (`tokens.ts`'s `TOKENS` map) is keyed by a
// string that is USUALLY, but not always, identical to Forge's own
// `TokenScript$` id: `retrieve-the-esper`'s real Forge script says
// `TokenScript$ u_3_3_a_robot_warrior`, but `tokens.ts`'s own real entry for
// this exact token is keyed `u_3_3_robot_warrior` (no `_a_`) — confirmed
// directly against both real files, not assumed. A recognizer that blindly
// used Forge's own id as `subject.token` would silently produce a fact that
// resolves against NOTHING in this app's real token registry
// (`resolveSubject` in `synergy.ts` would just return `undefined` for it,
// quietly breaking cross-card matching rather than erroring loudly).
// Conservative-by-construction (same principle the original two prototype
// recognizers already established) means this recognizer requires the
// EXACT Forge id to already exist as a real `tokens.ts` key, declining
// otherwise rather than fabricating a normalized guess — which is exactly
// why this recognizer correctly DECLINES `retrieve-the-esper` even though
// its Forge script parses cleanly in every other respect.
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from '../synergy';
import { findTokenAbilities, parseTokenScript } from './forge-script-parser.prototype';

const RULE = 'token-creation-from-forge-script' as const;

/** One real card face's worth of Forge-script input, PLUS the two callbacks
 * this recognizer needs precisely because its source data isn't the card's
 * own oracle text: `resolveTokenScript` looks up a referenced token
 * script's raw text (mirrors `tmp/mtg-forge/forge-gui/res/tokenscripts/
 * <id>.txt`), and `isKnownTokenId` checks whether this app's own real
 * `tokens.ts` catalog already has an entry under that EXACT id (see this
 * file's own module doc comment on why this can't be assumed/normalized).
 * `oracleText` is still required — this recognizer's whole second half is
 * about mapping Forge's structured data back onto it. */
export interface ForgeScriptRecognizerInput {
  name: string;
  oracleText: string;
  /** Raw text of this card's own Forge cardsfolder script (the WHOLE file,
   * not pre-sliced to one ability — this recognizer finds every `DB$
   * Token`/`SP$ Token` line itself). */
  cardScript: string;
  resolveTokenScript: (tokenScriptId: string) => string | undefined;
  isKnownTokenId: (tokenScriptId: string) => boolean;
}

const KNOWN_SUPERTYPES = new Set(['Artifact', 'Creature', 'Enchantment', 'Legendary', 'Land', 'Planeswalker', 'Battle']);

/** Finds the ONE clause in `oracleText` that structurally corroborates a
 * token's own color/PT/subtype attributes — see this file's own module doc
 * comment for the full rationale and honest limitations (word-order,
 * word-presence, and quantity-word gaps). Quote-aware clause bounding: scans
 * from each `create`/`creates` occurrence to the first period NOT inside an
 * open `"..."` span (or the end of that oracle-text LINE, whichever comes
 * first — a clause never crosses `oracleText`'s own `\n` boundaries, since
 * `toLineOffset` couldn't represent a cross-line span anyway). */
// Exported ONLY for this prototype's own test to probe the quote-aware
// clause-bounding logic directly against a real card (`circle-of-power`)
// whose token turns out to fail the SEPARATE catalog-membership check below
// (`b_0_1_wizard_snipe` isn't a real `tokens.ts` entry at all — see this
// file's own report) — isolating the two independent failure modes rather
// than conflating "the annotation math is right" with "the token resolves."
export function findCreateClause(
  oracleText: string,
  subtypeWords: string[],
  colorWord: string | undefined,
  pt: [number, number] | undefined,
): { start: number; end: number } | undefined {
  const candidates: { start: number; end: number }[] = [];
  const createRe = /\bcreates?\b/gi;
  let match: RegExpExecArray | null;
  while ((match = createRe.exec(oracleText))) {
    const start = match.index;
    let quoteCount = 0;
    let end = oracleText.length;
    for (let i = start; i < oracleText.length; i++) {
      const ch = oracleText[i];
      if (ch === '"') quoteCount++;
      if (ch === '\n') {
        end = i;
        break;
      }
      // Excludes the terminating period itself (`end = i`, not `i + 1`) —
      // matches the real, existing hand-authored annotation convention every
      // other recognizer/hand-authored fact in this pool already follows
      // (confirmed directly: `moogles-valor`'s own real `synergy.json`
      // annotation is `start:31, end:85`, a 54-character span that reads
      // "create a 1/2 white Moogle creature token with lifelink" with NO
      // trailing period — not 55 characters with one).
      if (ch === '.' && quoteCount % 2 === 0) {
        end = i;
        break;
      }
    }
    candidates.push({ start, end });
  }

  const ptPattern = pt ? `${pt[0]}/${pt[1]}` : undefined;
  const structurallyValid = candidates.filter(({ start, end }) => {
    const clause = oracleText.slice(start, end);
    if (ptPattern && !clause.includes(ptPattern)) return false;
    if (!subtypeWords.every((w) => clause.includes(w))) return false;
    if (colorWord && !clause.toLowerCase().includes(colorWord.toLowerCase())) return false;
    return true;
  });
  if (structurallyValid.length !== 1) return undefined; // none, or ambiguous — never guess
  return structurallyValid[0];
}

export function recognizeTokenCreationFromForgeScript(input: ForgeScriptRecognizerInput): RecognizerResult {
  const abilities = findTokenAbilities(input.cardScript);
  if (abilities.length === 0) {
    return { matched: false, reason: 'no Forge "DB$ Token"/"SP$ Token" ability line found in this card\'s own script' };
  }

  const facts: RecognizedFact[] = [];
  const declineReasons: string[] = [];

  for (const ability of abilities) {
    if (!input.isKnownTokenId(ability.tokenScriptId)) {
      declineReasons.push(
        `TokenScript$ "${ability.tokenScriptId}" has no exact-matching entry in this app's own token catalog (tokens.ts) — a real Forge-id/catalog-key naming drift, not fabricated here (see this recognizer's own module doc comment)`,
      );
      continue;
    }
    const tokenScriptText = input.resolveTokenScript(ability.tokenScriptId);
    if (!tokenScriptText) {
      declineReasons.push(`TokenScript$ "${ability.tokenScriptId}" has no resolvable token-script text`);
      continue;
    }
    const attrs = parseTokenScript(tokenScriptText);
    const subtypeWords = attrs.types.filter((t) => !KNOWN_SUPERTYPES.has(t));
    if (subtypeWords.length === 0) {
      declineReasons.push(`TokenScript$ "${ability.tokenScriptId}" has no recognizable subtype word to anchor against oracle text`);
      continue;
    }
    const colorWord = attrs.colors[0];
    const span = findCreateClause(input.oracleText, subtypeWords, colorWord, attrs.pt);
    if (!span) {
      declineReasons.push(`could not uniquely locate a "create ... token" clause in oracle text matching TokenScript$ "${ability.tokenScriptId}"'s own color/PT/subtype`);
      continue;
    }
    const annotation = toLineOffset(input.oracleText, span.start, span.end);
    if (!annotation) {
      declineReasons.push('matched clause span does not map cleanly onto one oracle-text line');
      continue;
    }
    facts.push({
      role: 'source',
      fact: {
        event: 'entersBattlefield',
        to: 'Battlefield',
        controller: 'you',
        subject: { token: ability.tokenScriptId },
        value: -1,
        annotations: [annotation],
      },
      // `origin: 'parser'` is the only real value `synergy.ts`'s
      // `FactProvenance` allows today (a deliberate literal-union-of-one —
      // see that interface's own doc comment). This prototype does NOT
      // widen it: `rule` alone already fully disambiguates this recognizer
      // from the two oracle-text ones by NAME, and this is explicitly a
      // recommendation for the dispatching session to weigh, not something
      // decided unilaterally by touching the real schema — see this
      // recognizer's own report for the actual argument on both sides.
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  if (facts.length === 0) {
    return { matched: false, reason: declineReasons.join('; ') || 'no token-creation ability produced a fact' };
  }
  return { matched: true, facts };
}
