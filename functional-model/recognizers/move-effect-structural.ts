// Recognizer F (2026-09-14, orchestrator-requested follow-up to the
// fact-parity checker's own `ice-magic` finding — `PRD_AUTOMATED_AUTHORING
// .md`) — reads a `CardDefinition`'s own already-typed `Effect[]` STRUCTURE
// directly (never oracle text, never Forge script), for `kind: 'move'`
// effects that TARGET a chosen permanent (`target: true` — the real CR
// 601.2c "target <type>" shape, as opposed to a self-referencing/untargeted
// move like `self-cast`'s own destination-into-the-invisible-Stack or a
// "return THIS permanent" effect). Same "why structural, not Forge-script"
// rationale as `destroy-effect-structural.ts`/`drawCard-effect-structural
// .ts` (not repeated here) — shares their `collectEffects`/`allEffects`/
// `StructuralRecognizerInput` container-walking machinery via
// `structural-effects.ts`.
//
// **Motivating real card**: `ice-magic` (fin/56) — a real `Tiered` modal
// spell whose 3 modes are ALL `kind:'move', target: true` effects
// (Blizzard: `to:'Hand'`; Blizzara/Blizzaga: both `to:'Library'`), only 2 of
// which (Blizzard, Blizzara) had a hand-authored fact — Blizzaga's own tier
// had ZERO fact representing it at all (`functional-model/scripts/
// check-fact-parity.mjs`'s own confirmed finding). The fact's own semantic
// content (`from`/`to`/`target` type filter) is already a plain, typed,
// non-function value straight off the `Effect` object — no text parsing
// needed for THAT part, same as `destroy-effect-structural.ts`'s own
// `qty`/`validType`/`minPower`. Oracle text is read ONLY to anchor the
// derived fact's `annotations` pointer, never to derive the fact's content.
//
// **Deliberately NOT `destroy-effect-structural.ts`'s own "build the exact
// expected English clause, require it to appear verbatim exactly once in
// the WHOLE face's oracle text" strategy** — that strategy leans on
// `Destroy`/`Draw` each being a small, closed, single-verb Magic template.
// A targeted `move` has NO such closed vocabulary: depending on the
// `from`/`to` pair (and pure flavor-text variance even for the SAME pair —
// Ice Magic's own Blizzara ("puts it on their choice of the top or bottom
// of their library") and Blizzaga ("shuffles it into their library") use
// completely different real verbs for the identical structural `to:
// 'Library'`), asserting one fixed verb template per zone pair would be
// guessing, not verifying. This recognizer instead verifies only the ONE
// substring every real "target <type>" clause is guaranteed to contain
// verbatim, independent of which verb follows it — `target <type-word>`
// (e.g. "target creature") — and, since more than one real `move` effect on
// the SAME face can legitimately share the identical phrase (Ice Magic's
// own Blizzara/Blizzaga both need "target creature"), pairs each qualifying
// effect (in the SAME document order `allEffects` already walks them —
// top-level `effects` first, then each named trigger/ability, recursing
// into a `modal`'s own modes in array order, which for every real Tiered/
// modal card in this pool matches that mode's own real bullet-line order)
// to the FIRST not-yet-claimed real oracle-text LINE containing that
// phrase, scanned top to bottom. This is a real, verifiable, order-
// preserving correspondence — not a guess — precisely because both
// sequences (structural effects, real printed lines) are independently
// known to be in the same top-to-bottom order for every real card this
// recognizer has been checked against; it is NOT the same guarantee
// `destroy-effect-structural.ts`'s own single-clause-per-face check needs,
// and this recognizer declines (`kind:'mismatch'`) rather than guess
// whenever a qualifying effect can't claim a real, previously-unclaimed
// line containing its own required phrase.
//
// **`owner`/`notSelf`/`optional` support (2026-09-15 follow-up)** — the
// three fields above used to be unconditional declines. Solved for real
// (not just parameter-combination guessing) by checking every one of the 14
// real `target:true` move cards' own printed text FIRST, then building the
// closed English vocabulary those real cards actually confirm — same
// "verify against real text before trusting a template" discipline every
// other structural recognizer already uses, extended to a genuinely richer
// object-phrase shape than the original bare "target <type>" scan:
// - **`owner: 'you'`, `notSelf` unset** — real text drops the word "target"
//   ENTIRELY and uses the indefinite article instead: "Return A LAND you
//   control" (`chocobo-kick`'s own Kicker cost — still declines overall,
//   see below, but for an unrelated reason: this card's own real
//   `synergy.json` is still v1-schema, out of this pipeline's scope
//   entirely, same tolerance every recognizer already has for an
//   unmigrated card). Real closed template: `(?:a|an) <type> you control`.
// - **`owner: 'you'`, `notSelf` set** — "another"/"other" REPLACES the
//   article: `ambrosia-whiteheart`'s own real "return ANOTHER permanent you
//   control" (no "target" word at all — this effect's own `validType` is
//   omitted entirely too, a real, confirmed 15th case beyond the original
//   4: an omitted `validType` means "permanent," the CR-default object type
//   for a move effect with no narrower restriction, matching this card's
//   own real unrestricted "permanent" noun — `dion-bahamut-s-dominant-
//   bahamut-warden-of-light`'s own back-face `destroy` fact already
//   established the identical "omitted -> bare 'permanent' word, no type
//   constraint on the Fact itself" convention for a DIFFERENT effect kind).
// - **`owner` omitted or `'each'`** (both mean "no restriction stated" —
//   `'each'`'s own real card, `suplex`'s "Exile target artifact," has no
//   ownership qualifier in the text at all, confirming `'each'` behaves
//   exactly like omitting `owner`, not like a THIRD real template) — same
//   `target <type>` as before, `notSelf` set prepends `(?:another|other)
//   (?:target )?` (`jill-shiva-s-dominant-shiva-warden-of-ice`'s own real
//   "up to one OTHER TARGET nonland permanent" — both "other" AND "target"
//   appear together here, a genuinely different real surface form from
//   Ambrosia's "another permanent" with no "target" at all — this
//   recognizer tolerates "target" being present OR absent after
//   another/other, verified structurally by requiring the REST of the
//   phrase to still match verbatim either way, never by guessing which
//   applies).
// - **`optional` set** — real Magic templates this two DIFFERENT ways for a
//   `qty:1` effect ("you MAY return..." — a verb-level prefix entirely
//   BEFORE this recognizer's own object-phrase anchor, so it adds nothing
//   to match here at all; or "return UP TO ONE other target..." — an
//   object-phrase-level quantifier). Since a structural `optional:true`
//   can't tell which surface form a given card uses, the built pattern
//   makes an `up to (one|two|three|four) ` prefix OPTIONAL (tolerated
//   either way) rather than guessing — real-verified against BOTH
//   `ambrosia-whiteheart` (no "up to one" prefix present) and
//   `jill-shiva-s-dominant-shiva-warden-of-ice` (prefix present).
// - Everything else stays an unconditional decline, same as before: `qty`
//   non-literal or `!== 1` (no real qty>1 plural template to verify —
//   `fight-on`/`joshua-phoenix-s-dominant-phoenix-warden-of-fire`'s own
//   `qty:2` chapter, `qutrub-forayer`/`rydia-s-return`'s own `qty:2`, all
//   still correctly decline for this reason alone), and `validType`
//   anything other than `'creature'`/`'artifact'`/`'land'`/`'any'`/omitted.
//
// **Real, NAMED remaining declines, checked one at a time (not a blanket
// "owner set" bucket anymore)** — every one of these has a confirmed,
// SPECIFIC reason distinct from the owner/notSelf/optional fields
// themselves, most exposing a real, pre-existing divergence between this
// card's own `definition.ts` and its real printed text (not something this
// recognizer's own template vocabulary could ever paper over without
// asserting something false):
//   - `chocobo-kick`: still v1-schema `synergy.json` — out of this whole
//     pipeline's scope, unrelated to this recognizer's own template.
//   - `magic-pot`/`resentful-revelation`/`vanille-cheerful-l-cie`/
//     `sorceress-s-schemes`: all 4 hit the CR 108.4 gate right above
//     (`owner:'you'`/`'opponents'` set, `from` is Graveyard or Library,
//     never Battlefield) and fall outside the narrow "from your graveyard"
//     carve-out that gate's own comment now documents (each excluded for
//     its own separately-confirmed reason — an omitted/`'any'` `validType`
//     with no real template of its own yet, or `from:'Library'` rather than
//     `'Graveyard'`) — `owner` here scopes WHICH PLAYER'S ZONE is searched
//     ("from your graveyard"), not board control, a different English
//     position than the Battlefield-sourced templates above. Each of these
//     4 real cards ALSO has its own, separate, independently-real divergence
//     from this recognizer's other templates (magic-pot's/resentful-
//     revelation's/vanille-cheerful-l-cie's own real clauses have no
//     ownership word restricting the search at all, or use an article
//     instead of "target"; sorceress-s-schemes' own real "instant or
//     sorcery card" has no matching `validType`; resentful-revelation's/
//     vanille-cheerful-l-cie's own real ability is a "look at the top N,
//     put ONE in hand"/"mill then return" selection, never phrased with
//     "target" at all) — but the CR 108.4 gate (or its narrow carve-out's
//     own exclusion) is checked FIRST and is why all 4 decline today,
//     regardless of whichever of those separate issues would otherwise also
//     apply. `phoenix-down`'s own mode 1 USED to be a 5th member of this
//     list — now closed (2026-09-16, see the module header's own "3-piece
//     widening" section) via the narrow carve-out, the one real confirmed
//     combination (`owner:'you'`, `from:'Graveyard'`, a DEFINITE
//     `validType`) this whole gate was always missing a template for. All 5
//     original members used to decline via `kind:'mismatch'` (a doomed-to-
//     fail "you control"/"you own" phrase built, then not found — hard-
//     fail-worthy, each suppressed by its own `// recognizer-exception:
//     move-effect-structural` marker) before this gate existed; the
//     remaining 4 decline via plain `kind:'scope'` instead (no marker
//     needed — though every one of these 4 cards' own existing marker is
//     left in place, not removed, since a `kind:'scope'` decline is equally
//     harmless whether or not a stale marker sits alongside it; `phoenix-
//     down`'s own marker is likewise left in place even though its mode 1
//     no longer declines at all — harmless on a card that now matches).
//   - `qutrub-forayer`: `owner:'you'` set, `from:'Graveyard'` — hits the
//     SAME CR 108.4 gate (`qty:2` alone would already decline it too, but
//     the gate is checked first).
//   - `rydia-s-return`: same CR 108.4 gate (`owner:'you'`,
//     `from:'Graveyard'`) — `qty:2`/`validType:'any'` would also each
//     independently decline it.
//   - `joshua-phoenix-s-dominant-phoenix-warden-of-fire` (Phoenix, Warden of
//     Fire's own Saga chapter III): same CR 108.4 gate (`owner:'you'`,
//     `from:'Graveyard'`) — `qty:2` (approximating the real "ANY NUMBER of
//     target creature cards with total mana value 6 or less," also a
//     `Constraints`-vocabulary gap, total mana value) would also
//     independently decline it.
//   - `fight-on`: same CR 108.4 gate (`owner:'you'`, `from:'Graveyard'`) —
//     `qty:2` would also independently decline it (no real qty>1 template).
//
// **Real pool check — 4 real matches as of the CR 108.4 gate's own
// introduction** (`ice-magic`'s 3 modes, unchanged, plus `ambrosia-
// whiteheart`, `jill-shiva-s-dominant-shiva-warden-of-ice`, and `eject`, all
// newly recognized at that time) — that gate changed WHY 8 real cards
// decline (`kind:'scope'` instead of `kind:'mismatch'`), not WHETHER they
// decline, confirmed via a real before/after `apply-recognizers.mjs` run (0
// new/changed facts pool-wide) at the time. **Superseded by `phoenix-down`'s
// own 3-piece widening (2026-09-16, same day)** — that card now ALSO
// matches, both its modes at once (see module header): 5 real cards match
// as of this writing, re-check this comment if a future card changes that
// again.
//
// **Verb + destination-clause widening (2026-09-16, `verify-text-
// coverage.mjs` flagged `ambrosia-whiteheart`'s own "to its owner's hand."
// sitting uncovered right after `objectPhrasePattern`'s own match)** —
// `objectPhrasePattern` only ever anchored the OBJECT phrase itself
// ("another permanent you control"), never the verb before it or the
// destination clause after it. Real, whole-pool check of every real
// `target:true` move effect with `to:'Hand'` (`ice-magic`'s own Blizzard
// mode, `ambrosia-whiteheart`, `jill-shiva-s-dominant-shiva-warden-of-ice`,
// `eject`; `chocobo-kick` too, but it stays out of this pipeline's scope
// entirely — still v1-schema `synergy.json`) confirms all 4 use the
// IDENTICAL real verb+destination template, case-insensitive, regardless of
// which owner/notSelf/optional combination precedes it: "return <object
// phrase> to its owner's hand" — never "send"/"put"/any other verb, and
// never a different destination noun (`destinationClauseFor` below).
// `to:'Exile'` needs NO destination clause at all in real Magic templating
// ("Exile target artifact." — `suplex`/`white-auracite`/`eject`'s own
// nonland-permanent mode/`venat-...`'s own exile effect all confirm this;
// none of them has a real uncovered destination-clause gap). `to:'Battlefield'`
// has no real `target:true` move card in this pool at all yet (outside
// Phoenix Down's own mode 1, handled separately below), so it's likewise
// left undefined rather than invented. The verb+destination clause is REQUIRED (not merely tolerated)
// when `to === 'Hand'` — a `to:'Hand'` effect whose real text somehow
// doesn't contain it would correctly decline via `kind:'mismatch'` rather
// than silently keeping the narrower object-phrase-only annotation, same
// "don't guess, decline" discipline this whole file already uses
// everywhere else.
//
// **`subtype` array support added to `typeWordFor`/`buildTargetConstraint`
// (2026-09-16, recognizer-lane triage)** — `move.subtype`'s own real
// `string[]` OR-match widening (`card.ts`, built specifically for Phoenix
// Down's own mode 2, "Exile target Skeleton, Spirit, or Zombie") had no
// matching read here at all before this pass; this function only ever
// checked `validType`. Real Magic 3-word list join confirmed against that
// one real card (Oxford comma before "or") — see `typeWordFor`'s own doc
// comment for the full reasoning and why a scalar `subtype` elsewhere in
// this pool (`from-father-to-son`'s own "Vehicle") never reaches this file
// at all (`isTargetedMoveEffect`'s own `Computed<ZoneType>` `to` exclusion).
//
// **Real, honestly-reported limit at the time — this widening did NOT, by
// itself, unlock any NEW fact for Phoenix Down** (confirmed via a real
// `apply-recognizers.mjs --slug=phoenix-down` run, 0 new facts, not just
// argued from reading the code): this recognizer's own "all-or-nothing per
// face, not per-effect" discipline (see this module's own header) meant
// Phoenix Down's mode 1 — still declining via the CR 108.4 gate below at
// the time — short-circuited the WHOLE face before mode 2 (the one this
// widening actually targeted) was ever reached in `allEffects`'s own
// document-order walk. See the next section for the follow-up pass that
// closed mode 1 too, unlocking both modes together.
//
// **Mode 1 3-piece widening, closing the gate above (2026-09-16, same-day
// follow-up)** — the CR 108.4 gate's own prior note named exactly 3 real,
// separately-scoped pieces as a concrete next step; all 3 built this pass,
// checked against the WHOLE real pool first (not just Phoenix Down),
// confirmed via a live `apply-recognizers.mjs --slug=phoenix-down` run (4
// new facts: mode 1's source + Graveyard sink, mode 2's source + Battlefield
// sink — all 4 in one run, since fixing mode 1 lets `allEffects`'s
// document-order walk reach mode 2 too):
// 1. A narrow "from your graveyard" source-zone clause template
//    (`objectPhrasePattern`'s own new carve-out, right where the CR 108.4
//    gate used to unconditionally decline) — scoped to exactly the one
//    real confirmed combination (`owner:'you'`, `from:'Graveyard'`, a
//    DEFINITE `validType`), not generalized to `owner:'opponents'` or
//    `from:'Library'`/`'Exile'` (no real card confirms either). Explicitly
//    does NOT extend to an omitted `validType` either — `vanille-cheerful-
//    l-cie`'s own real "return A PERMANENT CARD from your graveyard to
//    your hand" (no word "target" at all) is a real SECOND, independently-
//    confirmed template for that combination, genuinely different from
//    Phoenix Down's own "target creature card ... from your graveyard" —
//    building one from the other would be guessing, so the omitted-
//    `validType` case stays declined (see the gate's own updated comment
//    for the full per-card breakdown).
// 2. A "with mana value N or less" `maxCmc` qualifier, read in both the
//    text-matching object phrase (`objectPhrasePattern`) and the Fact's own
//    `target.cmc` constraint (`buildTargetConstraint`) — same `cmc:{max:N}`
//    shape `moveSearchLibraryOrGraveyard-effect-structural.ts`'s own
//    Delivery Moogle case already established for the identical
//    `effect.maxCmc` field, just nested inside this recognizer's `target:
//    Constraints` wrapper (Phoenix Down's own pre-existing hand-authored
//    fact already confirms that exact nested shape).
// 3. A card-vs-permanent terminology fix (CR 110.1 — permanents only exist
//    on the battlefield; a Graveyard-sourced target is a CARD) — scoped
//    narrowly to the one confirmed carve-out above (literal `${typeWord}
//    card` in that one branch) rather than generalized into `typeWordFor`
//    itself, which stays Battlefield-oriented since every OTHER real card
//    it serves is Battlefield-sourced.
// Also needed, surfaced along the way: a `to:'Battlefield'`+`tapped:true`
// destination-clause template ("to the battlefield tapped" —
// `destinationClauseFor`'s own new branch, Phoenix Down's own sole real
// confirmed case; a hypothetical untapped equivalent stays undeclined, no
// real card to confirm it against), an `event:'entersBattlefield'` tag on
// the source fact (needed only so this recognizer's own freshly-computed
// fact shares an identical `apply-recognizers.mjs`-side `coreKey` with
// Phoenix Down's own pre-existing hand-authored fact and retags it in place
// — inert for actual synergy matching, same as `event:'dies'`'s own
// established precedent), and a mirror-image companion SINK branch (`to:
// effect.from` for a `to:'Battlefield'` move, the inverse of the existing
// `from:'Battlefield'` branch) confirmed against Phoenix Down's own
// pre-existing hand-authored Graveyard sink.
//
// **`to:'Library'` destination clause, CLOSED (2026-09-16, text-coverage
// pass)** — `verify-text-coverage.mjs` flagged `ice-magic`'s own Blizzara/
// Blizzaga tiers as still uncovered right after the object-phrase-only
// match ("Target creature" matched, "'s owner puts it on their choice of
// the top or bottom of their library"/"'s owner shuffles it into their
// library" left dangling). The module's own prior note declined this as
// "no single confirmed verb template" — true for a SHARED verb, but this
// pool has exactly 2 real, fully-confirmed Library-destination strings
// (both on this same card, the only `target:true` move-to-Library card in
// FIN), so an alternation between those 2 closed, verified strings is not
// a guess the way inventing a THIRD unseen phrasing would be — same
// "closed real vocabulary, verified against the actual pool" discipline
// this whole file already uses for `subtype`'s own 3-word Oxford-comma
// join. Genuinely different SENTENCE SHAPE from the Hand/Battlefield
// clauses above: the object phrase is immediately followed by the
// possessive "'s owner" (no space — "creature's owner", not "creature 's
// owner") and the verb comes AFTER, not before — `destinationClauseFor`'s
// return shape gained a `verb: ''` (empty) sentinel the caller below
// switches on to concatenate with no `\s+` between the object phrase and
// this destination clause, instead of the `<verb> <phrase> <destination>`
// order every other `to` value uses.
import type { Effect } from '../card';
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'move-effect-structural' as const;

