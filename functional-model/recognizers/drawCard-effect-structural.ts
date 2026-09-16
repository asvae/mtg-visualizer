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
//     `card.ts`'s own `drawCard.owner` doc comment on the real
//     engine gap this represents). The imperative clause "Draw two
//     cards" never appears here (the real text says "draws," not
//     "draw") — 2026-09-16: no longer a bare decline. This recognizer
//     now ALSO tries a second, third-person "Target player draws
//     <phrase>" template (`expectedTargetedPlayerClausePattern`, below)
//     once the imperative one fails to match; Combat Tutorial is that
//     template's sole real motivator and now matches through it, with
//     `controller` omitted (honest to the real unrestricted target,
//     wider than this engine's `ctx.you`-only implementation) instead of
//     the imperative template's own `controller: 'you'`.
// - **"May draw" — CLOSED 2026-09-16 (recognizer-lane escalation)**:
//   `card.ts`'s own `drawCard` Effect kind gained a real `optional?: boolean`
//   field the same day specifically so this shape could be told apart from
//   an unconditional draw (mirroring `destroy`'s/`move`'s/`sacrifice`'s own
//   pre-existing `optional` fields) — this recognizer now reads it.
//   `rook-turret`'s real "you MAY draw a card. If you do, discard a card." is
//   the sole real pool card setting `optional: true` (checked). When set, the
//   imperative "Draw <phrase>" template's own negative lookbehind (still
//   there, unchanged, for the non-optional case) correctly never matches the
//   "may draw" text, and a THIRD, narrower template —
//   `expectedOptionalClausePattern`, "you may draw <phrase>" — is tried
//   instead, emitting the SAME plain `{event:'drawCard', controller:'you'}`
//   fact shape the imperative template emits (this Fact vocabulary has no
//   "optional" field of its own to carry the distinction — the documentary-
//   only convention `optional` already follows for `destroy`/`move`/
//   `sacrifice` applies here too: no player-decision engine exists anywhere
//   in this codebase, so a legal draw always happens once the trigger
//   fires). A card whose text says "may draw" WITHOUT `optional: true` set
//   (a real, if currently hypothetical, data-consistency bug) still falls
//   through to the same `kind:'scope'` decline as before — see below —
//   rather than silently matching through the new template.
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
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

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
 * The alternate, third-person "Target player draws <phrase>" clause shape
 * (real Forge `DrawEffect.java`'s own `getStackDescription()`: `Lang.
 * joinVerb(tgtPlayers, " draw")` — pluralizes to "draws" for a singular
 * target, same real grammar this template matches) — as opposed to
 * `expectedClausePattern`'s own imperative "Draw <phrase>" (addressed at
 * whichever player resolves the ability, i.e. `ctx.you` under this card's
 * own runtime approximation). **Sole real pool motivator: Combat Tutorial
 * (fin/48)**, "Target player draws two cards." — `ValidTgts$ Player`, no
 * `.YouCtrl`/`.Opponent` restriction, a real CHOSEN target among every
 * player in the game. `card.ts`'s own `drawCard.owner` field can't express
 * that (see its own doc comment: `EffectOwner`'s 3 values are all fixed
 * GROUPS, never "one chosen player, any side") — this recognizer doesn't
 * try to key off `owner` at all for this template; it matches purely
 * against the ORACLE TEXT itself and emits a fact honest to what the card
 * really says (`targeted: true`, no `controller` — see below), independent
 * of how the engine actually resolves the draw. Checked the whole real
 * pool for a "target opponent draws"/"each player draws" variant of this
 * same third-person shape: none exist today (Combat Tutorial is the only
 * real `ValidTgts$ Player`-style targeted draw in this pool), so only the
 * bare "target player" wording is matched — widen this the day a second
 * real card needs a different targeted-player phrasing.
 */
function expectedTargetedPlayerClausePattern(effect: DrawCardEffect): RegExp | undefined {
  const phrase = drawPhrase(effect);
  if (!phrase) return undefined;
  return new RegExp(`\\bTarget player draws ${phrase}(?=[.,\\n]|$|\\s+and\\b)`, 'i');
}

/**
 * The optional-draw clause shape (2026-09-16, `effect.optional`'s own
 * consuming template) — "you may draw <phrase>", as opposed to
 * `expectedClausePattern`'s own unconditional imperative (whose negative
 * lookbehind deliberately EXCLUDES this exact text). **Sole real pool
 * motivator: Rook Turret (fin/79)**, "Whenever another artifact you control
 * enters, you may draw a card. If you do, discard a card." — checked the
 * whole real pool for this exact "may draw" shape: `rook-turret` is the only
 * real hit, so only this one literal "you may draw" wording is confirmed;
 * widen the day a second real card needs a different optional-draw phrasing
 * (e.g. a targeted or third-person variant). Only ever tried when
 * `effect.optional` is `true` — see this file's own module doc comment. */
function expectedOptionalClausePattern(effect: DrawCardEffect): RegExp | undefined {
  const phrase = drawPhrase(effect);
  if (!phrase) return undefined;
  return new RegExp(`\\byou may draw ${phrase}\\b`, 'i');
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
  const drawCardEffects = allEffects(input).map((o) => o.effect).filter(isDrawCardEffect);
  if (drawCardEffects.length === 0) {
    return { matched: false, reason: 'no kind:"drawCard" Effect on this face' };
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of drawCardEffects) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    const pattern = expectedClausePattern(effect);
    if (!pattern) {
      return {
        matched: false,
        reason: `a drawCard effect on this face (${JSON.stringify(effect)}) has no confirmed structural→text template (non-literal amount, or an amount with no confirmed real-pool template)`,
      };
    }

    const global = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(global)];
    // Third-person "Target player draws <phrase>" — tried whenever the
    // imperative template above doesn't match, not gated on `effect.owner`
    // (see `expectedTargetedPlayerClausePattern`'s own doc comment for why).
    const targetedPattern = expectedTargetedPlayerClausePattern(effect);
    const targetedGlobal = targetedPattern ? new RegExp(targetedPattern.source, targetedPattern.flags + 'g') : undefined;
    const targetedMatches = matches.length === 0 && targetedGlobal ? [...input.oracleText.matchAll(targetedGlobal)] : [];
    // "you may draw <phrase>" — tried only when `effect.optional` is `true`
    // (2026-09-16, see `expectedOptionalClausePattern`'s own doc comment).
    const optionalPattern = effect.optional && matches.length === 0 && targetedMatches.length === 0 ? expectedOptionalClausePattern(effect) : undefined;
    const optionalGlobal = optionalPattern ? new RegExp(optionalPattern.source, optionalPattern.flags + 'g') : undefined;
    const optionalMatches = optionalGlobal ? [...input.oracleText.matchAll(optionalGlobal)] : [];

    if (matches.length === 0 && targetedMatches.length === 0 && optionalMatches.length === 0) {
      // Two genuinely different reasons this can be 0, distinguished before
      // declaring a `kind` (see `types.ts`'s own doc comment):
      //   - The literal phrase's only real occurrence is guarded off by the
      //     negative lookbehind above, AND `effect.optional` isn't set —
      //     this is `kind:'scope'`, not a structural/text divergence: the
      //     recognizer isn't wrong about what the card says, it's declining
      //     a shape it was never told (via `effect.optional`) to assert in
      //     the first place. (When `effect.optional` IS set, this whole
      //     branch is unreachable for a genuine "you may draw" clause — the
      //     `optionalMatches` check above already caught it — so reaching
      //     here with `effect.optional` true means the card's own text
      //     genuinely doesn't say "you may draw <phrase>" at all, a real
      //     `kind:'mismatch'` instead, handled by the fallthrough below.)
      //   - Anything else: the built clause genuinely never appears — a real
      //     `kind:'mismatch'` (the recognizer's own model of "what this
      //     should read like" diverged from the real printed text — see
      //     module doc comment's `joshua-phoenix...`/`kefka-court-mage...`
      //     examples — `combat-tutorial` itself is no longer one of these,
      //     since the targeted template above now matches it).
      const phrase = drawPhrase(effect)!; // already confirmed defined — `pattern` above only builds once `drawPhrase` succeeds
      const mayVariant = new RegExp(`\\bmay\\s+draw\\s+${phrase}\\b`, 'i');
      if (!effect.optional && mayVariant.test(input.oracleText)) {
        return {
          matched: false,
          kind: 'scope',
          reason: `expected clause /${pattern.source}/ not found because the only real occurrence of "draw ${phrase}" in this oracle text is an optional "may draw ${phrase}" but effect.optional is not set — kind:'drawCard' has a real 'optional' field now (2026-09-16), so this card's own data should set it rather than leaving this recognizer to guess`,
        };
      }
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ not found (verbatim, with a real clause boundary right after, and not preceded by "may"), the targeted-player alternate /${targetedPattern?.source}/ not found, and the optional-draw alternate /${optionalPattern?.source}/ not found either, in oracle text "${input.oracleText}"`,
      };
    }
    if (matches.length > 1 || targetedMatches.length > 1 || optionalMatches.length > 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause matched ${matches.length + targetedMatches.length + optionalMatches.length} times across all templates — ambiguous, declining rather than guessing which`,
      };
    }

    const usingTargetedTemplate = matches.length === 0 && targetedMatches.length > 0;
    const usingOptionalTemplate = matches.length === 0 && targetedMatches.length === 0 && optionalMatches.length > 0;
    const m = (usingOptionalTemplate ? optionalMatches : usingTargetedTemplate ? targetedMatches : matches)[0]!;
    const start = m.index!;
    const end = start + m[0]!.length;
    const annotation = toLineOffset(input.oracleText, start, end);
    if (!annotation) {
      return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
    }

    // The imperative "Draw <phrase>" template AND the optional "you may draw
    // <phrase>" template are both addressed at whichever player resolves
    // the ability — this engine's own runtime always resolves that to
    // `ctx.you` (`effect.owner ?? 'you'`, see card.ts), so `controller:
    // 'you'` is a true structural claim for either shape (the Fact
    // vocabulary carries no separate "optional" marker — see module doc
    // comment). The targeted "Target player draws <phrase>" template is a
    // real, unrestricted CHOSEN target (`ValidTgts$ Player`, no `.YouCtrl`
    // restriction) — asserting `controller: 'you'` there would overclaim
    // (same "honest fact, documented engine gap" treatment
    // `combat-tutorial`'s own definition.ts comment already establishes),
    // so this omits `controller` entirely and marks `targeted: true`
    // instead (purely informational, synergy.ts's own doc comment — not
    // consulted by the matcher).
    const fact: RecognizedFact = usingTargetedTemplate
      ? {
          role: 'source',
          fact: {
            event: 'drawCard',
            targeted: true,
            annotations: [annotation],
            ...(triggeredBy ? { triggeredBy } : {}),
          },
          provenance: { origin: 'parser', rule: RULE },
        }
      : {
          role: 'source',
          fact: {
            event: 'drawCard',
            controller: 'you',
            annotations: [annotation],
            ...(triggeredBy ? { triggeredBy } : {}),
          },
          provenance: { origin: 'parser', rule: RULE },
        };

    facts.push(fact);
  }

  return { matched: true, facts };
}
