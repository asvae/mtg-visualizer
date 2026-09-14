// Recognizer D (`PRD_AUTOMATED_AUTHORING.md`, 2026-09-13 follow-up) — reads a
// `CardDefinition`'s own already-typed `Effect[]` STRUCTURE directly (never
// oracle text, never Forge script), for `kind: 'drawCard'` specifically,
// mirroring `destroy-effect-structural.ts`'s own approach exactly (see that
// file's own module doc comment for the full "why structural, not
// Forge-script" rationale — not repeated here). Shares its container-walking
// machinery (`collectEffects`/`allEffects`/`StructuralRecognizerInput`) via
// `structural-effects.ts`, factored out once a SECOND structural recognizer
// needed the identical walk.
//
// **Motivating real card, the same one the PRD's user cited**:
// `cards/summon-bahamut/definition.ts` (fin/1) chapter III —
//   `{ kind: 'drawCard', amount: 2 } satisfies Effect`
// — every field a Fact needs (`amount`) is already a plain, typed,
// non-function value, no text parsing required. `card.ts:347`'s real type:
// `{ kind: 'drawCard'; amount?: Computed<number> }` — an OMITTED `amount`
// resolves to a literal `1` at resolution (`card.ts`'s own `applyEffect`:
// `resolve(effect.amount ?? 1, ctx)`), so this recognizer treats "no
// `amount` field" and "`amount: 1`" identically.
//
// **`value` on the produced Fact is a FIXED `1`, same convention
// `destroy-effect-structural.ts`'s own `value: 1` establishes — NOT copied
// from the effect's own `amount`.** Checked the real pool's existing
// hand-authored `event:'drawCard'` facts first (20 real cards): every one
// that has moved past the old `-1` "pending `compute-weights.mjs`"
// placeholder reads `value: 1` regardless of how many cards the card's own
// effect actually draws — `summon-bahamut`'s own chapter III draws 2, its
// hand-authored fact still reads `value: 1`; `qiqirn-merchant`'s `bigDraw`
// ability draws 3, same `value: 1`; `travel-the-overworld` draws 4, same
// `value: 1`. `value` on this fact SHAPE is a fixed weight, not a literal
// card count (a real draw-count distinction, if this vocabulary ever wants
// one, would need a different field — no existing `event:'drawCard'` fact
// in this pool carries one today).
//
// **`kind:'scope'` vs `kind:'mismatch'` (2026-09-13, `apply-recognizers.mjs`'s
// own hard-fail-on-mismatch pass — see `types.ts`'s own doc comment for the
// full taxonomy)**: every decline below that never gets as far as building a
// text pattern at all (non-literal `amount`, an `amount` with no confirmed
// template) is `kind:'scope'`, unchanged/implicit. Once a pattern IS built,
// this recognizer's own `matchAll` step distinguishes two real, differently-
// caused "0 matches" outcomes: the built clause genuinely never appearing
// (real structural/text divergence, `kind:'mismatch'` — the
// `joshua-phoenix...`/`kefka-court-mage...`/`combat-tutorial` cases below)
// vs. its only real occurrence being excluded by the "may draw" negative
// lookbehind ON PURPOSE (`rook-turret`, see below) — that one stays
// `kind:'scope'` even though it's also a 0-match outcome, because the
// recognizer isn't wrong about what the card says; it's declining a shape
// (an optional draw) it was never designed to assert in the first place,
// same category as an `owner`-restricted `destroy` effect declining
// unconditionally in the sibling recognizer.
//
// **Real, deliberate scope narrowing found while building this** (see this
// recognizer's own `expectedClausePattern` doc comment for the exact
// declines):
// - Non-literal `amount` (a `Computed<number>` closure) declines — same
//   opaque-closure wall `destroy-effect-structural.ts`'s own `qty`/
//   `minPower` check already established. Real pool cards this hits:
//   `deadly-embrace`, `edgar-king-of-figaro`,
//   `kefka-court-mage-kefka-ruler-of-ruin` (its `onOpponentLosesLife`
//   trigger, back face only — its front-face `onEnter`/`onAttacks`
//   triggers use a LITERAL `amount: 2` instead and decline for a different
//   reason, see below), `shantotto-tactician-magician`, `summon-fenrir`,
//   `jenova-ancient-calamity`, `nibelheim-aflame`, `tellah-great-sage`,
//   `summon-shiva`, and `sephiroth-fabled-soldier-sephiroth-one-winged-
//   angel`'s own BACK face (One-Winged Angel's "sacrifice any number...
//   draw THAT MANY cards" — a real chosen X, `ctx.triggerInput?.sacCount`).
// - A literal `amount` with no confirmed template (only 1/undefined, 2, 3,
//   4 are confirmed against a real pool card below) declines — no real
//   pool card needs a 5th, so this stays conservative rather than guessed.
// - The built clause not appearing VERBATIM (case-insensitive, real clause
//   boundary right after) declines, same discipline as the destroy
//   recognizer's own `qutrub-forayer` case — but here the interesting real
//   failures run the OPPOSITE direction from a trailing qualifier: a
//   literal `amount` that's actually an ENGINE-SIDE APPROXIMATION of a real
//   VARIABLE draw the oracle text never states as a fixed number at all:
//   - `joshua-phoenix-s-dominant-phoenix-warden-of-fire`'s own front face:
//     `{amount: 2}`, but the real oracle reads "discard up to two cards,
//     THEN DRAW THAT MANY CARDS" (a variable readback of the discard
//     count, not a fixed "two") — `definition.ts`'s own comment already
//     flags the fixed `2` as "the honest approximation," not a literal
//     transcription; this recognizer correctly declines rather than assert
//     a fact the real text doesn't literally support.
//   - `kefka-court-mage-kefka-ruler-of-ruin`'s own front-face `onEnter`/
//     `onAttacks` triggers: `{amount: 2}`, but the real oracle reads "you
//     draw a card FOR EACH CARD TYPE among cards discarded this way" (also
//     variable, also an approximation) — same reasoning, same correct
//     decline.
//   - `combat-tutorial`: `{amount: 2}`, but the real oracle reads "TARGET
//     PLAYER DRAWS two cards" (third person, targeting ANY player — this
//     card's own effect always draws for `ctx.you` regardless, per
//     `definition.ts`'s own comment on the real engine gap this
//     represents) — the built imperative clause "Draw two cards" never
//     appears (the real text says "draws," not "draw"), so this declines
//     for free, without this recognizer needing to know anything about
//     targeting at all.
// - **"May draw" — an effect this recognizer can't tell apart from an
//   unconditional draw, since `card.ts`'s own `drawCard` Effect kind has NO
//   `optional` field at all (unlike `destroy`'s own `optional?: boolean`)**:
//   `rook-turret`'s real "you MAY draw a card. If you do, discard a card."
//   — the draw itself is the player's own choice, not guaranteed, which
//   this engine's `drawCard` Effect has no way to represent — asserting an
//   unconditional `event:'drawCard'` fact here would overclaim. Declined
//   via a negative lookbehind on the literal word "may" immediately
//   preceding the match (checked the whole real pool for this exact "may
//   draw" shape — `rook-turret` is the only real hit). Classified
//   `kind:'scope'` (not `'mismatch'`), per the reasoning above — an
//   intentional, designed-in guard, not a structural/text divergence.
//
// **Real accepted boundary characters, wider than the destroy recognizer's
// own strict period/newline/end-of-string set** — checked against every
// real literal-`amount` pool card before adding either:
// - A comma (`,`) — a real, common draw-effect template this pool uses
//   often: "draw a card, then discard a card" (`adventurer-s-airship`,
//   `emet-selch-unsundered-hades-sorcerer-of-eld`, `locke-cole`,
//   `qiqirn-merchant`'s own `cantrip` ability,
//   `sidequest-card-collection-magicked-card`), and once mid-quoted-text
//   (`thief-s-knife`'s own granted-ability string, "...draw a card," and is
//   a Rogue...").
// - `" and "` (a real coordinating conjunction joining a SECOND,
//   independently-represented effect on the SAME card, not an uncaptured
//   qualifier) — `circle-of-power`'s own "You draw two cards AND you lose
//   2 life" (a real, separate `loseLife` effect on this same card) and
//   `seymour-flux`'s own "draw a card AND put a +1/+1 counter on Seymour
//   Flux" (a real, separate `putCounter` effect). Checked both: the
//   "and"-clause always corresponds to a real, separately-modeled effect
//   elsewhere on the SAME card in this pool — never a hidden qualifier on
//   the draw itself.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'drawCard-effect-structural' as const;

