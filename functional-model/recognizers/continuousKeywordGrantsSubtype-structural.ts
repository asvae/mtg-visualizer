// New recognizer (2026-09-15, fin/16-25 AI-fact-elimination pass) — sibling
// of `continuousKeywordGrantsEquipped-structural.ts`, covering the OTHER
// real `continuousKeywordGrants` shape: a `subtype`-scoped broadcast from a
// permanent onto every OTHER permanent-you-control of that subtype (rather
// than onto whatever it's equipped to).
//
// **Real, whole-pool check**: exactly 2 real cards use the `subtype`-scoped
// shape — `ardyn-the-usurper` (`{keywords:['Menace','Lifelink','Haste'],
// includeSelf:false, subtype:'Demon'}` — "Demons you control have menace,
// lifelink, and haste." — Ardyn himself isn't a Demon, so no "other"
// wording is needed) and `dion-bahamut-s-dominant-...`'s own front face
// (`{keywords:['Flying'], includeSelf:true, subtype:'Knight',
// onlyDuringYourTurn:true}` — "Dragonfire Dive — During your turn, Dion and
// other Knights you control have flying." — Dion himself IS a Knight, so
// the real text explicitly says "Dion AND OTHER Knights").
//
// **Widened 2026-09-16 (fin/26-50 follow-up) to ALSO cover a bare, no-
// `subtype` broadcast** — `the-fire-crystal` (`{keywords:['Haste'],
// includeSelf:false}`, no `subtype` at all — "Creatures you control have
// haste," migrated off inert freeform `staticAbilities` text onto this same
// real field, same "stale comment claiming no machinery exists" bug class
// fixed elsewhere this pass: the-water-crystal's/the-wind-crystal's own
// analogous `spellCostReductionGrants` migration had already happened, this
// sibling static just never got the same treatment). Genuinely the SAME
// shape as the `subtype`-scoped one, one level less specific (every
// creature you control rather than one subtype of them) — not a new
// recognizer, since the only real difference is the subject phrase's own
// missing "<Subtype>s"/"creatures" swap and the resulting Fact's own
// `target.types.has` value.
//
// **Widened again 2026-09-16 (static-ability audit)** — a THIRD real shape,
// genuinely different from both above: `{includeSelf:true}`, no `subtype`,
// NO broadcast to any other creature at all — `freya-crescent`/
// `kain-traitorous-dragoon` ("Jump — During your turn, <Name> has flying")
// and `tonberry` ("Chef's Knife — During your turn, this creature has first
// strike and deathtouch," a real 2-keyword list). Distinguished from the
// broadcast shape purely by `includeSelf`: `true` here means SELF ONLY (the
// printed text never says "and other creatures you control"), `false`
// above means every OTHER creature (never self, since the source usually
// isn't a creature at all in that case). This exposed a real bug in
// `state.ts`'s own `qualifiesForContinuousGrant` — a bare `subtype:
// undefined` grant with `includeSelf:false` (the broadcast shape) could
// never actually match anyone before this pass; see that function's own
// updated comment. Subject noun for this self-only shape: a Legendary
// permanent's own short name (Freya Crescent/Kain — real CR 201.4b
// convention, same as the broadcast-with-self shape's own `shortName`
// derivation just above), or the pronoun "this creature" for a non-
// Legendary permanent (Tonberry's own real text) — verb is singular "has",
// never "have".
//
// **`includeSelf` picks between two real, confirmed subject templates**:
//   - `true`: `<card's own name> and other <Subtype>s you control` (needs
//     the face's own real `name`, not a generic "this creature" — no real
//     card in the pool phrases this any other way), or (no `subtype`)
//     `<card's own name> and other creatures you control` — no real card
//     needs this exact combination yet, but the template is the same
//     mechanical swap either way.
//   - `false`: `<Subtype>s you control` (no self-reference at all — CORRECT
//     for Ardyn, who genuinely isn't included), or (no `subtype`)
//     `creatures you control` (The Fire Crystal's own real case — it isn't
//     a creature at all, so `includeSelf` is moot either way).
//
// **Keyword list**: 1-3 keywords, real closed English joining —
// `kw1`/`kw1 and kw2`/`kw1, kw2, and kw3` (Oxford comma, Ardyn's own real
// confirmed 3-item case) — declines (scope) for 4+, unconfirmed.
//
// **Widened 2026-09-16 (`verify-text-coverage.mjs` pass): per-keyword
// annotation now spans the WHOLE matched clause (subject + verb + keyword
// list), not just the bare keyword WORD** — the previous narrower
// convention (matching Ardyn's own real, already-hand-authored per-keyword
// spans) left the subject/verb portion ("Dion and other Knights you
// control have", "During your turn, ... has") permanently uncovered on
// EVERY real card this recognizer touches (confirmed: all 6 —
// ardyn-the-usurper, dion-bahamut-s-dominant-..., the-fire-crystal,
// freya-crescent, kain-traitorous-dragoon, tonberry — independently flagged
// by `verify-text-coverage.mjs` for this exact clause shape before this
// widening). Same "the leading subject/context is squarely part of what the
// Fact claims, not flavor" reasoning `dealDamage-effect-structural.ts`'s own
// subject-prefix widening already established — WHO receives the granted
// keyword (the subtype/self target the Fact's own `target` field already
// names) and the "during your turn" condition are both real content the
// clause conveys, not just an unrelated lead-in to an otherwise-independent
// keyword word. For a multi-keyword grant (Ardyn's 3, Tonberry's 2), every
// keyword's own Fact now shares the IDENTICAL full-clause annotation — a
// real, accepted duplication (same real clause backs each one), not an
// attempt to disambiguate which keyword "owns" the subject text (there's
// nothing to disambiguate: the subject applies equally to all of them). A
// leading ability-name/mode label ("Dragonfire Dive — ", "Jump — ", "Chef's
// Knife — ") is still never reached for — this recognizer's own pattern
// never anchors before "during your turn"/the subject noun itself, matching
// every other recognizer's own label-exclusion convention pool-wide.
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type ContinuousKeywordGrantsSubtypeRecognizerInput = RecognizerInput & Pick<CardDefinition, 'continuousKeywordGrants'>;

