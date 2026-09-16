// New recognizer (2026-09-16, card-results/fin-76-100 re-triage backlog
// item #2) — structural (`Effect[]`-reading, same family as `destroy-
// effect-structural.ts`/`drawCard-effect-structural.ts`), covering `card
// .ts`'s own `kind:'counter'` Effect: `{ kind: 'counter'; describe: string
// }` — deliberately log-only (see `interfaces.ts`'s own `counter` doc
// comment, cited directly by `swallowed-by-leviathan`'s own module doc
// comment: "no real stack/object model exists to actually remove a target
// from"), so `describe` is the ONLY structured field this Effect kind
// carries at all — no `counterType`/`owner`/target-type filter to build a
// finer regex from the way every other structural recognizer in this
// catalog does.
//
// **The real, closed rule**: `describe` is already, by this Effect kind's
// own established authoring convention (confirmed against all 3 real
// occurrences below — every one of them was hand-written to closely
// paraphrase, not invent, the card's own real printed counter clause),
// close enough to the real printed clause that it appears as a literal,
// case-insensitive substring of this face's own oracle text — the ONLY
// difference ever seen is leading-word capitalization (a `describe` always
// starts a fresh sentence with a capital letter for readability, even when
// the same clause sits MID-sentence in the real printed text, e.g.
// `swallowed-by-leviathan`'s own "...Surveil 2, then counter the chosen
// spell..." vs its own `describe`'s "Counter the chosen spell..."). This
// recognizer therefore does the simplest thing that's still a real,
// falsifiable check: escape `describe` for regex specials (real curly-brace
// mana symbols like `{1}`/`{X}` need it) and require it to appear verbatim,
// case-insensitively, in the real oracle text — never a paraphrase-vs-
// paraphrase fuzzy match, an exact substring or a decline.
//
// **Real, whole-pool check, all 3 real occurrences, each confirmed against
// its own real Forge oracle text via `forge-lookup.mjs`**:
//   - `louisoix-s-sacrifice`: `describe` "Counter target activated
//     ability, triggered ability, or noncreature spell." — matches its own
//     oracle text's second line VERBATIM, same capitalization even (a fresh
//     sentence in the real text too).
//   - `swallowed-by-leviathan`: `describe` "Counter the chosen spell
//     unless its controller pays {1} for each card in your graveyard." —
//     matches mid-sentence in the real text ("...then counter the chosen
//     spell unless..."), case-insensitively only (real text has lowercase
//     "counter").
//   - `syncopate`: `describe` "Counter target spell unless its controller
//     pays {X}. If that spell is countered this way, exile it instead of
//     putting it into its owner's graveyard." — matches its own (single-
//     sentence-pair) oracle text VERBATIM, same capitalization.
//
// Fact shape: `{event:'counter', target:{}, targeted:true}` — matches all
// 3 real cards' own PRE-EXISTING hand-authored `counter` facts exactly (a
// bare, untyped `target:{}` — CR 701.5 counter magic has no permanent-type
// filter the way `destroy`/`sacrifice` do; `targeted:true` since every real
// use in this pool is a "target spell/ability," a real CR 601.2c choice
// among legal candidates), never a differently-shaped invention.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'counter-effect-structural' as const;

type CounterEffect = Extract<Effect, { kind: 'counter' }>;

function isCounterEffect(e: Effect): e is CounterEffect {
  return e.kind === 'counter';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function recognizeCounterEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const counterEffects = allEffects(input).map((o) => o.effect).filter(isCounterEffect);
  if (counterEffects.length === 0) {
    return { matched: false, reason: "no kind:'counter' Effect on this face" };
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of counterEffects) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    const pattern = new RegExp(escapeRegExp(effect.describe), 'i');
    const global = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(global)];
    if (matches.length === 0) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `this effect's own describe ("${effect.describe}") was not found verbatim (case-insensitively) in oracle text "${input.oracleText}"`,
      };
    }
    if (matches.length > 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `this effect's own describe ("${effect.describe}") matched ${matches.length} times — ambiguous, declining rather than guessing which`,
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
      fact: { event: 'counter', target: {}, targeted: true, annotations: [annotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