type MoveEffect = Extract<Effect, { kind: 'move' }>;
/** This recognizer's own scope is TARGETED moves only (601.2c) — a real
 * CR 601.2c target is always ONE object, so `from` is always a single real
 * zone for every card this recognizer covers; no real targeted-move card
 * needs the `ZoneType[]` shape `move`'s own `from` field gained 2026-09-15
 * (Delivery Moogle's own real two-zone UNTARGETED library-and/or-graveyard
 * search, a completely different real template — see `moveSearchLibraryOr
 * Graveyard-effect-structural.ts`). Narrowed here (`typeof e.from ===
 * 'string'`) so `fact.from` below stays a real, single `string` — matching
 * `synergy.ts`'s own `Fact.from: string` field — rather than needing that
 * whole schema widened too for a shape this recognizer's own real cards
 * never produce. */
/** `to` narrowed the same way `from` is right above, same real reason —
 * added 2026-09-15 once `move.to` widened to `Computed<ZoneType>` (From
 * Father to Son's own real castFrom-conditional destination, `card.ts`'s
 * own doc comment) — no real TARGETED move in this pool has a non-literal
 * `to` (From Father to Son's own conditional destination is itself
 * UNTARGETED, covered by `moveConditionalDestinationByCastFrom-effect-
 * structural.ts` instead), so this recognizer stays scoped to the literal
 * case it can actually confirm rather than needing `fact.to` widened too. */