const RULE = 'continuousKeywordGrantsSubtype-structural' as const;

const KEYWORD_WORD: Partial<Record<string, string>> = {
  Flying: 'flying',
  Menace: 'menace',
  Lifelink: 'lifelink',
  Haste: 'haste',
  Trample: 'trample',
  Vigilance: 'vigilance',
  Reach: 'reach',
  Deathtouch: 'deathtouch',
  FirstStrike: 'first strike',
  DoubleStrike: 'double strike',
  Hexproof: 'hexproof',
  Indestructible: 'indestructible',
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function listPhrase(words: string[]): string | undefined {
  if (words.length === 1) return escapeRegExp(words[0]!);
  if (words.length === 2) return `${escapeRegExp(words[0]!)} and ${escapeRegExp(words[1]!)}`;
  if (words.length === 3) return `${escapeRegExp(words[0]!)}, ${escapeRegExp(words[1]!)}, and ${escapeRegExp(words[2]!)}`;
  return undefined; // no real 4+-keyword card to verify templating against
}

export function recognizeContinuousKeywordGrantsSubtypeStructural(input: ContinuousKeywordGrantsSubtypeRecognizerInput): RecognizerResult {
  const qualifying = (input.continuousKeywordGrants ?? []).filter((g) => g.equippedBySelf === undefined);
  if (qualifying.length === 0) {
    return { matched: false, reason: 'no continuousKeywordGrants entry without equippedBySelf — the one real, confirmed template family this recognizer covers' };
  }

  const facts: RecognizedFact[] = [];
  for (const grant of qualifying) {
    const words = grant.keywords.map((k) => KEYWORD_WORD[k]);
    if (words.some((w) => w === undefined)) {
      return { matched: false, reason: `one of [${grant.keywords.join(', ')}] has no confirmed English keyword word` };
    }
    const phrase = listPhrase(words as string[]);
    if (!phrase) {
      return { matched: false, reason: `${grant.keywords.length} keywords in one grant — no confirmed real English list template beyond 3` };
    }

    // A legendary permanent's own real reminder/rules text self-references by
    // its SHORT name (the part before a comma-separated subtitle) when it has
    // one — real CR 201.4b convention, confirmed for Dion, Bahamut's
    // Dominant's own real "Dion and other Knights..." (never the full
    // printed "Dion, Bahamut's Dominant and other Knights...").
    const shortName = input.name.includes(',') ? input.name.slice(0, input.name.indexOf(',')) : input.name;
    const isSelfOnly = grant.subtype === undefined && grant.includeSelf === true;
    let subject: string;
    let verb: string;
    if (isSelfOnly) {
      // Self-only, no broadcast (freya-crescent/kain-traitorous-dragoon/
      // tonberry) — a Legendary permanent self-references by its own short
      // name, a non-Legendary one by the pronoun "this creature."
      subject = /\bLegendary\b/.test(input.typeLine) ? escapeRegExp(shortName) : 'this creature';
      verb = 'has';
    } else {
      const noun = grant.subtype ? `${escapeRegExp(grant.subtype)}s` : 'creatures';
      subject = grant.includeSelf ? `${escapeRegExp(shortName)} and other ${noun} you control` : `${noun} you control`;
      verb = 'have';
    }
    const prefix = grant.onlyDuringYourTurn ? 'during your turn, ' : '';
    const pattern = new RegExp(`\\b${prefix}${subject} ${verb} ${phrase}\\b`, 'i');
    const globalPattern = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(globalPattern)];
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const clauseStart = matches[0]!.index!;
    const clauseEnd = clauseStart + matches[0]![0]!.length;

    const annotation = toLineOffset(input.oracleText, clauseStart, clauseEnd);
    if (!annotation) {
      return { matched: false, reason: `matched span [${clauseStart},${clauseEnd}) did not resolve to a single real oracle-text line` };
    }
    for (let i = 0; i < grant.keywords.length; i++) {
      const keyword = grant.keywords[i]!;
      facts.push({
        role: 'source',
        fact: isSelfOnly
          ? { event: 'grantKeyword', keyword, target: 'self', annotations: [annotation] }
          : { event: 'grantKeyword', keyword, controller: 'you', target: { types: { has: [grant.subtype ?? 'Creature'] } }, annotations: [annotation] },
        provenance: { origin: 'parser', rule: RULE },
      });
    }
  }

  return { matched: true, facts };
}
