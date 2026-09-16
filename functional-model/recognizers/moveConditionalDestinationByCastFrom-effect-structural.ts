// New recognizer (2026-09-15, fin/16-25 pass) — structural, sibling of
// `moveSearchLibrary-effect-structural.ts`, covering `kind:'move'`'s own
// `to: Computed<ZoneType>` widening (`card.ts`, this same pass — From
// Father to Son's own real "put it into your hand. If this spell was cast
// from a graveyard, put that card onto the battlefield instead" — CR
// 601.2c's destination genuinely depends on `ctx.castFrom`, no OTHER real
// `move` effect in this pool has a non-literal `to`).
//
// **How this classifies a closure `to` without a runtime-action-probe**:
// unlike a `kind:'custom'` effect's own opaque `run(ctx, actions)` body
// (needs the full fake-board probe), `move.to` is a PURE `(ctx) => ZoneType`
// function with no side effects — this recognizer just CALLS it twice, once
// with a fake `{castFrom:'hand'}` context and once with
// `{castFrom:'graveyard'}`, and reads the two real return values directly.
// Declines (scope) unless calling it both ways yields two DIFFERENT zones
// (a same-zone result either means it isn't really conditional, or the
// closure reads something other than `castFrom` — this recognizer only
// confirms the ONE real, motivating shape).
//
// **The type-word gap, CLOSED for real, same day** — this card's own real
// printed type restriction is "a Vehicle card." An earlier version of this
// comment claimed no Vehicle-subtype tracking existed anywhere in this
// engine for a Library card — checked again and found WRONG: `state.ts`'s
// `GameState.addCard(owner, zone, opts)` takes `opts.subtypes` regardless of
// `zone`, so a Library card can carry a real `subtypes:['Vehicle']` the same
// as a Battlefield one. `from-father-to-son`'s own `definition.ts` now sets
// `subtype:'Vehicle'` on the effect itself (same field `moveSearchLibrary-
// effect-structural.ts`'s own module doc comment already established the
// "prefer subtype's own literal word over validType's generic one" rule
// for), and this recognizer now reads it the same way, deriving a real
// `types:{has:['Vehicle']}` fact — checked against a real, required "search
// your library for a Vehicle card" clause, same conservative discipline as
// every other word this catalog derives from a closed vocabulary. This
// SUPERSEDES the card's own former hand-authored `types:{has:['Vehicle']}`
// facts (identical shape, now parser-derived instead) — no separate
// "Artifact-typed approximation alongside a Vehicle-typed hand fact" split
// needed anymore.
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit): the sink used to reuse the SAME whole "Search your library for
// a Vehicle card, reveal it, and put it into your hand" span as the
// normal-zone SOURCE -- narrowed to just "a Vehicle card" (the object
// phrase, what the sink claims must be present in the library). SOURCE
// keeps the WHOLE clause unchanged.
import type { Effect, EffectContext } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'moveConditionalDestinationByCastFrom-effect-structural' as const;

type MoveEffect = Extract<Effect, { kind: 'move' }>;

function isCandidateEffect(e: Effect): e is MoveEffect {
  return e.kind === 'move' && !e.target && e.owner === 'you' && e.from === 'Library' && typeof e.to === 'function' && e.qty === 1;
}

