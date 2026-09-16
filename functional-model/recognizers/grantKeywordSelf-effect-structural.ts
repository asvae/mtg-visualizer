// New recognizer (2026-09-16, card-results/fin-51-75 triage backlog item
// #4). Structural — reads a face's own `kind:'grantKeywordSelf'`
// `Effect[]` directly, sibling of `grantKeywordTarget-effect-structural.ts`/
// `grantKeywordAll-effect-structural.ts` for the self-only variant.
//
// **Real, whole-pool check — 3 real `kind:'grantKeywordSelf'` occurrences,
// only 2 reachable by any recognizer**: `tyvar-the-pummeler`'s own
// `{keyword:'Indestructible', untilEndOfTurn:true}` has NO real oracle
// text checked in anywhere under `data/*/*_scryfall.json` (a cross-set
// reference card, same bucket `apply-recognizers.mjs`'s own loader already
// skips wholesale) — never reaches this recognizer.
//
// - `sahagin`: `keyword:'Unblockable'`, real text "...put a +1/+1 counter
//   on this creature AND IT CAN'T BE BLOCKED THIS TURN." — Unblockable
//   renders as its own idiom ("can't be blocked"), not "gains X," and the
//   real self-subject here is the bare pronoun "it" (anaphoric, referring
//   back to "this creature" earlier in the SAME sentence) — this
//   recognizer's own `KEYWORD_CLAUSE` map encodes this per-keyword, exact
//   literal idiom rather than trying to generalize a "gains <word>"
//   template to a keyword that doesn't render that way.
// - `sidequest-hunt-the-mark-yiazmat-ultimate-mark`'s own back face
//   (Yiazmat, Ultimate Mark): `keyword:'Indestructible'`, real text
//   "Yiazmat gains indestructible until end of turn." — the card's own
//   printed NAME as subject, the ordinary "gains <word> until end of
//   turn" template `grantKeywordTarget-effect-structural.ts`'s own
//   `KEYWORD_WORD` map already establishes for a chosen target, reused
//   here (not re-derived) for a self-subject instead.
//
// Only these 2 real keywords have a confirmed template; any other keyword
// declines (`'scope'`) rather than guessing at an unconfirmed idiom.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'grantKeywordSelf-effect-structural' as const;

type GrantKeywordSelfEffect = Extract<Effect, { kind: 'grantKeywordSelf' }>;

function isGrantKeywordSelfEffect(e: Effect): e is GrantKeywordSelfEffect {
  return e.kind === 'grantKeywordSelf';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Real, closed per-keyword clause builders — see module doc comment for
 * exactly which 2 keywords are confirmed and why each renders differently.
 * `subject` is a literal alternation of this face's own self-reference
 * candidates (own name, short name before the first comma, or the bare
 * pronoun "it" — see `selfSubjectAlternation`). */
const KEYWORD_CLAUSE: Partial<Record<string, (subject: string) => RegExp>> = {
  Unblockable: (subject) => new RegExp(`\\b${subject} can't be blocked this turn\\b`, 'i'),
  Indestructible: (subject) => new RegExp(`\\b${subject} gains indestructible until end of turn\\b`, 'i'),
};

function selfSubjectAlternation(name: string): string {
  const shortName = name.split(',')[0]!.trim();
  const nameAlt = shortName !== name ? `${escapeRegExp(name)}|${escapeRegExp(shortName)}` : escapeRegExp(name);
  // "it" is included as a real, confirmed candidate (sahagin's own
  // Unblockable clause refers back to "this creature" via a bare pronoun,
  // not its own name) — deliberately only offered alongside the OTHER,
  // safer candidates and only ever matched as part of a full, specific,
  // per-keyword idiom (never a bare "it" search on its own), which is what
  // keeps this from being a generic, risky pronoun scan.
  return `(?:${nameAlt}|it)`;
}

export function recognizeGrantKeywordSelfEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const effects = allEffects(input).map((o) => o.effect).filter(isGrantKeywordSelfEffect);
  if (effects.length === 0) {
    return { matched: false, reason: "no kind:'grantKeywordSelf' Effect on this face" };
  }

  const facts: RecognizedFact[] = [];
  const subject = selfSubjectAlternation(input.name);
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of effects) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    if (!effect.untilEndOfTurn) {
      return { matched: false, reason: 'no untilEndOfTurn:true — no confirmed permanent-grant English template (see grantKeywordTarget-effect-structural.ts\'s own identical reasoning)' };
    }
    const builder = KEYWORD_CLAUSE[effect.keyword];
    if (!builder) {
      return { matched: false, reason: `keyword '${effect.keyword}' has no confirmed real English self-grant template (only Unblockable/Indestructible are confirmed)` };
    }

    const pattern = builder(subject);
    const global = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(global)];
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const m = matches[0]!;
    const start = m.index!;
    const end = start + m[0]!.length;
    const annotation = toLineOffset(input.oracleText, start, end);
    if (!annotation) {
      return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
    }

    facts.push({
      role: 'source',
      fact: { event: 'grantKeyword', keyword: effect.keyword, target: 'self', untilEndOfTurn: true, annotations: [annotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
