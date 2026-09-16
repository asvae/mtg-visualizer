// New recognizer (2026-09-15, fin/11-15 audit follow-up — Summon:
// Alexander's own last remaining AI-authored fact, chapters I/II's shared
// "Prevent all damage that would be dealt to creatures you control this
// turn."). Structural — reads a `kind:'grantKeywordAll'` `Effect` whose own
// `keyword` is `'DamagePrevention'` (`card.ts`'s own approximation of a real
// per-object Forge `ReplacementEffect`, see that card's own `definition.ts`
// comment for the full Forge citation).
//
// **Real, whole-pool check**: `crystal-fragments-summon-alexander`'s own
// back face is the ONLY real card using the `'DamagePrevention'` keyword at
// all (grepped directly) — narrowly scoped to that one confirmed real
// template on purpose, same "don't stretch beyond the one confirmed use"
// discipline every recognizer in this catalog follows. A future card
// granting `'DamagePrevention'` with a different real predicate/duration
// needs its own template, not a silent generalization of this one.
//
// **Two structurally-identical chapter triggers (I and II) produce two
// raw facts that collapse to one** — same `mergeRecognizedFactsByIdentity`
// runner-level dedup `apply-recognizers.mjs` already applies for any other
// recognizer facing a repeated identical Saga chapter effect (`token-
// creation-structural.ts`'s own module doc comment names the same shape for
// `summon-knights-of-round`'s own duplicate chapters).
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'preventDamageAll-effect-structural' as const;

type GrantKeywordAllEffect = Extract<Effect, { kind: 'grantKeywordAll' }>;

function isDamagePreventionAll(e: Effect): e is GrantKeywordAllEffect {
  return e.kind === 'grantKeywordAll' && e.keyword === 'DamagePrevention' && e.predicate === 'creatures-you-control';
}

export function recognizePreventDamageAllEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const matches_ = allEffects(input).map((o) => o.effect).filter(isDamagePreventionAll);
  if (matches_.length === 0) {
    return { matched: false, reason: "no kind:'grantKeywordAll' Effect with keyword:'DamagePrevention', predicate:'creatures-you-control' — the one real confirmed template this recognizer covers" };
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);
  for (const effect of matches_) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    const suffix = effect.untilEndOfTurn ? ' this turn' : '';
    const pattern = new RegExp(`\\bPrevent all damage that would be dealt to creatures you control${suffix}\\b`, 'i');
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
      fact: {
        event: 'preventDamage',
        controller: 'you',
        target: { types: { has: ['Creature'] } },
        untilEndOfTurn: effect.untilEndOfTurn,
        annotations: [annotation],
        ...(triggeredBy ? { triggeredBy } : {}),
      },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