const ZONE_PHRASE: Partial<Record<string, string>> = {
  Hand: 'into your hand',
  Battlefield: 'onto the battlefield',
  Graveyard: 'into your graveyard',
  Exile: 'into exile',
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function recognizeMoveConditionalDestinationByCastFromEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const candidates = allEffects(input).map((o) => o.effect).filter(isCandidateEffect);
  if (candidates.length === 0) {
    return { matched: false, reason: "no kind:'move' Effect on this face shaped {owner:'you', from:'Library', target:undefined, qty:1, to:<function>}" };
  }
  if (candidates.length > 1) {
    return { matched: false, reason: 'more than one qualifying conditional-destination move effect on this face — no confirmed real template for that' };
  }
  const effect = candidates[0]!;
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const triggeredBy = triggeredByOf(effectSourceMap(input).get(effect));

  const handFakeCtx = { castFrom: 'hand' } as EffectContext;
  const graveyardFakeCtx = { castFrom: 'graveyard' } as EffectContext;
  const normalZone = (effect.to as (ctx: EffectContext) => string)(handFakeCtx);
  const graveyardZone = (effect.to as (ctx: EffectContext) => string)(graveyardFakeCtx);
  if (normalZone === graveyardZone) {
    return { matched: false, reason: `effect.to returned the same zone (${normalZone}) for both a 'hand' and 'graveyard' castFrom — not really conditional, or reads something other than castFrom` };
  }
  const normalPhrase = ZONE_PHRASE[normalZone];
  const graveyardPhrase = ZONE_PHRASE[graveyardZone];
  if (!normalPhrase || !graveyardPhrase) {
    return { matched: false, reason: `one of the two resolved zones (${normalZone}/${graveyardZone}) has no confirmed English destination phrase` };
  }

  // Prefer `effect.subtype`'s own literal word (the MORE PRECISE real
  // restriction, when set) over `validType`'s own generic word — same real
  // rule `moveSearchLibrary-effect-structural.ts`'s own module doc comment
  // establishes (From Father to Son's own real "Vehicle card," closed
  // 2026-09-15 once a Library card could genuinely carry a `subtypes`
  // array — see `definition.ts`'s own corrected doc comment). Required to
  // appear verbatim in a real "search your library for a[n] <word> card"
  // clause, same conservative discipline, before this word is trusted.
  // `effect.subtype` widened to `string | string[]` (2026-09-16, Phoenix
  // Down's own real targeted OR-set need) — this recognizer's own real
  // scope is a single-word "search your library for a[n] X card" clause,
  // which an OR-set subtype can't reduce to; decline rather than guess
  // (same treatment `moveSearchLibrary-effect-structural.ts`'s own
  // identical `typeWordFor` helper gives).
  const subtypeWord = Array.isArray(effect.subtype) ? undefined : effect.subtype;
  const typeWord = subtypeWord ?? (effect.validType === 'artifact' ? 'Artifact' : effect.validType === 'creature' ? 'Creature' : effect.validType === 'land' ? 'Land' : undefined);
  if (!typeWord) {
    return { matched: false, reason: `no confirmed English type word for validType "${effect.validType}"/subtype "${effect.subtype}"` };
  }
  const article = /^[aeiou]/i.test(typeWord) ? 'an' : 'a';
  // Group 1 the object phrase ("a/an <type> card," the thing the paired
  // SINK actually claims must be present in the library) — narrows the
  // SINK's own annotation below (2026-09-16 SOURCE/SINK span-narrowing
  // fix, same class as `moveSearchLibrary-effect-structural.ts`'s own
  // identical fix). SOURCE keeps the WHOLE search+put clause unchanged.
  const searchPattern = new RegExp(`\\bsearch your library for (${article} ${escapeRegExp(typeWord)} card)\\b`, 'id');
  const searchMatches = [...input.oracleText.matchAll(new RegExp(searchPattern.source, searchPattern.flags + 'g'))] as Array<
    RegExpMatchArray & { indices: Array<[number, number] | undefined> }
  >;
  if (searchMatches.length !== 1) {
    return { matched: false, kind: 'mismatch', reason: `expected clause /${searchPattern.source}/ matched ${searchMatches.length} times (want exactly 1) in oracle text "${input.oracleText}"` };
  }
  const searchM = searchMatches[0]!;
  const [objectStart, objectEnd] = searchM.indices[1]!;

  const normalPattern = new RegExp(`\\bput (?:it|that card) ${escapeRegExp(normalPhrase)}\\b`, 'i');
  // WIDENED (2026-09-16, fin/20-47 pass) — an optional trailing " instead"
  // (From Father to Son's own real "put that card onto the battlefield
  // instead") now counts as part of THIS clause, not a separate uncovered
  // word; the alternative destination genuinely IS the "instead" being
  // described, same one Fact.
  const graveyardPattern = new RegExp(`\\bcast from a graveyard\\b[^.\\n]*?\\bput (?:it|that card) ${escapeRegExp(graveyardPhrase)}\\b(?: instead)?`, 'i');

  const normalMatches = [...input.oracleText.matchAll(new RegExp(normalPattern.source, normalPattern.flags + 'g'))];
  if (normalMatches.length !== 1) {
    return { matched: false, kind: 'mismatch', reason: `expected clause /${normalPattern.source}/ matched ${normalMatches.length} times (want exactly 1) in oracle text "${input.oracleText}"` };
  }
  const graveyardMatches = [...input.oracleText.matchAll(new RegExp(graveyardPattern.source, graveyardPattern.flags + 'g'))];
  if (graveyardMatches.length !== 1) {
    return { matched: false, kind: 'mismatch', reason: `expected clause /${graveyardPattern.source}/ matched ${graveyardMatches.length} times (want exactly 1) in oracle text "${input.oracleText}"` };
  }

  const normalM = normalMatches[0]!;
  // WIDENED (2026-09-16, fin/20-47 pass) — the Library->Hand fact's own
  // annotation now starts at the search clause itself ("Search your
  // library for a Vehicle card, reveal it, and put it into your hand" as
  // ONE span), not just the trailing "put it into your hand" — the search
  // clause was already required to match (immediately above) but its own
  // span was previously discarded rather than backing any Fact.
  const normalAnnotation = toLineOffset(input.oracleText, searchM.index!, normalM.index! + normalM[0]!.length);
  const objectAnnotation = toLineOffset(input.oracleText, objectStart, objectEnd);
  const graveyardM = graveyardMatches[0]!;
  const graveyardAnnotation = toLineOffset(input.oracleText, graveyardM.index!, graveyardM.index! + graveyardM[0]!.length);
  if (!normalAnnotation || !objectAnnotation || !graveyardAnnotation) {
    return { matched: false, reason: 'a matched span did not resolve to a single real oracle-text line' };
  }

  const types = { has: [typeWord] };
  const facts: RecognizedFact[] = [
    {
      role: 'source',
      fact: { from: 'Library', to: normalZone, controller: 'you', types, annotations: [normalAnnotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    },
    {
      role: 'source',
      fact: { from: 'Library', to: graveyardZone, controller: 'you', types, annotations: [graveyardAnnotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    },
    {
      role: 'sink',
      fact: { to: 'Library', controller: 'you', types, annotations: [objectAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