type DrawCardEffect = Extract<Effect, { kind: 'drawCard' }>;

function isDrawCardEffect(e: Effect): e is DrawCardEffect {
  return e.kind === 'drawCard';
}

/** Only 2/3/4 are real, pool-confirmed plural number words — `amount === 1`
 * (or omitted) is handled separately below as singular "a card", not "one
 * card" (Magic's own real templating never says "draw one card"). */
const NUMBER_WORDS: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four' };

/** The plain English quantity phrase for a `drawCard` effect's own `amount`
 * ("a card" / "two cards" / ...) — factored out of `expectedClausePattern` so
 * the caller can also build the unguarded "may draw <phrase>" check below
 * without duplicating the amount→phrase logic. Returns `undefined` (never
 * guesses) whenever `amount` falls outside what this recognizer has a real,
 * pool-confirmed template for — see this file's own module doc comment. */
function drawPhrase(effect: DrawCardEffect): string | undefined {
  if (effect.amount !== undefined && typeof effect.amount !== 'number') return undefined; // Computed<number> closure — opaque, can't read without executing it
  const amount = effect.amount ?? 1; // an omitted amount resolves to 1 at resolution (card.ts's own applyEffect)
  if (amount === 1) return 'a card';
  const word = NUMBER_WORDS[amount];
  if (!word) return undefined; // no real amount>4 (or non-integer/negative) card to verify plural templating against
  return `${word} cards`;
}

