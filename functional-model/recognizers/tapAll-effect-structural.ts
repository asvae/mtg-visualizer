// New recognizer (2026-09-16, card-results/fin-51-75 triage backlog item
// #8). Structural — reads a face's own bare `kind:'tapAll'` `Effect`
// directly (`card.ts`'s own `TapAllEffect`, `{kind:'tapAll', predicate:
// 'lands', owner}`), a genuinely different real shape from
// `tapAllQuery-effect-structural.ts`'s own `kind:'program'`/combinator
// `Each({kind:'query'}, tap())` — that recognizer's own module doc comment
// explains why the combinator form exists at all (`Query.source` has no
// `'lands'` option, forcing the one real land-tap-all card to use the
// direct declarative `tapAll` Effect kind instead of the combinator DSL).
// No recognizer read this bare `Effect` shape at all until now.
//
// **Real, whole-pool check — exactly 1 real occurrence**:
// `jill-shiva-s-dominant-shiva-warden-of-ice`'s own back face (Shiva,
// Warden of Ice), Saga chapter III — "Tap all lands your opponents
// control." `predicate` is a closed 1-value union today (`'lands'`, the
// only predicate this Effect kind supports), so no scope decline is needed
// for that field; only `owner` varies and only `'opponents'` has a real,
// confirmed English template to check against (no real card uses
// `owner:'you'`/`'each'` with this Effect kind to verify a different
// template against).
//
// **Paired SINK fact** — same "one real clause names both what happens and
// what it wants present" convention `tapAllQuery-effect-structural.ts`'s
// own sink already establishes for the sibling combinator-form recognizer.
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit, same class as the sibling fixes elsewhere in this catalog): the
// sink used to reuse the SOURCE's own whole-clause span byte-for-byte
// (Shiva, Warden of Ice's own sink covered the ENTIRE "Tap all lands your
// opponents control," when the sink only actually claims "a land an
// opponent controls exists"). `Tap` is now its own capturing group
// (source), "all lands your opponents control" a second, separate one
// (sink) — same split `tapTarget-effect-structural.ts`'s own confirmed fix
// already establishes for a different `tap`-shaped recognizer.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'tapAll-effect-structural' as const;

type TapAllEffect = Extract<Effect, { kind: 'tapAll' }>;

function isTapAllEffect(e: Effect): e is TapAllEffect {
  return e.kind === 'tapAll';
}

export function recognizeTapAllEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const effects = allEffects(input).map((o) => o.effect).filter(isTapAllEffect);
  if (effects.length === 0) {
    return { matched: false, reason: "no kind:'tapAll' Effect on this face" };
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of effects) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    if (effect.predicate !== 'lands' || effect.owner !== 'opponents') {
      return {
        matched: false,
        reason: `predicate:'${effect.predicate}'/owner:'${effect.owner}' — only predicate:'lands', owner:'opponents' has a confirmed real English template ("Tap all lands your opponents control")`,
      };
    }

    const pattern = /\b(Tap) (all lands your opponents control)\b/i;
    const global = new RegExp(pattern.source, pattern.flags + 'gd');
    const matches = [...input.oracleText.matchAll(global)] as Array<RegExpMatchArray & { indices: Array<[number, number] | undefined> }>;
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected phrase /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const m = matches[0]!;
    const [sourceStart, sourceEnd] = m.indices[1]!;
    const [sinkStart, sinkEnd] = m.indices[2]!;
    const sourceAnnotation = toLineOffset(input.oracleText, sourceStart, sourceEnd);
    const sinkAnnotation = toLineOffset(input.oracleText, sinkStart, sinkEnd);
    if (!sourceAnnotation || !sinkAnnotation) {
      return { matched: false, reason: `matched span [${sourceStart},${sinkEnd}) (or its own inner source/sink split spans) did not resolve to a single real oracle-text line` };
    }

    facts.push({
      role: 'source',
      fact: { event: 'tap', controller: 'opp', target: { types: { has: ['Land'] } }, targeted: false, annotations: [sourceAnnotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'opp', types: { has: ['Land'] }, annotations: [sinkAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