type TargetedMoveEffect = MoveEffect & { from: string; to: string };

function isTargetedMoveEffect(e: Effect): e is TargetedMoveEffect {
  return e.kind === 'move' && e.target === true && typeof e.from === 'string' && typeof e.to === 'string';
}

/** The plain English type-word a real move clause uses for this effect's own
 * `validType` (see module doc comment) — `undefined` (never guessed) for
 * anything outside this recognizer's own confirmed real-pool vocabulary.
 * Omitted `validType` means the CR-default "permanent" (a real, confirmed
 * case — `ambrosia-whiteheart`'s own unrestricted "return another permanent
 * you control"), NOT a decline. */
function typeWordFor(effect: MoveEffect): string | undefined {
  if (typeof effect.qty !== 'number') return undefined; // Computed<number> closure — opaque
  if (effect.qty !== 1) return undefined; // no real qty>1 card to verify plural templating against
  // `subtype` array support (2026-09-16, recognizer-lane triage) —
  // `move.subtype`'s own `string[]` OR-match widening (`card.ts`, 2026-09-16
  // engine-core pass, built specifically for THIS card) had no matching
  // read here yet — this function only ever checked `validType`. Real,
  // whole-pool check first (grepped every `kind:'move', target:true`
  // effect in this recognizer's own real reachable population — a scalar
  // `subtype` DOES exist elsewhere, `from-father-to-son`'s own "Vehicle,"
  // but that effect's own `to` is a `Computed<ZoneType>`, already excluded
  // by `isTargetedMoveEffect`'s own type guard above, so it never reaches
  // this function at all): Phoenix Down's own mode 2 ("Exile target
  // Skeleton, Spirit, or Zombie") is the ONLY real card this function can
  // actually see an array `subtype` on — same single-real-card evidentiary
  // bar this whole recognizer catalog already accepts elsewhere (e.g.
  // `equipProgram-effect-structural.ts`'s own 3rd template). Real Magic
  // list templating confirmed against this one card: a 3-word list joins
  // with a comma between the first two and ", or" before the last (Oxford
  // comma, matching `destroyProgram-effect-structural.ts`'s own
  // `joinTypeWords` 2-word "X or Y" precedent, extended one word further
  // since no real 2-word `subtype` array exists to confirm THAT join
  // separately). A single-element array reduces to that one bare word
  // (no real card needs this either, but it costs nothing and matches
  // "never narrower than the real data requires" for a trivial case); any
  // other length (2, or 4+) has no confirmed real join template and
  // declines rather than guessing at "X and Y" vs. "X or Y" or a 4-way
  // Oxford list.
  if (effect.subtype !== undefined) {
    const subtypes = Array.isArray(effect.subtype) ? effect.subtype : [effect.subtype];
    if (subtypes.length === 1) return subtypes[0];
    if (subtypes.length === 3) return `${subtypes[0]}, ${subtypes[1]}, or ${subtypes[2]}`;
    return undefined; // no confirmed 2-way/4+-way join template
  }
  if (effect.validType === 'creature') return 'creature';
  if (effect.validType === 'artifact') return 'artifact';
  if (effect.validType === 'land') return 'land';
  if (effect.validType === 'any') return effect.nonLand ? 'nonland permanent' : 'permanent';
  if (effect.validType === undefined) return 'permanent';
  return undefined; // an unconfirmed value
}