/**
 * Builds the expected literal English clause for one structurally-read
 * `drawCard` effect — see this file's own module doc comment for the full
 * reasoning behind every real decline/accept boundary below. Returns
 * `undefined` (never guesses) whenever `amount` falls outside what this
 * recognizer has a real, pool-confirmed template for.
 */
function expectedClausePattern(effect: DrawCardEffect): RegExp | undefined {
  const phrase = drawPhrase(effect);
  if (!phrase) return undefined;

  // Case-insensitive `Draw`, word-bounded, immediately followed by the built
  // phrase, immediately followed by a real clause boundary — period,
  // newline, comma, " and" (a real SECOND effect on the same card, not an
  // uncaptured qualifier — see module doc comment), or end of string. The
  // negative lookbehind excludes "...may draw..." (rook-turret's own real,
  // unrepresentable OPTIONAL draw — see module doc comment); it does NOT
  // exclude "you draw"/"then draw" (`\b` before `Draw` already requires a
  // non-word character ahead of it, which "you "/"then " both satisfy).
  return new RegExp(`(?<!\\bmay )\\bDraw ${phrase}(?=[.,\\n]|$|\\s+and\\b)`, 'i');
}

/**
 * Reads one face's own structured `Effect[]` directly (never this face's own
 * oracle text, except to ANCHOR the derived fact's annotation — see module
 * doc comment) and derives the `event: 'drawCard'` Fact(s) implied by every
 * `kind: 'drawCard'` effect this recognizer can confidently resolve.
 *
 * **All-or-nothing per face, not per-effect** — same simplification
 * `destroy-effect-structural.ts` makes (see its own doc comment): if this
 * face has zero `drawCard` effects, declines with that reason; if it has
 * one or more but ANY of them can't be confidently resolved, the WHOLE face
 * declines rather than partially claiming only the resolvable ones. No real
 * card in the pool this recognizer was checked against needs finer-grained
 * partial success — every real MULTIPLE-`drawCard`-effect face maps to the
 * exact SAME shared clause (deduped below): `emet-selch-unsundered-hades-
 * sorcerer-of-eld`'s onEnter/onAttacks pair, `matoya-archon-elder`'s
 * onScry/onSurveil pair, `summon-anima`'s 3 identical chapters,
 * `jecht-reluctant-guardian-braska-s-final-aeon`'s back-face chapterI/II
 * pair — plus `qiqirn-merchant`, whose own two activated abilities
 * (`cantrip`'s bare draw, `bigDraw`'s literal 3) are genuinely TWO separate
 * real clauses at two separate positions, each independently matched once.
 *
 * **No dedup here** — every matched `drawCard` effect on this face produces
 * its own `RecognizedFact` below, including a literal duplicate when two
 * effects share one real clause (the `emet-selch-unsundered-...`/`matoya-
 * archon-elder`/`jecht-reluctant-guardian-...` cases above). Dedup/merge
 * across those (and, more generally, merging two facts that are the same
 * real claim but point at DIFFERENT real annotation spans — `qiqirn-
 * merchant`'s own two draw abilities, above) is now a single shared
 * runner-level pass (`apply-recognizers.mjs`'s own
 * `mergeRecognizedFactsByIdentity` — see that function's own doc comment),
 * not this recognizer's own concern — moved there 2026-09-13 per the PRD's
 * own follow-up (this file used to keep its own per-face `seen` Set here,
 * keyed on the full `JSON.stringify(fact)`, which only ever collapsed two
 * facts sharing the exact same annotation span — `qiqirn-merchant`'s own
 * two facts were therefore never deduped by the OLD logic either, but
 * WILL now merge into one fact carrying both annotations under the new
 * runner-level pass; that is the intended, generalized outcome, not a
 * regression — Facts describe a card's real capability, not how many
 * separate abilities happen to produce it).
 */
