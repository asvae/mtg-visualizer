// New recognizer (2026-09-15, fin/11-15 audit follow-up — Delivery
// Moogle's own real two-zone tutor, the one card that forced `move`'s own
// `from` field to widen to `ZoneType | ZoneType[]` and gain a new
// `maxCmc` field, card.ts). Structural — sibling of `moveSearchLibrary-
// effect-structural.ts` (that file covers the single-zone `from:'Library'`
// template; this one covers the real, DIFFERENT "search your library
// AND/OR GRAVEYARD for a[n] <type> card with mana value N or less"
// template Delivery Moogle alone needs — real Forge dual-`Origin` shape,
// `Origin$ Library | OriginAlternative$ Graveyard`, `card.ts`'s own
// `move.from` doc comment).
//
// **Real, whole-pool check**: Delivery Moogle is the ONLY real card in
// this pool whose own `kind:'move'` effect sets a real `ZoneType[]`
// `from` (grepped directly) — this recognizer's own template is scoped to
// exactly that one confirmed real shape (`from` is an array containing
// EXACTLY `'Library'` and `'Graveyard'`, in either order — CR 701.19 makes
// no distinction between the two once both are eligible, so this
// recognizer doesn't care which order the array lists them in, only that
// both are present and nothing else is). A future card combining a
// DIFFERENT zone pair needs its own template, not a silent stretch of
// this one.
//
// **Four facts total (2 zones x source+sink), ALL FOUR now sharing ONE
// full-clause annotation** — widened 2026-09-16 (`verify-text-coverage.mjs`
// pass). Originally each zone's own pair anchored ONLY to that zone's own
// bare noun ("your library"/"graveyard" alone, matching Delivery Moogle's
// own pre-existing hand-authored facts byte-for-byte) — same "confirm
// broadly, annotate narrowly" split `pumpSelf-effect-structural.ts`'s own
// "gets ±P/±T"-only annotation establishes for a different recognizer, but
// here it left "for an artifact card with mana value 2 or less, reveal it,
// and put it into your hand" — the type/cmc constraint AND the actual
// move-to-Hand action both facts genuinely claim — permanently uncovered.
// Same "the surrounding clause is squarely part of what the Fact claims,
// not flavor" reasoning `dealDamage-effect-structural.ts`'s own subject-
// prefix widening already established: the annotation now spans the WHOLE
// "search your library and/or graveyard for a[n] <type> card with mana
// value N or less, reveal it, and put it into your hand" clause for every
// one of the 4 facts (both zones' source AND sink) — real, accepted
// duplication (the identical real clause backs all 4), not an attempt to
// disambiguate library vs. graveyard (CR 701.19 treats the combined pool as
// one search either way, so there's nothing to disambiguate). The
// trailing "If you search your library this way, shuffle." sentence is
// deliberately NOT included — maps to this same Effect's own real
// `shuffleAfter` field but has no Fact of its own (this pool's established
// "no vocabulary for a bare shuffle consequence" rule, see this card's own
// `progress.json` knownGaps) — accounted for instead via a real
// `annotatedNonFactSpans` entry (kind: 'definition-path') on that same
// `progress.json`, not folded into this recognizer's own Fact annotation.
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit, same pass as the widening above but a distinct fix): both SINKS
// used to reuse the SAME whole-clause span as both SOURCES (including the
// "reveal it, and put it into your hand" tail, which describes the
// move-to-Hand ACT, not the library/graveyard precondition the sinks
// actually claim) -- narrowed to just "a/an <type> card with mana value N
// or less" (the object phrase, what the sinks claim must be present).
// Both SOURCES keep the WHOLE clause unchanged, preserving the
// text-coverage widening above (that fix only ever needed SOME fact to
// cover the tail, and the 2 sources still do).
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'moveSearchLibraryOrGraveyard-effect-structural' as const;

type MoveEffect = Extract<Effect, { kind: 'move' }>;

function isLibraryOrGraveyardSearch(e: Effect): e is MoveEffect {
  if (e.kind !== 'move' || e.target || e.to !== 'Hand' || e.owner !== 'you') return false;
  if (!Array.isArray(e.from) || e.from.length !== 2) return false;
  const zones = new Set(e.from);
  return zones.has('Library') && zones.has('Graveyard') && e.maxCmc !== undefined;
}

/** Same TitleCase mapping `move-effect-structural.ts`'s own
 * `buildTargetConstraint` already establishes for the identical
 * `validType` vocabulary — kept as its own small copy here (this
 * recognizer family's own "duplicate a small helper per file, never
 * extract" convention, same as every `selfSubjectAlternation` copy). */
function typeWordFor(effect: MoveEffect): string | undefined {
  if (typeof effect.qty !== 'number' || effect.qty !== 1) return undefined;
  // `effect.subtype` widened to `string | string[]` (2026-09-16, Phoenix
  // Down's own real targeted OR-set need) — same decline-rather-than-guess
  // treatment `moveSearchLibrary-effect-structural.ts`'s own identical
  // `typeWordFor` helper already gets; no real untargeted library-search
  // card in this pool needs an OR-set subtype.
  if (Array.isArray(effect.subtype)) return undefined;
  if (effect.subtype) return effect.subtype;
  if (effect.validType === 'creature') return 'creature';
  if (effect.validType === 'artifact') return 'artifact';
  if (effect.validType === 'land') return 'land';
  return undefined;
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function recognizeMoveSearchLibraryOrGraveyardEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const effects = allEffects(input).map((o) => o.effect).filter(isLibraryOrGraveyardSearch);
  if (effects.length === 0) {
    return { matched: false, reason: "no untargeted, owner:'you', to:'Hand', from:['Library','Graveyard'] kind:'move' Effect (with maxCmc set) on this face" };
  }

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
        reason: `a Library-or-Graveyard search move effect on this face (${JSON.stringify(effect)}) has no confirmed single-word type template (see module doc comment)`,
      };
    }
    const objectPhrase = `${article(typeWord)} ${escapeRegExp(typeWord)} card with mana value ${effect.maxCmc} or less`;
    const phrase = `search your library and/or graveyard for (${objectPhrase}), reveal it, and put it into your hand`;
    const pattern = new RegExp(`\\b${phrase}\\b`, 'id');
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
    const clauseStart = m.index!;
    const clauseEnd = clauseStart + m[0]!.length;
    const [objectStart, objectEnd] = m.indices[1]!;

    const annotation = toLineOffset(input.oracleText, clauseStart, clauseEnd);
    const objectAnnotation = toLineOffset(input.oracleText, objectStart, objectEnd);
    if (!annotation || !objectAnnotation) {
      return { matched: false, reason: `matched span [${clauseStart},${clauseEnd}) did not resolve to a single real oracle-text line` };
    }

    const typeConstraint = { has: [titleCase(typeWord)] };
    const cmcConstraint = { max: effect.maxCmc };

    facts.push({
      role: 'source',
      fact: { from: 'Library', to: 'Hand', controller: 'you', types: typeConstraint, cmc: cmcConstraint, annotations: [annotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'source',
      fact: { from: 'Graveyard', to: 'Hand', controller: 'you', types: typeConstraint, cmc: cmcConstraint, annotations: [annotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Library', controller: 'you', types: typeConstraint, cmc: cmcConstraint, annotations: [objectAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Graveyard', controller: 'you', types: typeConstraint, cmc: cmcConstraint, annotations: [objectAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
