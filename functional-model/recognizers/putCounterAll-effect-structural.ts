// New recognizer (2026-09-16, fin/26-50 pass) — structural (`Effect[]`-
// reading, same family as `destroy-effect-structural.ts`/`grantKeywordAll-
// effect-structural.ts`), covering `kind:'putCounterAll'` — a declarative
// (not `kind:'custom'`) board-wide counter broadcast. Sibling of
// `putCounter-broadcast-structural.ts` (that one covers the SAME real Fact
// shape but for a `kind:'custom'` closure, executed via `runtime-action-
// probe.ts`; this one reads the declarative Effect fields directly, no
// execution needed) — the two recognizers deliberately share the exact
// same `{event:'putCounter', target, targeted:false}` Fact shape.
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit): this file used to annotate the WHOLE "put ... counter on each
// ..." clause identically for both SOURCE and SINK — the same bug already
// fixed in the sibling `putCounter-broadcast-structural.ts` (this
// recognizer's own module doc comment used to, wrongly, describe that
// whole-clause reuse as a deliberate shared convention with that file; it
// wasn't — that file's own fix predates this one and this file just
// hadn't been brought in line with it yet). `buildPattern` now splits into
// 2 capturing groups — group 1 the ACTION clause ("put <article>
// <counterType> counter on"), group 2 the narrower SUBJECT/object phrase
// ("each <type> you control"/"each of them") — same "whole action-clause
// source, narrow object-phrase sink" split every other sibling fix in this
// catalog already establishes.
//
// **Real, whole-pool check (3 real `kind:'putCounterAll'` occurrences)
// done first**:
//   - Minwu, White Mage (`subtype:'Cleric'`, no `notSelf`): "put a +1/+1
//     counter on each Cleric you control."
//   - Sidequest: Catch a Fish // Cooking Campsite's own back face (no
//     subtype/notSelf): "Put a +1/+1 counter on each creature you control."
//   - Summon: Knights of Round chapter V (`notSelf:true`, no subtype,
//     `counterType:'Indestructible'`): "Put an indestructible counter on
//     each of them." — real, ANAPHORIC "each of them" (referring back to
//     the SAME sentence's own preceding "Other creatures you control" from
//     its paired `pumpAll` effect, see `pumpAllCreaturesYouControl-effect-
//     structural.ts`) — the one real `notSelf` case in this pool, so this
//     recognizer's own `notSelf` subject candidate is "each of them" ONLY
//     (no second, more literal "each other creature you control" candidate
//     has ever been checked against a real card — unlike
//     `grantKeywordAll-effect-structural.ts`'s own 2-candidate `notSelf`
//     treatment, which DOES have 2 confirmed real cases to justify trying
//     both).
//
// **Counter-type vocabulary, deliberately closed and small** (mirrors
// `sacrificeCostNamedType-structural.ts`'s own closed-vocabulary
// discipline for a different field): only `'+1/+1'` ("a +1/+1 counter")
// and `'Indestructible'` ("an indestructible counter") have a confirmed
// real English rendering in this pool — any other `counterType` declines
// rather than guessing an article/casing.
//
// **`amount` must be the literal number `1`** — every real occurrence in
// this pool puts exactly one counter per qualifying permanent; a
// `Computed<number>` (opaque) or literal `amount !== 1` (no confirmed
// "two counters"-style plural template checked) both decline.
import type { Effect } from '../card';
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'putCounterAll-effect-structural' as const;

type PutCounterAllEffect = Extract<Effect, { kind: 'putCounterAll' }>;

function isPutCounterAllEffect(e: Effect): e is PutCounterAllEffect {
  return e.kind === 'putCounterAll' && e.predicate === 'creatures-you-control';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const COUNTER_TYPE_PHRASE: Partial<Record<string, { article: 'a' | 'an'; word: string }>> = {
  '+1/+1': { article: 'a', word: '+1/+1' },
  Indestructible: { article: 'an', word: 'indestructible' },
};

function subjectCandidates(e: PutCounterAllEffect): string[] | undefined {
  if (e.subtype && e.notSelf) return undefined; // no real card combines both — unconfirmed template
  if (e.subtype) return [`each ${escapeRegExp(e.subtype)} you control`];
  if (e.notSelf) return ['each of them'];
  return ['each creature you control'];
}

function buildTarget(e: PutCounterAllEffect): Constraints {
  const types = { has: e.subtype ? ['Creature', e.subtype] : ['Creature'] };
  const target: Constraints = { types };
  if (e.notSelf) (target as Constraints & { excludeSelf?: boolean }).excludeSelf = true;
  return target;
}

export function recognizePutCounterAllEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const all = allEffects(input).map((o) => o.effect).filter((e): e is PutCounterAllEffect => e.kind === 'putCounterAll' && e.predicate === 'creatures-you-control');
  if (all.length === 0) {
    return { matched: false, reason: "no kind:'putCounterAll', predicate:'creatures-you-control' Effect on this face" };
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);
  for (const effect of all) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    if (typeof effect.amount !== 'number' || effect.amount !== 1) {
      return { matched: false, reason: `effect's own amount (${JSON.stringify(effect.amount)}) is not the literal number 1 — no confirmed template for anything else` };
    }
    const phrase = COUNTER_TYPE_PHRASE[effect.counterType];
    if (!phrase) {
      return { matched: false, reason: `counterType "${effect.counterType}" has no confirmed English rendering in this recognizer's own closed vocabulary` };
    }
    const subjects = subjectCandidates(effect);
    if (!subjects) {
      return { matched: false, reason: 'subtype + notSelf combined — no confirmed real English template for this combination' };
    }

    let clauseMatch: (RegExpMatchArray & { indices: Array<[number, number] | undefined> }) | undefined;
    for (const subject of subjects) {
      const pattern = new RegExp(`\\b(put ${phrase.article} ${escapeRegExp(phrase.word)} counter on) (${subject})\\b`, 'id');
      const global = new RegExp(pattern.source, pattern.flags + 'g');
      const matches = [...input.oracleText.matchAll(global)] as Array<RegExpMatchArray & { indices: Array<[number, number] | undefined> }>;
      if (matches.length > 1) {
        return { matched: false, kind: 'mismatch', reason: `expected clause /${pattern.source}/ matched ${matches.length} times — ambiguous` };
      }
      if (matches.length === 1) {
        if (clauseMatch) {
          return { matched: false, kind: 'mismatch', reason: '2 different subject candidates both matched — ambiguous, declining rather than guessing which' };
        }
        clauseMatch = matches[0];
      }
    }
    if (!clauseMatch) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `no candidate "put ${phrase.article} ${phrase.word} counter on <subject>" clause found in oracle text "${input.oracleText}"`,
      };
    }

    const [sourceStart, sourceEnd] = clauseMatch.indices[1]!;
    const [sinkStart, sinkEnd] = clauseMatch.indices[2]!;
    const sourceAnnotation = toLineOffset(input.oracleText, sourceStart, sourceEnd);
    const sinkAnnotation = toLineOffset(input.oracleText, sinkStart, sinkEnd);
    if (!sourceAnnotation || !sinkAnnotation) {
      return { matched: false, reason: `matched span [${sourceStart},${sinkEnd}) (or its own inner source/sink split spans) did not resolve to a single real oracle-text line` };
    }

    const target = buildTarget(effect);
    facts.push({
      role: 'source',
      fact: { event: 'putCounter', counterType: effect.counterType, controller: 'you', target, targeted: false, annotations: [sourceAnnotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', types: target.types!, ...(effect.notSelf ? { excludeSelf: true } : {}), annotations: [sinkAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
