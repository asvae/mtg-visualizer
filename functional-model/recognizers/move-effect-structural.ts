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
// **Real, deliberate scope narrowing, checked against the whole pool
// first** (14 real fin cards have a `kind:'move', target: true` effect;
// see this file's own `move-effect-structural.test.ts` for the full grep) —
// same conservative-by-construction discipline as every other structural
// recognizer:
// - `owner` set declines (`kind:'scope'`) — same unconfirmed-Fact-shape
//   reasoning `destroy-effect-structural.ts` already applies to an
//   `owner`-restricted `destroy`; real cards this excludes: `chocobo-kick`,
//   `joshua-phoenix-s-dominant-phoenix-warden-of-fire`, `fight-on`,
//   `ambrosia-whiteheart`, `resentful-revelation`, `suplex`,
//   `qutrub-forayer`, `sorceress-s-schemes`, `magic-pot`, `rydia-s-return`,
//   `vanille-cheerful-l-cie`.
// - `notSelf` set declines (`kind:'scope'`) — "return ANOTHER target
//   permanent" is real, different templating ("another") this recognizer's
//   own bare "target <type>" phrase doesn't assert; real cards excluded:
//   `jill-shiva-s-dominant-shiva-warden-of-ice`, `ambrosia-whiteheart`.
// - `optional` set declines (`kind:'scope'`) — a real "you MAY return..."
//   choice this engine's `move` Effect has no separate field for (same
//   "can't tell an unconditional move from an optional one" wall
//   `drawCard-effect-structural.ts`'s own module doc comment names for
//   `rook-turret`'s "may draw"); real cards excluded: `jill-shiva-s-
//   dominant-shiva-warden-of-ice`, `eject`, `ambrosia-whiteheart`.
// - Non-literal `qty` (`Computed<number>`) or `qty !== 1` declines
//   (`kind:'scope'`) — same opaque-closure/no-real-plural-template wall
//   `destroy-effect-structural.ts` already applies.
// - `validType` omitted entirely, or anything other than `'creature'` /
//   `'artifact'` / `'land'` / `'any'` (with or without `nonLand`), declines
//   (`kind:'scope'`) — no confirmed real-pool template for another value.
//
// **Real pool check confirming this leaves exactly `ice-magic` (all 3
// modes) as the only current match** — every one of the 14 real
// `target:true` move cards other than `ice-magic` carries at least one of
// `owner`/`notSelf`/`optional` (see the exclusion list above); the
// remaining 2 cards with NEITHER (`jill-shiva-s-dominant-shiva-warden-of-
// ice`, `eject`) both separately carry `optional`/`notSelf` anyway, so
// still correctly decline. Re-check this comment if a future card changes
// that.
import type { Effect } from '../card';
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'move-effect-structural' as const;

type MoveEffect = Extract<Effect, { kind: 'move' }>;

function isTargetedMoveEffect(e: Effect): e is MoveEffect {
  return e.kind === 'move' && e.target === true;
}

/** The plain English type-word a real "target <type>" clause uses for this
 * effect's own `validType` — `undefined` (never guessed) for anything
 * outside this recognizer's own confirmed real-pool vocabulary (see module
 * doc comment). */
function typeWordFor(effect: MoveEffect): string | undefined {
  if (effect.owner) return undefined;
  if (effect.notSelf) return undefined;
  if (effect.optional) return undefined;
  if (typeof effect.qty !== 'number') return undefined; // Computed<number> closure — opaque
  if (effect.qty !== 1) return undefined; // no real qty>1 card to verify plural templating against
  if (effect.validType === 'creature') return 'creature';
  if (effect.validType === 'artifact') return 'artifact';
  if (effect.validType === 'land') return 'land';
  if (effect.validType === 'any') return effect.nonLand ? 'nonland permanent' : 'permanent';
  return undefined; // validType omitted, or an unconfirmed value
}

/** The Fact-shape `target` constraint for this same effect — mirrors
 * `destroy-effect-structural.ts`'s own `buildTargetConstraint` mapping
 * (`nonLand` -> `types:{not:['Land']}`, a bare unrestricted `'any'` -> no
 * type filter at all, matching `restoration-magic`'s own real hand-
 * authored "target permanent" fact, which carries an empty `target: {}`). */
function buildTargetConstraint(effect: MoveEffect): Constraints | undefined {
  if (effect.validType === 'creature') return { types: { has: ['Creature'] } };
  if (effect.validType === 'artifact') return { types: { has: ['Artifact'] } };
  if (effect.validType === 'land') return { types: { has: ['Land'] } };
  if (effect.validType === 'any' && effect.nonLand) return { types: { not: ['Land'] } };
  return undefined;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    const typeWord = typeWordFor(effect);
    if (!typeWord) {
      return {
        matched: false,
        reason: `a targeted move effect on this face (${JSON.stringify(effect)}) has no confirmed structural→text template (owner/notSelf/optional set, non-literal qty/qty!=1, or an unsupported validType)`,
      };
    }

    const pattern = new RegExp(`\\btarget ${escapeRegExp(typeWord)}\\b`, 'i');
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
    facts.push({
      role: 'source',
      fact: {
        from: effect.from,
        to: effect.to,
        ...(target ? { target } : { target: {} }),
        targeted: true,
        annotations: [annotation],
      },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
