// New recognizer (2026-09-15) — structural, sibling of `move-effect-
// structural.ts` (that file covers `kind:'move', target:true`; this one
// covers the UNTARGETED "search your library for a[n] <type> card, reveal
// it, put it into your hand, then shuffle" template instead — a real,
// clean, closed Magic template `cloud-midgar-mercenary`'s own
// `definition.ts` comment already identified, along with the real reason it
// used to be un-mechanizable: "Every real candidate this shape... has a
// confirmed, systemic divergence between the structured `validType` field
// and the actual printed type word" — CLOSED for real this pass, not
// papered over, by extending `move`'s own `subtype` field (previously
// TARGETED-branch-only, `card.ts`'s own doc comment) to be read for the
// UNTARGETED branch too (`card.ts`'s `case 'move'`, `interfaces.ts`'s
// `move` signature, `harness.ts`'s own implementation — all 3 updated the
// same pass as this recognizer).
//
// **The general rule, checked against all 3 real candidates**: prefer
// `effect.subtype`'s own literal word (the MORE PRECISE real restriction,
// when set) over `validType`'s own generic word; build "search your
// library for a[n] <word> card, reveal it, put it into your hand, then
// shuffle"; require it to appear verbatim, exactly once, or decline
// (`kind:'mismatch'`) — same conservative discipline as every other
// structural recognizer here.
//
// **Widened 2026-09-16 (`verify-text-coverage.mjs` pass): the matched (and
// annotated) clause now extends through "..., reveal it, put it into your
// hand, then shuffle"**, not just "search your library for a[n] <word>
// card" — the shorter span left the actual move-to-Hand action and the
// real CR 701.19 shuffle consequence permanently uncovered on
// `cloud-midgar-mercenary` (the one real card in this pool where this whole
// sentence is PRINTED text, not reminder text — the other 5 real cards
// using this recognizer, all basic-Landcycling reminder-text parentheticals,
// were already covered regardless, since `verify-text-coverage.mjs` treats
// any `(...)` span as always-covered). Same "the surrounding clause is
// squarely part of what the Fact claims" reasoning every other widening this
// same pass applies — one continuous, comma-joined real sentence, not a
// separate grammatical sentence the way delivery-moogle's own trailing "If
// you search your library this way, shuffle." is (that one stayed a
// separate `annotatedNonFactSpans` entry for exactly that reason). Also
// fixed a real, related bug alongside this: `cloud-midgar-mercenary`'s own
// `definition.ts` never set `shuffleAfter: true` on this effect at all
// (unlike every basic-Landcycling card, which already does via
// `cycling.ts`'s shared factory) — a genuine, previously-unmodeled CR
// 701.19 omission, same class as delivery-moogle's own identical gap fixed
// one pass earlier.
//   - **`cloud-midgar-mercenary` (fin/10) — MATCHED, the real motivating
//     case.** `subtype:'Equipment'` (newly added this pass, replacing the
//     former honest-approximation `validType:'artifact'`) builds "search
//     your library for an Equipment card" — verbatim in the real text.
//   - **`sazh-katzroy` — still correctly declines, a DIFFERENT real gap,
//     not closed by this pass**: real text is "a Bird OR BASIC LAND card"
//     — a compound OR-restriction (two type words, not one) this
//     recognizer's own single-word template can't build, AND "basic" is a
//     real MTG SUPERTYPE this engine's Card model has no concept of at all
//     (checked directly: no `isBasic`/supertype field anywhere in
//     `interfaces.ts`/`state.ts`) — a materially different, bigger gap
//     (new supertype-tracking engine surface) than Cloud's own (an
//     already-existing field's read-path extended one branch further), not
//     attempted in this pass.
//   - **`world-map` — still correctly declines, for the SAME reason**: its
//     own FIRST ability ("Search your library for A BASIC land card") hits
//     the identical missing-supertype wall; its SECOND ability ("Search
//     your library for A LAND card," no "basic" restriction) would
//     actually verify cleanly in isolation, but this recognizer's own
//     "every qualifying effect on this face must verify, or the whole face
//     declines" discipline (same as `destroy-effect-structural.ts`/`move-
//     effect-structural.ts`) means the first ability's own decline takes
//     the whole card down with it — a real, accepted, named tradeoff, not
//     an oversight.
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit): the sink used to reuse the SAME whole-clause span as SOURCE
// (including the "reveal it, put it into your hand, then shuffle" tail,
// which describes the move-to-hand ACT, not the library precondition the
// sink actually claims) -- narrowed to just "a/an <type> card" (the object
// phrase, what the sink claims must be present in the library). SOURCE
// keeps the WHOLE clause unchanged, preserving the "reveal .../shuffle"
// text-coverage fix documented above (that fix only ever needed SOME fact
// to cover the tail, and SOURCE still does).
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'moveSearchLibrary-effect-structural' as const;

