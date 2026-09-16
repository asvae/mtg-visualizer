// New recognizer (2026-09-16, card-results/fin-51-75 triage backlog item
// #2 — "second-biggest win", 17 real pool cards). Structural — reads a
// face's own `kind:'discard'` `Effect[]` directly (never oracle text for
// STRUCTURE), same family as `destroy-effect-structural.ts`/`drawCard-
// effect-structural.ts`.
//
// **`card.ts`'s own `discard` Effect shape is deliberately tiny**: `{ kind:
// 'discard'; owner: EffectOwner; qty: Computed<number> }` — no `validType`/
// `optional` field at all (unlike `sacrifice`/`destroy`). Two real
// consequences of this, both checked against the WHOLE real pool before
// writing this recognizer's own regex:
//
// - **No structural signal distinguishes "you MAY discard" from "you MUST
//   discard"** — the same "Loot" family (`rydia-summoner-of-mist`, `giott-
//   king-of-the-dwarves`, `rook-turret`, `summon-g-f-ifrit`) is modeled as
//   an unconditional discard regardless of whether the real printed text
//   says "you may discard a card. If you do, draw a card." (optional,
//   real) or a plain imperative (unconditional, real) — same "no
//   player-decision engine" simplification this pool's own `sacrifice`/
//   `move` `optional` fields already document (see e.g. `rydia-summoner-
//   of-mist`'s own definition.ts comment). This recognizer therefore never
//   requires or excludes a "may"/"if you do" wrapper — it just looks for
//   the bare verb+quantity phrase, wherever it sits in the sentence.
// - **No structural signal distinguishes WHO conjugates the verb**
//   ("discard" vs "discards") either — checked: every real owner:'you'
//   card in the pool uses the base form "discard" (either a bare
//   imperative, "draw a card, then discard a card," or after a modal
//   "may," "you may discard a card"); every real owner:'opponents'/'each'
//   card uses the 3rd-person "discards" ("each opponent discards a card,"
//   "each player discards a card") with NO "may" wrapper in this pool's
//   own real text. Rather than deriving verb conjugation from `owner`
//   (fragile, and genuinely not needed), this recognizer just accepts
//   either spelling (`discards?`) unconditionally.
//
// **`owner` restricted to `'you'` — same unconfirmed-shape decline
// `destroy-effect-structural.ts`'s own module doc comment already
// establishes for its identically-named field**: no real hand-authored
// `event:'discard'` ACT fact anywhere in this pool combines a non-`'you'`
// owner (`'opponents'`/`'each'`) with a bare `controller`/no-controller
// shape today, so there's no confirmed Fact convention to build toward for
// those — `hecteyes` (`'opponents'`), `jecht-reluctant-guardian-braska-s-
// final-aeon`'s own back face chapterI/II (`'opponents'`), `kefka-court-
// mage-kefka-ruler-of-ruin`'s own front face (`'each'`), `malboro`
// (`'opponents'`), and `poison-the-waters` (`'opponents'`) all decline via
// `'scope'` for this reason, not individually re-litigated below.
//
// **Real, whole-pool check, all 17 real `kind:'discard'` occurrences**
// (grepped `functional-model/cards/*/definition.ts` first, then read each
// one's own real Scryfall oracle text directly):
//   - **Literal `qty:1` (or an inline literal `1`), `owner:'you'`, matches
//     "discard a card" verbatim**: `adventurer-s-airship`, `emet-selch-
//     unsundered-hades-sorcerer-of-eld` (both its `onEnter`/`onAttacks`
//     triggers, same shared real clause — dedups to one fact, same "two
//     triggers, one real sentence" shape `namazu-trader`'s own onAttack/
//     onEnter pair already established for a different effect kind),
//     `giott-king-of-the-dwarves`, `locke-cole`, `qiqirn-merchant`,
//     `rook-turret`, `rydia-summoner-of-mist`, `summon-g-f-ifrit`
//     (chapterI AND chapterII, same shared clause).
//   - **Literal `qty:2`, `owner:'you'`, matches "discard two cards"
//     verbatim**: `sidequest-card-collection-magicked-card`'s own front
//     face ("draw three cards, then discard two cards").
//   - **Literal `qty:2` that's actually a fixed-count APPROXIMATION of a
//     real "up to two" variable discard** — `joshua-phoenix-s-dominant-
//     phoenix-warden-of-fire`'s own front face: real text is "discard up
//     to two cards, then draw that many cards" — the word directly after
//     "discard" is "up," not "two," so the built phrase never appears
//     verbatim; this recognizer correctly declines via `kind:'mismatch'`
//     for free (no special-casing), same direction `drawCard-effect-
//     structural.ts`'s own sibling decline on this SAME card's `drawCard`
//     effect already documents. Suppressed via `// recognizer-exception:
//     discard-effect-structural` in that card's own `definition.ts`.
//   - **Literal `qty:1` that's a fixed approximation of a real "discard
//     THAT card" (a specific, already-revealed/chosen card, not a generic
//     "a card")** — `poison-the-waters`'s own modal mode: "Target player
//     reveals their hand. You choose an artifact or creature card from
//     it. That player discards THAT card." The built phrase "discard(s) a
//     card" never appears (the real text says "that card"), so this
//     correctly declines via `kind:'mismatch'`. Suppressed via its own `//
//     recognizer-exception:` marker.
//   - **Non-literal `qty` (a `Computed<number>` closure)** — the same
//     opaque-closure wall every other recognizer in this catalog already
//     names: `nibelheim-aflame`'s own "discard your hand" (`ctx.you
//     .getCardsIn('Hand').length`, gated on `ctx.castFrom==='graveyard'`).
//     Declines via `'scope'`, no marker needed (never builds a pattern at
//     all).
//   - **`formidable-speaker`** has a real `kind:'discard'` effect too, but
//     its own Scryfall name has NO checked-in oracle text anywhere under
//     `data/*/*_scryfall.json` (a cross-set reference card, same bucket as
//     ~20 other real pool cards `apply-recognizers.mjs`'s own loader
//     already skips wholesale) — never reaches this recognizer at all,
//     not a decline this file needs to special-case.
//
// **Accepted trailing-boundary characters, reusing (not re-deriving)
// `drawCard-effect-structural.ts`'s own already-vetted set**: a period, a
// newline, end-of-string, a comma (`malboro`'s own "...discards a card,
// loses 2 life, and exiles..."), and the literal `" and "` conjunction
// (`jecht`/`braska`'s own "Each opponent discards a card AND you draw a
// card" — the "and"-clause corresponds to this SAME effect's own paired
// `drawCard` sibling, not an uncaptured qualifier, same check `drawCard-
// effect-structural.ts`'s own module doc comment already requires before
// accepting this exact conjunction).
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'discard-effect-structural' as const;