/** The Fact-shape `target` constraint for this same effect — mirrors
 * `destroy-effect-structural.ts`'s own `buildTargetConstraint` mapping
 * (`nonLand` -> `types:{not:['Land']}`, a bare unrestricted `'any'`/omitted
 * `validType` -> no type filter at all, matching `restoration-magic`'s own
 * real hand-authored "target permanent" fact, which carries an empty
 * `target: {}`). */
function buildTargetConstraint(effect: MoveEffect): Constraints | undefined {
  // `subtype` array support (2026-09-16, same pass as `typeWordFor`'s own
  // widening right above — see that function's own doc comment for the
  // real, single-card whole-pool check). Matches this recognizer's own
  // pre-existing `hasAny` convention (`objectPhrasePattern`'s own owner/
  // `'opponents'` sibling case, and `destroy-effect-structural.ts`'s own
  // multi-type `hasAny` shape for a `validType` array) — a subtype OR-list
  // is the identical real "any one of these matches" claim, just at the
  // subtype level rather than the base-cardtype level. A single-element
  // array reduces to a plain `has:[word]` (no real card needs this either,
  // same as `typeWordFor`'s own analogous single-element fallback).
  let base: Constraints | undefined;
  if (effect.subtype !== undefined) {
    const subtypes = Array.isArray(effect.subtype) ? effect.subtype : [effect.subtype];
    base = subtypes.length === 1 ? { types: { has: subtypes } } : { types: { hasAny: subtypes } };
  } else if (effect.validType === 'creature') base = { types: { has: ['Creature'] } };
  else if (effect.validType === 'artifact') base = { types: { has: ['Artifact'] } };
  else if (effect.validType === 'land') base = { types: { has: ['Land'] } };
  else if (effect.validType === 'any' && effect.nonLand) base = { types: { not: ['Land'] } };

  // `maxCmc` support (2026-09-16, Phoenix Down's own mode 1 3-piece
  // widening — "with mana value 4 or less") — real CR 702.13e/generic
  // numeric restriction, same `cmc: {max: N}` shape `moveSearchLibrary
  // OrGraveyard-effect-structural.ts`'s own Delivery Moogle case already
  // established for the identical `effect.maxCmc` field (just nested
  // inside this recognizer's own `target: Constraints` wrapper instead of
  // that recognizer's flat top-level fact shape — Phoenix Down's own
  // pre-existing hand-authored fact, `target: {types:{has:['Creature']},
  // cmc:{max:4}}`, already confirms this exact nested shape is the real
  // convention here, not a new invention). Strictly additive — no
  // currently-recognized real card in this pool's `move` population
  // declares `maxCmc` at all (checked), so this can only ever change
  // Phoenix Down's own outcome.
  if (effect.maxCmc !== undefined) base = { ...(base ?? {}), cmc: { max: effect.maxCmc } };
  return base;
}