type MoveEffect = Extract<Effect, { kind: 'move' }>;

function isSearchLibraryEffect(e: Effect): e is MoveEffect {
  return e.kind === 'move' && e.from === 'Library' && e.to === 'Hand' && !e.target && e.owner === 'you';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The real printed type-word this effect's own structured data implies —
 * `effect.subtype`'s own literal word (the precise, real restriction) takes
 * priority over `validType`'s own generic word (see module doc comment).
 * `undefined` (never guessed) when neither field gives a confirmed,
 * single-word template. */
function typeWordFor(effect: MoveEffect): string | undefined {
  if (typeof effect.qty !== 'number' || effect.qty !== 1) return undefined; // no real qty>1 template
  // `effect.subtype` widened to `string | string[]` (2026-09-16, Phoenix
  // Down's own real targeted "Skeleton, Spirit, or Zombie" OR-set) — no
  // real UNTARGETED library search in this pool needs an OR-set subtype
  // (this recognizer's own real scope), and an array wouldn't cleanly
  // reduce to one confirmed English word anyway, so decline rather than
  // guess (same "no confirmed template" treatment every other unconfirmed
  // shape here already gets).
  if (Array.isArray(effect.subtype)) return undefined;
  if (effect.subtype) return effect.subtype;
  if (effect.validType === 'creature') return 'creature';
  if (effect.validType === 'artifact') return 'artifact';
  if (effect.validType === 'land') return 'land';
  return undefined; // 'any'/undefined validType with no subtype has no confirmed single-word template
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

export function recognizeMoveSearchLibraryEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const effects = allEffects(input).map((o) => o.effect).filter(isSearchLibraryEffect);
  if (effects.length === 0) {
    return { matched: false, reason: "no untargeted, owner:'you', from:'Library'-to:'Hand' kind:'move' Effect on this face" };
  }

  const lines = input.oracleText.split('\n');
  const claimedLines = new Set<number>();
  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of effects) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    const typeWord = typeWordFor(effect);
    if (!typeWord) {
      return {
        matched: false,
        reason: `a search-library move effect on this face (${JSON.stringify(effect)}) has no confirmed single-word type template (no subtype, and validType is omitted/'any' — see module doc comment)`,
      };
    }
    // Group 1 the object phrase ("a/an <type> card," the thing this
    // search's own SINK claims must be present in the library) — narrows
    // the paired SINK's own annotation; SOURCE keeps the WHOLE matched
    // clause unchanged (2026-09-16 SOURCE/SINK span-narrowing fix, same
    // class as the sibling fixes elsewhere in this catalog — see this
    // file's own module doc comment).
    const objectPhrase = `${article(typeWord)} ${escapeRegExp(typeWord)} card`;
    const phrase = `search your library for (${objectPhrase}), reveal it, put it into your hand, then shuffle`;
    const pattern = new RegExp(`\\b${phrase}\\b`, 'id');
    let claimedLine: number | undefined;
    let matchStart: number | undefined;
    let matchEnd: number | undefined;
    let objectStart: number | undefined;
    let objectEnd: number | undefined;
    for (let i = 0; i < lines.length; i++) {
      if (claimedLines.has(i)) continue;
      const m = pattern.exec(lines[i]!) as (RegExpExecArray & { indices: Array<[number, number] | undefined> }) | null;
      if (m) {
        claimedLine = i;
        matchStart = m.index;
        matchEnd = m.index + m[0].length;
        [objectStart, objectEnd] = m.indices[1]!;
        break;
      }
    }
    if (claimedLine === undefined || matchStart === undefined || matchEnd === undefined || objectStart === undefined || objectEnd === undefined) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected phrase /${pattern.source}/ not found on any real, not-yet-claimed oracle-text line (oracle text: "${input.oracleText}")`,
      };
    }
    claimedLines.add(claimedLine);

    const annotation = { target: 'oracle' as const, line: claimedLine, start: matchStart, end: matchEnd };
    const objectAnnotation = { target: 'oracle' as const, line: claimedLine, start: objectStart, end: objectEnd };
    facts.push({
      role: 'source',
      fact: { from: 'Library', to: 'Hand', controller: 'you', types: { has: [typeWord] }, annotations: [annotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Library', controller: 'you', types: { has: [typeWord] }, annotations: [objectAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