export function recognizeDrawCardEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const drawCardEffects = allEffects(input).filter(isDrawCardEffect);
  if (drawCardEffects.length === 0) {
    return { matched: false, reason: 'no kind:"drawCard" Effect on this face' };
  }

  const facts: RecognizedFact[] = [];

  for (const effect of drawCardEffects) {
    const pattern = expectedClausePattern(effect);
    if (!pattern) {
      return {
        matched: false,
        reason: `a drawCard effect on this face (${JSON.stringify(effect)}) has no confirmed structural→text template (non-literal amount, or an amount with no confirmed real-pool template)`,
      };
    }

    const global = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(global)];
    if (matches.length === 0) {
      // Two genuinely different reasons this can be 0, distinguished before
      // declaring a `kind` (see `types.ts`'s own doc comment):
      //   - The literal phrase's only real occurrence is guarded off by the
      //     negative lookbehind above because it's an intentional, DESIGNED-IN
      //     exclusion (rook-turret's own "you MAY draw a card" — `kind:
      //     'drawCard'` has no `optional` field at all, unlike `kind:
      //     'destroy'`, so this recognizer can never represent an optional
      //     draw and correctly never tries) — this is `kind:'scope'`, not a
      //     structural/text divergence: the recognizer isn't wrong about what
      //     the card says, it's declining a shape it was never designed to
      //     assert in the first place.
      //   - Anything else: the built clause genuinely never appears — a real
      //     `kind:'mismatch'` (the recognizer's own model of "what this
      //     should read like" diverged from the real printed text — see
      //     module doc comment's `joshua-phoenix...`/`kefka-court-mage...`/
      //     `combat-tutorial` examples).
      const phrase = drawPhrase(effect)!; // already confirmed defined — `pattern` above only builds once `drawPhrase` succeeds
      const mayVariant = new RegExp(`\\bmay\\s+draw\\s+${phrase}\\b`, 'i');
      if (mayVariant.test(input.oracleText)) {
        return {
          matched: false,
          kind: 'scope',
          reason: `expected clause /${pattern.source}/ not found because the only real occurrence of "draw ${phrase}" in this oracle text is an optional "may draw ${phrase}" — kind:'drawCard' has no 'optional' field (unlike kind:'destroy'), so this negative-lookbehind exclusion is an intentional, designed-in guard, not a structural/text divergence`,
        };
      }
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ not found (verbatim, with a real clause boundary right after, and not preceded by "may") in oracle text "${input.oracleText}"`,
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

    const fact: RecognizedFact = {
      role: 'source',
      fact: {
        event: 'drawCard',
        controller: 'you',
        annotations: [annotation],
      },
      provenance: { origin: 'parser', rule: RULE },
    };

    facts.push(fact);
  }

  return { matched: true, facts };
}