/** The real, closed English "object phrase" a real move clause uses —
 * quantifier + notSelf-marker + type-word + owner-suffix, built from
 * confirmed real templates only (see module doc comment for the 4 real
 * cases this was checked against: `ambrosia-whiteheart`, `chocobo-kick`,
 * `jill-shiva-s-dominant-shiva-warden-of-ice`, `suplex`/`eject`/`ice-magic`
 * as the "no owner" baseline, plus `white-auracite`'s own real `owner:
 * 'opponents'` case added 2026-09-16, fin/26-50 pass — "exile target
 * nonland permanent AN OPPONENT CONTROLS," a genuinely different real
 * suffix than either the `'you'` or no-owner cases). `undefined` when
 * `owner` is set to anything other than `'you'`/`'opponents'`/`'each'`/
 * omitted — no confirmed template for anything else (no real card in this
 * pool's `target:true` move population needs more). */
function objectPhrasePattern(effect: MoveEffect): string | undefined {
  const typeWord = typeWordFor(effect);
  if (!typeWord) return undefined;
  if (effect.owner !== undefined && effect.owner !== 'you' && effect.owner !== 'each' && effect.owner !== 'opponents') return undefined;

  // **CR 108.4 gate (2026-09-16, coordinator-routed follow-up)** — only a
  // permanent (or a spell/ability on the stack) has a CONTROLLER; a card
  // sitting in any other zone (Graveyard/Library/Exile/Hand) only has an
  // OWNER. `owner:'you'`/`'opponents'` on a `from:'Battlefield'` move is
  // this recognizer's own confirmed "<type> you control"/"<type> an
  // opponent controls" template (`ambrosia-whiteheart`/`chocobo-kick`/
  // `white-auracite`, all Battlefield-sourced) — but on a NON-Battlefield
  // move, `owner` means something structurally different: WHICH PLAYER'S
  // ZONE is being searched ("from YOUR graveyard"), a real prepositional
  // phrase attached to the SOURCE ZONE, not a control-suffix on the object
  // itself — a genuinely different English position this recognizer has no
  // confirmed template for at all. Every real pool card this ambiguity
  // could bite (`phoenix-down`, `magic-pot`, `resentful-revelation`,
  // `vanille-cheerful-l-cie`, `sorceress-s-schemes`, plus `fight-on`/
  // `qutrub-forayer`/`rydia-s-return`, which separately decline via
  // `qty`/`validType` before ever reaching this check) already carries a
  // `// recognizer-exception: move-effect-structural` marker precisely
  // because the OLD code below built the wrong "... you control" phrase
  // anyway and let it fail to match as a `kind:'mismatch'` (hard-fail-
  // worthy, only suppressed by that marker) — checked directly against the
  // whole real pool before this fix, not assumed. Declining HERE instead
  // (before ever building that doomed phrase) turns every one of those into
  // a plain `kind:'scope'` decline (never hard-fails, no marker needed) —
  // real, verified via a live before/after run, not just a code-reading
  // argument (see this recognizer's own test file).
  //
  // **Narrow "from your graveyard" carve-out (2026-09-16, 3-piece widening
  // this gate's own prior note named as a concrete follow-up)** — Phoenix
  // Down's own real mode 1 ("Return target creature card with mana value 4
  // or less FROM YOUR GRAVEYARD to the battlefield tapped") confirms a real,
  // closed template for exactly ONE combination this pool has ever needed:
  // `owner:'you'`, `from:'Graveyard'`, a DEFINITE `validType`
  // (`'creature'`/`'artifact'`/`'land'`, never the bare unrestricted `'any'`/
  // omitted case — see below for why that's excluded on purpose, not an
  // oversight). Every other real card this whole gate blocks still declines
  // via the unconditional `return undefined` a few lines down, same as
  // before this carve-out existed:
  // - `magic-pot` (`validType:'any'`, excluded by the definite-type check
  //   below) — ALSO separately real-text-divergent even if it weren't:
  //   its own comment already documents `owner:'you'` as a known
  //   approximation (real text says "a graveyard," no ownership word at
  //   all, unlike Phoenix Down's confirmed "your graveyard").
  // - `sorceress-s-schemes` (`validType:'any'`, excluded) — real text
  //   ("instant or sorcery card") has no matching `validType` anyway.
  // - `qutrub-forayer`/`rydia-s-return`/`joshua-phoenix-s-dominant-
  //   phoenix-warden-of-fire`/`fight-on` — all `qty:2`, already excluded
  //   by `typeWordFor`'s own `qty !== 1` decline before this gate is ever
  //   reached with a resolved `typeWord`.
  // - `resentful-revelation` (`from:'Library'`, not `'Graveyard'` — no
  //   confirmed source-zone clause for Library yet) and `vanille-cheerful-
  //   l-cie` (`from:'Graveyard'` but `validType` OMITTED, excluded by the
  //   definite-type check — its own real text, "return A PERMANENT CARD
  //   from your graveyard to your hand," confirms a GENUINELY DIFFERENT
  //   real template for the omitted-`validType` case: an article ("a"),
  //   never the word "target," diverging from Phoenix Down's own confirmed
  //   "target creature card" — a real second data point proving the
  //   omitted-`validType` case needs its OWN separately-confirmed template,
  //   not a guess extending this one, so it stays excluded/declined here
  //   rather than risk building the wrong one).
  //
  // `notSelf`/`optional` also decline here (no real card confirms either
  // combined with a graveyard source-zone clause — this pool's one real
  // motivating card, Phoenix Down, has neither set).
  if (effect.owner === 'you' && effect.from === 'Graveyard' && !effect.notSelf && !effect.optional && (effect.validType === 'creature' || effect.validType === 'artifact' || effect.validType === 'land')) {
    // CR 110.1: a Graveyard-sourced target is a CARD, never a "permanent"
    // (permanents only exist on the battlefield) — real terminology switch
    // this same investigation surfaced (`magic-pot`'s own real "target CARD
    // from a graveyard," never "target permanent"), scoped here to exactly
    // the one real confirmed combination above rather than generalized
    // into `typeWordFor` itself (which stays Battlefield-oriented — every
    // other real card it serves is Battlefield-sourced, so widening it
    // there would be an unconfirmed, unnecessary generalization).
    const maxCmcClause = effect.maxCmc !== undefined ? ` with mana value ${effect.maxCmc} or less` : '';
    return `target ${typeWord} card${maxCmcClause} from your graveyard`;
  }

  // **RE-VERIFIED independently, not just trusted from the note above
  // (2026-09-16, recognizer-lane triage)** — re-read Phoenix Down's own
  // real printed mode 1 directly: "Return target creature card with mana
  // value 4 or less FROM YOUR GRAVEYARD to the battlefield tapped." Two
  // real, independent confirmations the gate is still correct for every
  // OTHER real combination (the object itself carries NO "you control"/
  // "you own" suffix at all — "your" attaches only to "graveyard," the
  // source ZONE — and the narrow carve-out above is the full extent of
  // what's confirmed): the object phrase itself also needs a "with mana
  // value N or less" qualifier (`effect.maxCmc`, now read directly above)
  // and a card-vs-permanent terminology switch (also above) — both closed
  // by the carve-out; every combination outside it still has no confirmed
  // template and correctly falls through to the unconditional decline
  // right below.
  if ((effect.owner === 'you' || effect.owner === 'opponents') && effect.from !== 'Battlefield') return undefined;

  // Real Magic templates an optional qty:1 move TWO different ways ("you
  // MAY ..." — entirely before this phrase's own anchor, adding nothing
  // here — or "return UP TO ONE other target ..." — an object-phrase-level
  // quantifier); tolerate either, never guess which (see module doc
  // comment).
  const quantifier = effect.optional ? '(?:up to one )?' : '';

  if (effect.owner === 'you') {
    // "return ANOTHER permanent you control" (notSelf) vs. "return A LAND
    // you control" (no notSelf) — the article itself changes, "target"
    // never appears in either real confirmed case.
    const article = effect.notSelf ? '(?:another|other) ' : '(?:a|an) ';
    return `${quantifier}${article}${typeWord} you control`;
  }

  if (effect.owner === 'opponents') {
    // White Auracite's own real "exile TARGET nonland permanent AN OPPONENT
    // CONTROLS" — "target" still appears (unlike the `'you'` case above),
    // no real confirmed `notSelf` combination for this owner value yet.
    const article = effect.notSelf ? '(?:another|other) target ' : 'target ';
    return `${quantifier}${article}${typeWord} an opponent controls`;
  }

  // owner omitted or 'each' — both mean "no restriction stated" (see module
  // doc comment on `suplex`'s own real "Exile target artifact.").
  const article = effect.notSelf ? '(?:another|other) (?:target )?' : 'target ';
  return `${quantifier}${article}${typeWord}`;
}

