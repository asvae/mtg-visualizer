// New recognizer (2026-09-16, fin/26-50 pass) — structural (`Effect[]`-
// reading, same family as `destroy-effect-structural.ts`), covering
// `kind:'surveil'` — CR 701.42's own "surveil N" (`SurveilEffect`, real
// Forge `DB$ Surveil`). Real Magic templating is always the single closed
// word "surveil" immediately followed by the literal count, reminder text
// (if any) always following afterward in parentheses — no adjective/
// qualifier gap to tolerate, unlike most other recognizers in this
// catalog.
//
// **Real, whole-pool check (12 real `kind:'surveil'` occurrences) done
// first**: `dreams-of-laguna` ("Surveil 1, then draw a card."),
// `il-mheg-pixie`/`golbez-crystal-collector`/`namazu-trader`/`garland-
// knight-of-cornelia-chaos-the-endless`/`lunatic-pandora`/`valkyrie-aerial-
// unit`/`swallowed-by-leviathan` (mid-sentence lowercase "surveil N"),
// `esper-origins-summon-esper-maduin`/`summon-g-f-cerberus` (a Saga
// chapter's own "I — Surveil N." shape, capitalized after the em dash —
// same real template, just at a different real sentence-start position),
// `ultimecia-time-sorceress-ultimecia-omnipotent` (front face). Every one
// uses the plain `/\bsurveil \d+\b/i` shape — no real card in this pool
// ever surveils a `Computed`/variable amount, so unlike most other
// recognizers here there's no meaningful non-literal-`qty` decline case to
// document (checked, not assumed).
//
// **No paired sink** — `surveil` has no real "wants this present" want
// anywhere in this pool's own established convention (a look-then-choose
// action over the top of your own library has no type/zone precondition to
// assert), matching every existing hand-authored `event:'surveil'` fact
// already checked (source-only, no sink half).
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'surveil-effect-structural' as const;

type SurveilEffect = Extract<Effect, { kind: 'surveil' }>;

function isSurveilEffect(e: Effect): e is SurveilEffect {
  return e.kind === 'surveil';
}

/** True if `index` sits inside a parenthesized reminder-text span of
 * `text` — real Magic templating always repeats "surveil N" verbatim
 * inside a card's own parenthetical reminder text right after the real
 * clause (Dreams of Laguna's own "Surveil 1, ... (To surveil 1, look at
 * ...)"), so a naive whole-text search finds 2 matches for the identical
 * real claim; the parenthetical repeat is never itself a second real
 * Effect, same "quoted/parenthetical restatement isn't independently real"
 * discipline `addMana-effect-structural.ts`'s own `matchesOutsideQuotes`
 * already establishes for a different punctuation mark. */
function isInsideParens(text: string, index: number): boolean {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth = Math.max(0, depth - 1);
  }
  return depth > 0;
}

export function recognizeSurveilEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const effects = allEffects(input).map((o) => o.effect).filter(isSurveilEffect);
  if (effects.length === 0) {
    return { matched: false, reason: "no kind:'surveil' Effect on this face" };
  }

  const facts: RecognizedFact[] = [];
  const claimed = new Set<number>();
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);
  for (const effect of effects) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    if (typeof effect.qty !== 'number') {
      return { matched: false, reason: `effect's own qty (${JSON.stringify(effect.qty)}) is not a literal number — opaque, no template to build` };
    }
    const pattern = new RegExp(`\\bsurveil ${effect.qty}\\b`, 'gi');
    const matches = [...input.oracleText.matchAll(pattern)].filter((m) => !claimed.has(m.index!) && !isInsideParens(input.oracleText, m.index!));
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /surveil ${effect.qty}/i matched ${matches.length} unclaimed times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const m = matches[0]!;
    claimed.add(m.index!);
    const start = m.index!;
    const end = start + m[0]!.length;
    const annotation = toLineOffset(input.oracleText, start, end);
    if (!annotation) {
      return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
    }
    facts.push({
      role: 'source',
      fact: { event: 'surveil', controller: 'you', annotations: [annotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
