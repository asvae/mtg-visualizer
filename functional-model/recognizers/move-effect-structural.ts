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
//   - `magic-pot`: `owner:'you'` is set, but the real text ("Exile target
//     card from A graveyard") has NO ownership restriction at all — a real,
//     pre-existing mismatch between this card's own `definition.ts` and its
//     printed text (not this recognizer's to silently paper over by
//     asserting an owner-restricted claim the card doesn't make).
//   - `qutrub-forayer`: same shape of mismatch — `owner:'you'` set, but the
//     real text ("Exile up to two target cards from A SINGLE graveyard")
//     has no ownership restriction either (the real constraint, "a single
//     graveyard," has no `Constraints` field in this pool's vocabulary at
//     all — a different, separate gap).
//   - `sorceress-s-schemes`: `validType:'any'` is broader than the real
//     "target INSTANT OR SORCERY card ... you own" — a documented
//     approximation (no `instant|sorcery` restriction exists in `move`'s
//     own `validType` union), so the built "target card you own" phrase
//     never appears verbatim (the real text says "instant or sorcery
//     card").
//   - `rydia-s-return`: `validType:'any'` approximates the real "target
//     PERMANENT cards" (no generic `'permanent'` validType exists on
//     `move` at all, same documented gap `vanille-cheerful-l-cie`'s own
//     comment already names) — "target card" never matches "target
//     permanent cards" verbatim. Also `qty:2` (no real qty>1 template).
//   - `resentful-revelation`/`vanille-cheerful-l-cie`: `target:true` is set
//     on the `Effect`, but the real ability is a "look at the top N, put
//     ONE in hand" selection, never phrased with the word "target" at all
//     — a real, pre-existing modeling approximation in these two cards' own
//     `definition.ts` (reusing the targeted-move pool-pick machinery for a
//     resolution-time choice, not a CR-targeted ability), not something a
//     text-verification recognizer should paper over.
//   - `joshua-phoenix-s-dominant-phoenix-warden-of-fire` (Phoenix, Warden of
//     Fire's own Saga chapter III): `qty:2` approximates the real "ANY
//     NUMBER of target creature cards with total mana value 6 or less" —
//     no real qty>1 template AND a `Constraints`-vocabulary gap (total mana
//     value) neither.
//   - `fight-on`: `qty:2`, no real qty>1 template to verify against.
//
// **Real pool check confirming exactly 4 real matches now** (`ice-magic`'s
// 3 modes, unchanged, plus `ambrosia-whiteheart`, `jill-shiva-s-dominant-
// shiva-warden-of-ice`, and `eject`, all newly recognized) — re-check this
// comment if a future card changes that.
import type { Effect } from '../card';
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

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
type TargetedMoveEffect = MoveEffect & { from: string };

function isTargetedMoveEffect(e: Effect): e is TargetedMoveEffect {
  return e.kind === 'move' && e.target === true && typeof e.from === 'string';
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
  if (effect.validType === 'creature') return { types: { has: ['Creature'] } };
  if (effect.validType === 'artifact') return { types: { has: ['Artifact'] } };
  if (effect.validType === 'land') return { types: { has: ['Land'] } };
  if (effect.validType === 'any' && effect.nonLand) return { types: { not: ['Land'] } };
  return undefined;
}

/** The real, closed English "object phrase" a real move clause uses —
 * quantifier + notSelf-marker + type-word + owner-suffix, built from
 * confirmed real templates only (see module doc comment for the 4 real
 * cases this was checked against: `ambrosia-whiteheart`, `chocobo-kick`,
 * `jill-shiva-s-dominant-shiva-warden-of-ice`, `suplex`/`eject`/`ice-magic`
 * as the "no owner" baseline). `undefined` when `owner` is set to anything
 * other than `'you'`/`'each'`/omitted — no confirmed template for
 * `'opponents'` yet (no real card in this pool's `target:true` move
 * population needs it). */
function objectPhrasePattern(effect: MoveEffect): string | undefined {
  const typeWord = typeWordFor(effect);
  if (!typeWord) return undefined;
  if (effect.owner !== undefined && effect.owner !== 'you' && effect.owner !== 'each') return undefined;

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

  // owner omitted or 'each' — both mean "no restriction stated" (see module
  // doc comment on `suplex`'s own real "Exile target artifact.").
  const article = effect.notSelf ? '(?:another|other) (?:target )?' : 'target ';
  return `${quantifier}${article}${typeWord}`;
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
  const moveEffects = allEffects(input).filter(isTargetedMoveEffect);
  if (moveEffects.length === 0) {
    return { matched: false, reason: 'no kind:"move" Effect with target:true on this face' };
  }

  const lines = input.oracleText.split('\n');
  const claimedLines = new Set<number>();
  const facts: RecognizedFact[] = [];

  for (const effect of moveEffects) {
    const phrase = objectPhrasePattern(effect);
    if (!phrase) {
      return {
        matched: false,
        reason: `a targeted move effect on this face (${JSON.stringify(effect)}) has no confirmed structural→text template (an unsupported owner value, non-literal qty/qty!=1, or an unsupported validType — see module doc comment for the full, per-field breakdown)`,
      };
    }

    const pattern = new RegExp(`\\b${phrase}\\b`, 'i');
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
    // already used (confirmed against it, not invented here). `owner:'each'`
    // means no restriction at all (see module doc comment) — no `controller`
    // field, same as omitting `owner` entirely.
    facts.push({
      role: 'source',
      fact: {
        from: effect.from,
        to: effect.to,
        ...(effect.owner === 'you' ? { controller: 'you' as const } : {}),
        ...(target ? { target } : {}),
        targeted: true,
        annotations: [annotation],
      },
      provenance: { origin: 'parser', rule: RULE },
    });

    // Companion SINK fact (real pool precedent: `eject`/`jill-shiva-s-
    // dominant-shiva-warden-of-ice`/`ice-magic`/`summon-leviathan` all
    // already pair their own real "return/exile a permanent FROM the
    // battlefield" move with a "wants a permanent present on the
    // battlefield" sink, same annotation span as the source above) — only
    // for a `from:'Battlefield'` move (the one real confirmed zone this
    // pairing applies to; a hypothetical Graveyard-sourced targeted move has
    // no real card to confirm an equivalent sink shape against yet).
    if (effect.from === 'Battlefield') {
      facts.push({
        role: 'sink',
        fact: {
          to: 'Battlefield',
          ...(effect.owner === 'you' ? { controller: 'you' as const } : {}),
          ...(target ?? {}),
          annotations: [annotation],
        },
        provenance: { origin: 'parser', rule: RULE },
      });
    }
  }

  return { matched: true, facts };
}