/** The real, closed verb+destination-clause template this effect's own `to`
 * implies, derived structurally from that one field — never guessed (see
 * module doc comment's 2026-09-16 widening note for the real, whole-pool
 * check this was built from). `undefined` means "no destination clause
 * needed at all" (`'Exile'`) — the caller falls back to annotating the bare
 * object phrase only, same as before this widening. An empty `verb: ''`
 * (the `'Library'` case, see module doc comment) is a real, different
 * sentence shape, not "no verb confirmed" — the caller concatenates it
 * directly onto the object phrase with no separating `\s+`, instead of the
 * `<verb> <phrase> <destination>` order every other case uses. */
function destinationClauseFor(effect: MoveEffect): { verb: string; destination: string } | undefined {
  if (effect.to === 'Hand') return { verb: 'return', destination: "to its owner's hand" };
  // Phoenix Down's own mode 1 (2026-09-16 widening) — "Return ... to the
  // battlefield tapped." Only confirmed with `tapped:true` (this pool's
  // sole real `to:'Battlefield'` targeted-move card); a hypothetical
  // untapped equivalent has no real card to confirm a "to the battlefield"
  // (no trailing word) template against, so `tapped` unset/false still
  // falls through to `undefined` (no confirmed template) rather than
  // guessing the bare phrase.
  if (effect.to === 'Battlefield' && effect.tapped === true) return { verb: 'return', destination: 'to the battlefield tapped' };
  // `'Library'` (2026-09-16, Ice Magic's own Blizzara/Blizzaga tiers,
  // closing a text-coverage gap — see module doc comment) — exactly 2 real,
  // closed, fully-confirmed strings, both on this one card, the only real
  // `target:true` move-to-Library card in this pool. `(?:their|its)`
  // tolerates either possessive pronoun (this card's own real text uses
  // "their" both times; no other card exists to confirm whether "its" would
  // ever appear instead, but both are the same real referent — the target's
  // owner — so this is a grammatical-agreement tolerance, not a guessed
  // THIRD phrasing).
  if (effect.to === 'Library') {
    return {
      verb: '',
      destination:
        "'s owner (?:puts it on (?:their|its) choice of the top or bottom of (?:their|its) library|shuffles it into (?:their|its) library)",
    };
  }
  return undefined;
}

