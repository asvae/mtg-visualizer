// Recognizer E (`PRD_AUTOMATED_AUTHORING.md`, 2026-09-13 follow-up) — reads a
// `CardDefinition`'s own `typeLine` + named `triggers` STRUCTURE directly
// (never oracle text, never Forge script) and derives the two real 714
// (Saga) facts this codebase's own `saga.ts` engine machinery already proves
// out for every real Saga in the pool:
//   - 714.2c: an unconditional, recurring lore-counter-placement fact
//     (`event: 'putCounter', counterType: 'LORE', target: 'self'`) — every
//     real Saga gets one, no exceptions found in the real pool.
//   - 714.4: a `sacrifice` + `dies` fact PAIR (self, unconditional) once
//     lore counters reach the Saga's own greatest chapter — asserted ONLY
//     when this recognizer can be sure nothing already reset those lore
//     counters first (see below).
//
// **Why structural, not oracle-text pattern matching (unlike Recognizers
// A/B/C/D)**: `saga.ts`'s own real, battle-tested derivation
// (`isSaga`/`maxChapterOf`) already reads exactly two things — a face's
// printed `typeLine` (the literal substring `Saga`, CR 714.1) and which of
// `chapterI`..`chapterV` are present as NAMED triggers on that same face
// (`CHAPTER_NAMES` there) — and needs no oracle text at all to be correct;
// mirroring it here rather than re-deriving a text-pattern equivalent
// avoids inventing a second, potentially-diverging way to answer the exact
// same question `saga.ts` already answers correctly for the live engine.
// `oracleText` is still accepted on this recognizer's own input (the shared
// `StructuralRecognizerInput`/`RecognizerInput` shape every recognizer in
// this family takes) but genuinely never read — see `recognize`'s own body.
//
// **The real, hard open problem 714.4 poses, and how this recognizer
// resolves it conservatively**: a Saga's final chapter ability, once it
// resolves, normally causes 701.16's unconditional sacrifice — UNLESS that
// same chapter's own resolution has ALREADY reset the permanent's lore
// counters via a real zone change (a "this Saga transforms back" effect,
// `state.move()`'s own 400.7 zone-change reset wiping `RealCard.counters` —
// see `saga.ts`'s own header for the full mechanism). Whether a given
// chapter's own effect does this is NOT statically readable from outside an
// opaque `kind: 'custom'` closure's `run` body (`structural-effects.ts`'s
// own doc comment: a `custom` effect's closure is a wall no static source
// can see through). So: this recognizer asserts the sacrifice+dies pair
// ONLY when the final chapter's own `effects` array (recursively, through
// any `modal` mode — same walk `collectEffects` already does) contains ZERO
// `kind: 'custom'` entries; it declines the pair (while still asserting the
// unconditional lore-counter fact) whenever the final chapter has ANY
// `custom` effect, even for a real card that doesn't actually transform back
// — a real, accepted false negative, same conservative-by-construction
// discipline every recognizer in this catalog already follows. Checked
// directly against the real FIN pool (21 real Sagas, 15 plain + 6
// transforming) rather than assumed:
//   - `jill-shiva-s-dominant-shiva-warden-of-ice` and
//     `dion-bahamut-s-dominant-bahamut-warden-of-light` (both transforming,
//     both REALLY transform back per their own chapter III's `custom`
//     "exile then return" closure) correctly decline the pair — no
//     existing hand-authored `sacrifice`/`dies` self-facts for either,
//     matching this recognizer's own conservative read exactly.
//   - `jecht-reluctant-guardian-braska-s-final-aeon` (transforming) does
//     NOT transform back (`saga.ts`'s own header names this exact card) —
//     its own chapter III is a plain `{kind:'sacrifice', owner:'opponents',
//     ...}` Effect, no `custom` at all, so this recognizer correctly
//     ACCEPTS the pair here (not a false negative — the guess that this
//     card "likely still uses a custom effect for its own unique ability"
//     was checked directly and found wrong; chapter III's own real work is
//     a plain declarative `sacrifice` Effect, not an opaque closure).
//   - `summon-leviathan` and `crystal-fragments-summon-alexander` (the
//     back face) are the two real, DELIBERATE divergences from today's
//     existing hand-authored data this recognizer produces: both already
//     carry a hand-authored `sacrifice`+`dies` self-pair in their real
//     `synergy.json`, but their own final chapters use a `custom` effect
//     for an entirely unrelated reason (a batch type-filtered bounce /
//     tap-all-opponents-creatures effect this model's declarative
//     vocabulary has no other way to express — see each card's own
//     `definition.ts` comment), not a transform-back. This recognizer
//     declines the pair for both anyway, per the letter of the rule above
//     — same `zack-fair`-style "a recognizer declining to add a fact never
//     removes or contradicts an already-authored one" precedent
//     `permanent-enters-battlefield-normally.ts`'s own module doc comment
//     already establishes. Worth a human eventually teaching this
//     recognizer to tell "custom effect that also transforms back" apart
//     from "custom effect for an unrelated reason", but that needs real
//     static insight into what a `custom` closure's `run` body actually
//     does — out of reach for ANY recognizer in this family by
//     construction, not something this one case could fix in isolation.
//
// **`value` on both produced facts is a FIXED `1`**, same convention every
// prior structural recognizer in this catalog establishes — checked the
// real pool's own EXISTING hand-authored `putCounter`/`sacrifice`/`dies`
// self-facts first: the modern convention across most of the pool
// (`summon-choco-mog`, `summon-leviathan`, `summon-primal-garuda`,
// `summon-shiva`, ...) already reads `value: 1` for all three; only
// `summon-bahamut` and `summon-knights-of-round` still carry the OLDER `-1`
// "pending `compute-weights.mjs`" placeholder for the identical real claim
// — `apply-recognizers.mjs`'s own `coreKey` dedup (which deliberately
// excludes `value`) retags those two in place without overwriting their own
// real `-1`, same "confirms existence/shape, never magnitude" rule the
// dedup pass already enforces for every other recognizer.
//
// **Annotation**: same precedent `permanent-enters-battlefield-normally.ts`
// already sets for a fact with nothing in the oracle text BODY to point at
// (a purely structural claim, licensed by the card's own basic identity,
// not its ability text) — anchor to the `typeLine` itself. Unlike that
// recognizer (which anchors to the real card-type word(s) before the em
// dash), this recognizer's own claim is licensed specifically by the
// literal `Saga` SUBTYPE word (CR 714.1's own test, `isSaga`'s own regex)
// — so it anchors to that exact word's own span, wherever it falls in the
// typeLine (after the em dash, among the subtypes), rather than reusing
// `type-line-span.ts`'s `typeWordsSpan` (which deliberately looks BEFORE
// the dash, at the supertype-stripped card type, an unrelated span here).
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { collectEffects, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'saga-lore-and-sacrifice-structural' as const;

/** Real 714.1's own "Saga" subtype check — the exact same plain typeLine
 * substring test `saga.ts`'s own `isSaga` uses, mirrored here rather than
 * imported (this recognizer family stays a self-contained, engine-agnostic
 * module — see `structural-effects.ts`'s own doc comment on why none of
 * these recognizers import live engine code). */
const SAGA_RE = /\bSaga\b/;

/** The highest chapter number this face actually has (714.3a/b's own
 * "greatest chapter number") — mirrors `saga.ts`'s own `maxChapterOf`
 * exactly (the highest-indexed `CHAPTER_NAMES` entry present as a named
 * trigger), `0` if none. */
const CHAPTER_NAMES = ['chapterI', 'chapterII', 'chapterIII', 'chapterIV', 'chapterV'] as const;

function maxChapterOf(input: StructuralRecognizerInput): number {
  let max = 0;
  for (let i = 0; i < CHAPTER_NAMES.length; i++) {
    if (input.triggers?.some((t) => t.name === CHAPTER_NAMES[i])) max = i + 1;
  }
  return max;
}

/** Whether ANY effect on this one chapter trigger (recursively, through any
 * `modal` mode) is a `kind: 'custom'` opaque closure, OR a `kind: 'program'`
 * combinator-AST effect (`combinator.ts`) — see this file's own module doc
 * comment for why this is the one real signal available, and its own known
 * limits.
 *
 * **`'program'` is treated identically to `'custom'` here, on purpose**
 * (added 2026-09-14, when Dion, Bahamut's Dominant's own chapter III
 * "exile-then-return" closure was migrated off `kind:'custom'` onto
 * `kind:'program'` — a `combinator.ts` `Sequence` of two `moveSelf` steps):
 * that migration does NOT change what the card does (still a real
 * transform-back, still no real sacrifice), so this recognizer's own
 * conservative "decline the sacrifice+dies pair whenever the final chapter
 * isn't provably free of a transform-back" read must stay unchanged too, or
 * this recognizer would start asserting a WRONG sacrifice+dies pair for
 * Dion the next time `apply-recognizers.mjs` runs (a real correctness
 * regression, not just a missed-opportunity one). A `program` effect IS
 * genuinely more inspectable than `custom` (unlike a `custom` closure's `run`
 * body, `combinator.ts`'s `walkProgram` can read a `Sequence`'s own steps
 * with zero execution) — teaching this recognizer to positively distinguish
 * "a `program` that structurally IS an exile-then-return-to-battlefield
 * sequence" from "a `program` for an unrelated reason" (Crystal Fragments/
 * Summon: Alexander's own chapter III, a real, deliberate divergence this
 * file's own module doc comment already names, is exactly that second case)
 * is real, valuable, future work this pass doesn't attempt — same
 * conservative-by-construction discipline this whole recognizer already
 * follows, just extended to cover the new node kind.
 */
function chapterHasCustomEffect(effects: Effect[] | undefined): boolean {
  const collected: Effect[] = [];
  collectEffects(effects, collected);
  return collected.some((e) => e.kind === 'custom' || e.kind === 'program');
}

/** `[start, end)` span of the literal word `Saga` inside `typeLine` — never
 * `undefined` when `SAGA_RE` already matched (the caller only calls this
 * after confirming a match), a defensive `undefined` return kept anyway so
 * this stays as honest as every other recognizer's own span helper. */
function sagaWordSpan(typeLine: string): { start: number; end: number } | undefined {
  const m = SAGA_RE.exec(typeLine);
  if (!m) return undefined;
  return { start: m.index, end: m.index + m[0].length };
}

/**
 * Reads one face's own `typeLine` + named `triggers` directly (never this
 * face's own oracle text at all — see module doc comment) and derives the
 * real 714 lore-counter fact (unconditional) plus, conditionally, the
 * sacrifice+dies pair (714.4).
 *
 * Unlike Recognizers C/D's own strict "all-or-nothing per face" shape, this
 * recognizer is DELIBERATELY partial by design: a real Saga always gets at
 * least the lore-counter fact even when the sacrifice+dies pair itself is
 * declined (see module doc comment for exactly which real cards hit that
 * split and why) — `matched: true` with 1 fact (lore-only) or 3 facts
 * (lore + sacrifice + dies) are both real, expected outcomes, not a
 * half-finished result.
 */
export function recognizeSagaLoreAndSacrificeStructural(input: StructuralRecognizerInput): RecognizerResult {
  if (!SAGA_RE.test(input.typeLine)) {
    return { matched: false, reason: `typeLine "${input.typeLine}" has no "Saga" subtype (714.1)` };
  }
  const max = maxChapterOf(input);
  if (max === 0) {
    return { matched: false, reason: 'typeLine has "Saga" but no named chapterI..chapterV trigger was found on this face' };
  }
  const span = sagaWordSpan(input.typeLine);
  if (!span) {
    return { matched: false, reason: `could not locate the literal word "Saga" inside typeLine "${input.typeLine}"` };
  }
  const annotations = [{ target: 'typeLine' as const, start: span.start, end: span.end }] as const;

  const facts: RecognizedFact[] = [
    {
      role: 'source',
      fact: { event: 'putCounter', counterType: 'LORE', target: 'self', value: 1, annotations: [...annotations] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];

  const finalChapterName = CHAPTER_NAMES[max - 1];
  const finalTrigger = input.triggers?.find((t) => t.name === finalChapterName);
  if (!chapterHasCustomEffect(finalTrigger?.effects)) {
    facts.push(
      {
        role: 'source',
        fact: { event: 'sacrifice', target: 'self', value: 1, annotations: [...annotations] },
        provenance: { origin: 'parser', rule: RULE },
      },
      {
        role: 'source',
        fact: {
          event: 'dies',
          from: 'Battlefield',
          to: 'Graveyard',
          controller: 'you',
          subject: 'self',
          target: 'self',
          value: 1,
          annotations: [...annotations],
        },
        provenance: { origin: 'parser', rule: RULE },
      },
    );
  }

  return { matched: true, facts };
}