type DiscardEffect = Extract<Effect, { kind: 'discard' }>;

function isDiscardEffect(e: Effect): e is DiscardEffect {
  return e.kind === 'discard';
}

// Only `1`/`2` are confirmed against a real pool card (see module doc
// comment) — no real card needs a 3rd, so any other literal quantity
// declines rather than guessing at unconfirmed plural templating.
const QUANTITY_PHRASE: Partial<Record<number, string>> = {
  1: 'a card',
  2: 'two cards',
};

/** The real, closed English clause this effect's own structured data
 * implies — `undefined` (never guessed) whenever `owner` isn't `'you'` or
 * `qty` isn't a literal `1` or `2` (see module doc comment). */
function expectedClausePattern(effect: DiscardEffect): RegExp | undefined {
  if (effect.owner !== 'you') return undefined; // no confirmed Fact-shape for an owner-restricted discard ACT — see module doc comment
  if (typeof effect.qty !== 'number') return undefined; // Computed<number> closure — opaque, can't read without executing it
  const phrase = QUANTITY_PHRASE[effect.qty];
  if (!phrase) return undefined;
  // "discard" or "discards" (see module doc comment — this recognizer
  // deliberately doesn't derive verb conjugation from `owner`), immediately
  // followed by the quantity phrase, immediately followed by a real clause
  // boundary.
  return new RegExp(`\\bdiscards? ${phrase}(?=[.\\n,]| and |$)`, 'i');
}

export function recognizeDiscardEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const discardEffects = allEffects(input).map((o) => o.effect).filter(isDiscardEffect);
  if (discardEffects.length === 0) {
    return { matched: false, reason: "no kind:'discard' Effect on this face" };
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of discardEffects) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    const pattern = expectedClausePattern(effect);
    if (!pattern) {
      return {
        matched: false,
        reason: `a discard effect on this face (${JSON.stringify(effect)}) has no confirmed structural→text template (non-literal qty, or a qty outside the confirmed {1,2} set)`,
      };
    }

    const global = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(global)];
    if (matches.length === 0) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ not found (verbatim, with a real clause boundary right after) in oracle text "${input.oracleText}"`,
      };
    }
    if (matches.length > 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times — ambiguous, declining rather than guessing which`,
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
      fact: { event: 'discard', controller: 'you', annotations: [annotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