/**
 * Reads one face's own structured `Effect[]` directly (never this face's own
 * oracle text, except to ANCHOR each derived fact's annotation — see module
 * doc comment) and derives the `to`/`from`-shaped Fact(s) implied by every
 * `kind:'move', target:true` effect this recognizer can confidently resolve.
 *
 * **All-or-nothing per face, not per-effect** — same simplification
 * `destroy-effect-structural.ts`/`drawCard-effect-structural.ts` both make:
 * if this face has zero qualifying `move` effects, declines with that
 * reason; if it has one or more but ANY of them can't be confidently
 * resolved (an unconfirmed field combination, or no real unclaimed line
 * containing its own required phrase), the WHOLE face declines rather than
 * partially claiming only the resolvable ones.
 *
 * **No dedup here** — every matched effect on this face produces its own
 * `RecognizedFact` below, even when two effects (Ice Magic's own
 * Blizzara/Blizzaga) produce the IDENTICAL fact shape at two DIFFERENT real
 * annotation spans. Merging those into one fact carrying both annotations
 * is `apply-recognizers.mjs`'s own shared runner-level
 * `mergeRecognizedFactsByIdentity` pass, not this recognizer's concern —
 * same division of labor as every other structural recognizer in this
 * catalog.
 */
export function recognizeMoveEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const moveEffects = allEffects(input).map((o) => o.effect).filter(isTargetedMoveEffect);
  if (moveEffects.length === 0) {
    return { matched: false, reason: 'no kind:"move" Effect with target:true on this face' };
  }

  const lines = input.oracleText.split('\n');
  const claimedLines = new Set<number>();
  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of moveEffects) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    const phrase = objectPhrasePattern(effect);
    if (!phrase) {
      return {
        matched: false,
        reason: `a targeted move effect on this face (${JSON.stringify(effect)}) has no confirmed structural→text template (an unsupported owner value, non-literal qty/qty!=1, or an unsupported validType — see module doc comment for the full, per-field breakdown)`,
      };
    }

    // Widen the required (and annotated) clause to include the verb and
    // destination text too, when this effect's own `to` implies one
    // confirmed real template (see `destinationClauseFor`'s own doc
    // comment) — required, not merely tolerated: a `to:'Hand'` effect whose
    // real text somehow lacks "return ... to its owner's hand" verbatim
    // correctly declines below (`kind:'mismatch'`) rather than silently
    // keeping the narrower object-phrase-only match.
    const destinationClause = destinationClauseFor(effect);
    // An empty `verb` (the `'Library'` case — see `destinationClauseFor`'s
    // own doc comment) is a real, different sentence shape: the destination
    // clause attaches directly after the object phrase (no separating
    // `\s+`), not before it.
    const fullPhrase = !destinationClause
      ? phrase
      : destinationClause.verb
        ? `${destinationClause.verb}\\s+${phrase}\\s+${destinationClause.destination}`
        : `${phrase}${destinationClause.destination}`;
    const pattern = new RegExp(`\\b${fullPhrase}\\b`, 'i');
    let claimedLine: number | undefined;
    let matchStart: number | undefined;
    let matchEnd: number | undefined;
    for (let i = 0; i < lines.length; i++) {
      if (claimedLines.has(i)) continue;
      const m = pattern.exec(lines[i]!);
      if (m) {
        claimedLine = i;
        matchStart = m.index;
        matchEnd = m.index + m[0].length;
        break;
      }
    }
    if (claimedLine === undefined || matchStart === undefined || matchEnd === undefined) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected phrase /${pattern.source}/ not found on any real, not-yet-claimed oracle-text line (oracle text: "${input.oracleText}")`,
      };
    }
    claimedLines.add(claimedLine);

    const annotation = { target: 'oracle' as const, line: claimedLine, start: matchStart, end: matchEnd };
    const target = buildTargetConstraint(effect);
    // Real Magic templating: `owner:'you'` means "you control"/"you own" the
    // object being moved — a real `controller:'you'` fact field, same
    // convention `ambrosia-whiteheart`'s own pre-existing hand-authored fact
    // already used (confirmed against it, not invented here). `owner:
    // 'opponents'` (White Auracite's own real "an opponent controls," added
    // 2026-09-16) is the mirror-image real `controller:'opp'` (`synergy.ts`'s
    // own `Side` type) — confirmed against that card's own pre-existing hand-
    // authored fact, same treatment. `owner:'each'` means no restriction at
    // all (see module doc comment) — no `controller` field, same as omitting
    // `owner` entirely.
    facts.push({
      role: 'source',
      fact: {
        from: effect.from,
        to: effect.to,
        // `event:'entersBattlefield'` (2026-09-16, Phoenix Down's own mode
        // 1 widening) — a CONSEQUENCE-type fact whose destination is a
        // fixed, guaranteed part of the act once it resolves (`synergy.ts`'s
        // own doc comment on `event`'s ACT-vs-CONSEQUENCE standing rule),
        // same real convention `event:'dies'` already uses for the mirror-
        // image `to:'Graveyard'` case. Needed so this recognizer's own
        // freshly-computed fact shares an identical `coreKey` with Phoenix
        // Down's own pre-existing hand-authored fact (`apply-recognizers
        // .mjs`'s own `coreKey` includes `event` whenever present) and
        // retags it in place instead of appending a near-duplicate — inert
        // for actual synergy MATCHING either way (a zone-shaped fact's
        // `event` string is never read by `factsInteract`, see `synergy.ts`'s
        // own doc comment) and additive-only: no other real card recognized
        // by this file has ever had `to:'Battlefield'` on its source side
        // before this pass.
        ...(effect.to === 'Battlefield' ? { event: 'entersBattlefield' as const } : {}),
        ...(effect.owner === 'you' ? { controller: 'you' as const } : {}),
        ...(effect.owner === 'opponents' ? { controller: 'opp' as const } : {}),
        ...(target ? { target } : {}),
        targeted: true,
        annotations: [annotation],
        ...(triggeredBy ? { triggeredBy } : {}),
      },
      provenance: { origin: 'parser', rule: RULE },
    });

    // Companion SINK fact (real pool precedent: `eject`/`jill-shiva-s-
    // dominant-shiva-warden-of-ice`/`ice-magic`/`summon-leviathan` all
    // already pair their own real "return/exile a permanent FROM the
    // battlefield" move with a "wants a permanent present on the
    // battlefield" sink, same annotation span as the source above) — only
    // for a `from:'Battlefield'` move.
    if (effect.from === 'Battlefield') {
      facts.push({
        role: 'sink',
        fact: {
          to: 'Battlefield',
          ...(effect.owner === 'you' ? { controller: 'you' as const } : {}),
          ...(effect.owner === 'opponents' ? { controller: 'opp' as const } : {}),
          ...(target ?? {}),
          annotations: [annotation],
        },
        provenance: { origin: 'parser', rule: RULE },
      });
    } else if (effect.to === 'Battlefield') {
      // Mirror-image companion SINK (2026-09-16, Phoenix Down's own mode 1
      // widening) — a move arriving ONTO the battlefield from some hidden
      // zone "wants a matching card present in that SOURCE zone" (Phoenix
      // Down's own real, pre-existing hand-authored sink,
      // `{to:'Graveyard', controller:'you', types:{has:['Creature']},
      // cmc:{max:4}}` — confirms this exact shape, not invented here), the
      // inverse of the `from:'Battlefield'` branch above (which wants the
      // thing present ON the battlefield instead). Same annotation span,
      // same `target` constraint spread.
      facts.push({
        role: 'sink',
        fact: {
          to: effect.from,
          ...(effect.owner === 'you' ? { controller: 'you' as const } : {}),
          ...(effect.owner === 'opponents' ? { controller: 'opp' as const } : {}),
          ...(target ?? {}),
          annotations: [annotation],
        },
        provenance: { origin: 'parser', rule: RULE },
      });
    }
  }

  return { matched: true, facts };
}
