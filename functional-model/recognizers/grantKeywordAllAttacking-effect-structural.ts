// New recognizer (2026-09-16, engine-core migration follow-up — Cecil,
// Dark Knight // Cecil, Redeemed Paladin's back face just moved off a
// no-op `custom` closure onto a real `kind:'grantKeywordAll', predicate:
// 'attacking-creatures'` Effect, `card.ts`'s own newly-added predicate
// value). Structural, direct sibling of `pumpAllAttacking-effect-
// structural.ts` (same "attacking-creatures" broadcast predicate, same
// paired source+sink convention that recognizer already establishes for
// its own `read:getCreaturesInPlay` aggregate-read obligation — see that
// file's own module doc comment for the full "why a sink is needed at
// all" rationale, not re-derived here) — but for a KEYWORD grant instead
// of a P/T pump, same split `grantKeywordAll-effect-structural.ts` already
// makes from `pumpAllCreaturesYouControl-effect-structural.ts`.
//
// **Real, whole-pool check**: `cecil-dark-knight-cecil-redeemed-paladin`'s
// own back face ("Protect — Whenever Cecil attacks, other attacking
// creatures gain indestructible until end of turn") is the only real card
// using this predicate+kind combination as of this recognizer's own
// authoring. This recognizer applies to any FUTURE card using the
// identical shape.
//
// **`notSelf` ("other attacking creatures" vs a bare "attacking
// creatures")** — same pre-existing field `grantKeywordAll-effect-
// structural.ts`'s own `subjectCandidates` already branches on for a
// different predicate; only these 2 literal English subject phrases are
// confirmed, no `subtype` combination has a real card yet (declines,
// scope, same as that sibling file's own `subtype`+`notSelf` decline).
//
// **Keyword word whitelist, not blind lowercasing** — same deliberately
// conservative convention `grantKeywordAll-effect-structural.ts`'s own
// `KEYWORD_WORD` map already establishes (a few real keywords are
// multi-word/hyphenated, e.g. "first strike"/"double strike," so this
// never assumes `keyword.toLowerCase()` is always the printed word). Only
// `Indestructible` is confirmed real for this predicate today; widen this
// map, not the assumption, when a future card needs another.
//
// **`untilEndOfTurn` required** — same real 514.2 Cleanup-removal
// requirement `grantKeywordAll-effect-structural.ts`'s own module doc
// comment already establishes; no real card combines this predicate with
// a permanent (non-until-end-of-turn) grant, so that combination declines
// rather than guessing at an unconfirmed template.
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit, same class as `grantKeywordAll-effect-structural.ts`'s own
// sibling fix, same day): the sink used to be annotated with the WHOLE
// matched clause ("<subject> gain(s) <keyword> until end of turn") — now
// narrows to just the subject phrase ("other attacking creatures"/
// "attacking creatures"), the same real "always-separable subject phrase"
// split that sibling recognizer's own fix already establishes.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'grantKeywordAllAttacking-effect-structural' as const;

type GrantKeywordAllEffect = Extract<Effect, { kind: 'grantKeywordAll' }>;

function isAttackingGrantKeywordAllEffect(e: Effect): e is GrantKeywordAllEffect {
  return e.kind === 'grantKeywordAll' && e.predicate === 'attacking-creatures';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KEYWORD_WORD: Partial<Record<string, string>> = {
  Indestructible: 'indestructible',
};

export function recognizeGrantKeywordAllAttackingEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const all = allEffects(input).map((o) => o.effect).filter((e): e is GrantKeywordAllEffect => e.kind === 'grantKeywordAll' && e.predicate === 'attacking-creatures');
  if (all.length === 0) {
    return { matched: false, reason: "no kind:'grantKeywordAll', predicate:'attacking-creatures' Effect on this face" };
  }
  const qualifying = all.filter(isAttackingGrantKeywordAllEffect);
  if (qualifying.length !== all.length) {
    return { matched: false, reason: 'a subtype-restricted attacking-creatures grantKeywordAll exists on this face — no confirmed real template for that combination yet' };
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);
  for (const effect of qualifying) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    if (!effect.untilEndOfTurn) {
      return { matched: false, reason: 'an attacking-creatures grantKeywordAll effect on this face has no untilEndOfTurn:true — no confirmed permanent-grant English template' };
    }
    if (effect.subtype) {
      return { matched: false, reason: `an attacking-creatures grantKeywordAll effect on this face has a subtype ("${effect.subtype}") — no confirmed real template combining the two` };
    }
    const word = KEYWORD_WORD[effect.keyword];
    if (!word) {
      return { matched: false, reason: `keyword "${effect.keyword}" has no confirmed English word for this template` };
    }
    const subject = effect.notSelf ? 'other attacking creatures' : 'attacking creatures';
    const pattern = new RegExp(`\\b(${subject}) gains? (${escapeRegExp(word)}) until end of turn\\b`, 'id');
    const globalPattern = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(globalPattern)] as Array<RegExpMatchArray & { indices: Array<[number, number] | undefined> }>;
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const m = matches[0]!;
    const [sinkStart, sinkEnd] = m.indices[1]!; // the subject phrase
    const [sourceStart, sourceEnd] = m.indices[2]!; // the bare keyword word
    const sourceAnnotation = toLineOffset(input.oracleText, sourceStart, sourceEnd);
    const sinkAnnotation = toLineOffset(input.oracleText, sinkStart, sinkEnd);
    if (!sourceAnnotation || !sinkAnnotation) {
      return { matched: false, reason: `matched span [${sinkStart},${sourceEnd}) (or its own inner source/sink split spans) did not resolve to a single real oracle-text line` };
    }
    const target: { types: { has: string[] }; excludeSelf?: boolean } = { types: { has: ['Creature'] } };
    if (effect.notSelf) target.excludeSelf = true;

    facts.push({
      role: 'source',
      fact: {
        event: 'grantKeyword',
        keyword: effect.keyword,
        controller: 'you',
        target,
        attacking: true,
        targeted: false,
        untilEndOfTurn: true,
        annotations: [sourceAnnotation],
        ...(triggeredBy ? { triggeredBy } : {}),
      },
      provenance: { origin: 'parser', rule: RULE },
    });

    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', types: { has: ['Creature'] }, attacking: true, annotations: [sinkAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
