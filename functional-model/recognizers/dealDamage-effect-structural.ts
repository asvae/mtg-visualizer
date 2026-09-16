// New recognizer (`PRD_AUTOMATED_AUTHORING.md` follow-up, 2026-09-13,
// closing 2 of Summon: Bahamut/fin-1's own last 3 agent-derived facts) —
// mirrors `destroy-effect-structural.ts`'s exact conservative-declining
// discipline for `kind: 'dealDamage'` instead of `kind: 'destroy'`.
//
// **Real, whole-pool check done first** (same discipline every recognizer
// in this catalog already uses): grepped every real `kind: 'dealDamage'`
// Effect across `functional-model/cards/*/definition.ts` (7 real
// occurrences, checked against each face's own real Scryfall oracle text
// directly) — every single one templates as "<subject> deals <amount>
// damage to each opponent[.,]" (`target: 'opponents'` is the ONLY real
// `EffectOwner` value used for this kind in the whole pool):
//   - Black Waltz No. 3: "Black Waltz No. 3 deals 2 damage to each opponent."
//   - Joshua's back face (Phoenix, Warden of Fire), chapters I+II (same
//     real shared Saga line, same "repeats, not a typo" shape Summon:
//     Bahamut's own destroy chapters already established): "Phoenix deals 2
//     damage to each opponent."
//   - Sabotender: "...this creature deals 1 damage to each opponent."
//   - Vivi Ornitier: "...it deals 1 damage to each opponent."
//   - Summon: Bahamut (chapter IV, Mega Flare): "This creature deals damage
//     equal to the total mana value of other permanents you control to each
//     opponent." — `amount` is a `Computed<number>` closure here, not a
//     literal.
//   - The Emperor of Palamecia's back face (The Lord Master of Hell),
//     Starfall: "...it deals X damage to each opponent, where X is the
//     number of noncreature, nonland cards in your graveyard." — ALSO a
//     `Computed<number>` closure, with a trailing comma-continuation
//     explaining the variable (not a further restriction on "each
//     opponent" — see below for why this doesn't need special-casing).
//
// **Why the built pattern never encodes the literal `amount` at all —
// genuinely different from `destroy-effect-structural`'s own literal-qty
// requirement, not an oversight**: `destroy`'s `qty`/`minPower` feed
// DIRECTLY into the asserted Fact's own `target` Constraints (a plural/
// threshold claim the Fact itself makes) — a non-literal `qty` there
// genuinely can't be represented at all, so that recognizer declines
// outright. `dealDamage`'s `amount` feeds into NO Fact field whatsoever —
// the real, established Fact shape for this event
// (`{event:'damage', controller:'you', recipient:'opp', targeted:false}`,
// confirmed against every one of the 5 cards above that already carry a
// hand-authored version of it) carries no magnitude at all (`Fact.value`,
// a separate, independently-computed weight, used to confirm this even for
// literal cases — e.g. Black Waltz No. 3's own hand-authored `value:4`
// despite its own real printed amount being `2` — before that field was
// removed from the schema entirely, 2026-09-14).
// Since amount plays no role in what this Fact actually CLAIMS, requiring
// it to be a literal number before recognizing the effect at all would be
// needless over-caution, not real conservatism — this is why Summon:
// Bahamut's own chapter IV (a `Computed<number>` amount) is expected to
// MATCH here, unlike its own `destroy` chapters' own `qty` field (a
// literal `1`, coincidentally, but the recognizer would decline it too if
// it weren't).
//
// **The built pattern therefore never anchors on the amount's own text at
// all** — `\bdeals\b[^\n]*?\bdamage\b[^\n]*?\bto each opponent\b`, non-greedy
// and newline-excluded throughout (so it can never accidentally span two
// real oracle-text lines), requiring only that "deals", then "damage", then
// (eventually) "to each opponent" all appear in that order, verbatim,
// somewhere on the same line — regardless of what's in between any of the
// three (a literal number, "X", "damage equal to the total mana value
// of..."). This is genuinely NOT just "deals ... damage to each opponent"
// as one contiguous phrase — Summon: Bahamut's own real chapter IV clause
// ("deals damage equal to the total mana value of other permanents you
// control TO EACH OPPONENT") has real, unrelated words between "damage" and
// "to each opponent," so the two must be allowed to appear separately, not
// adjacently, for this recognizer to actually match its own motivating
// example. Nothing printed AFTER "opponent" on the same line is ever
// required or checked (The Emperor of Palamecia's own trailing ", where X
// is ..." comma-continuation is real, common Magic templating for
// explaining a variable already accounted for by the effect's own `amount`
// closure — not a further restriction on WHO "each opponent" means, which
// is the only thing this Fact actually claims, so there's nothing to lose
// by not requiring a stricter trailing boundary the way `destroy-effect-
// structural`'s own target-type phrase needs).
//
// **Tier-2 paired sink, promoted out of prototype status alongside this
// recognizer's own wiring** — when a matched effect's own `amount` is a
// non-literal `Computed<number>` closure, this recognizer ALSO runs
// `runtime-dependency-probe.ts`'s `probeComputedNumber` (promoted the same
// day, same pass, out of its own former `.prototype.ts` status) against it
// and, when classified into one of the small, closed
// `BUCKET_TO_SINK` buckets below, emits the paired "wants X present" SINK
// fact this pool's own `mirroredPresenceSinks`-style convention already
// establishes elsewhere (`scripts/prototype-3tier-reconstruct-fin1-10.mjs`'s
// own throwaway exploration first proved this concrete pairing for Summon:
// Bahamut's own chapter IV — "scales with permanents you control" ->
// `{to:'Battlefield', controller:'you'}` — before this recognizer made it
// real). Reuses the SAME annotation span as the paired source `damage`
// fact (the whole "deals ... damage to each opponent" clause IS the real
// textual anchor for both — there is no separate, narrower span for "what
// this scales with", since the closure itself is never visible in the
// printed text at all).
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';
import { probeComputedNumber } from './runtime-dependency-probe';

const RULE = 'dealDamage-effect-structural' as const;

// Re-exported for this recognizer's own test file, same convention
// `destroy-effect-structural.ts`/`drawCard-effect-structural.ts` already
// establish.
export type { StructuralRecognizerInput };

type DealDamageEffect = Extract<Effect, { kind: 'dealDamage' }>;

function isDealDamageEffect(e: Effect): e is DealDamageEffect {
  return e.kind === 'dealDamage';
}

const PERMANENT_TYPE_WORDS = ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle'];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Same self-referential-subject alternation `dies-trigger-structural.ts`'s
 * own copy already establishes ("this <permanent type>"/"this permanent"/
 * the card's own printed name, or its short pre-comma form) — deliberately
 * excludes bare "it" for the identical reason that file's own doc comment
 * gives (too ambiguous a pronoun to anchor on safely).
 *
 * **Widening added 2026-09-16** (`verify-text-coverage.mjs` flagged the
 * subject clause itself — e.g. Summon: Bahamut's own "This creature" —
 * as sitting just OUTSIDE this recognizer's own annotation, immediately
 * before "deals"): the subject is who's doing the damage, squarely part of
 * what the `damage` Fact claims, not flavor — see the module doc comment's
 * own real, whole-pool subject check. Real, confirmed forms actually
 * printed for this recognizer's own 7 `kind:'dealDamage'` cases: Black
 * Waltz No. 3's own full printed name ("Black Waltz No. 3 deals..."),
 * Joshua's back face's own short pre-comma form ("Phoenix deals...", full
 * printed name is "Phoenix, Warden of Fire"), Sabotender's/Summon:
 * Bahamut's own "this creature"/"This creature" (case differs only by
 * sentence position, both real). Vivi Ornitier and The Emperor of
 * Palamecia's back face both use bare "it" instead — genuinely NOT covered
 * by this alternation, same as every other copy of this helper in the
 * pool; their own annotations correctly keep starting at "deals" rather
 * than reaching for a pronoun no other recognizer treats as a safe anchor
 * either (and neither is flagged by `verify-text-coverage.mjs` at all,
 * confirming this is a real, not just theoretical, non-issue for them). */
function selfSubjectAlternation(name: string): string {
  const typeAlt = PERMANENT_TYPE_WORDS.map((w) => `this ${w.toLowerCase()}`).join('|');
  const shortName = name.split(',')[0]!.trim();
  const nameAlt = shortName !== name ? `${escapeRegExp(name)}|${escapeRegExp(shortName)}` : escapeRegExp(name);
  return `(?:${typeAlt}|this permanent|${nameAlt})`;
}

/** Same clause-shape for every real card checked (see module doc comment)
 * — deliberately NOT anchored on the amount's own text (see above), and
 * deliberately NOT requiring a trailing clause boundary after "opponent"
 * (the phrase's own trailing `\b` already stops it from matching into the
 * middle of a longer word; anything printed after that boundary is out of
 * scope for what this Fact claims either way).
 *
 * The leading subject group is OPTIONAL and non-capturing — when a
 * recognized subject form (see `selfSubjectAlternation`) sits immediately
 * (only whitespace between) before "deals", the match — and so the
 * annotation — starts there instead of at "deals" itself; when it doesn't
 * (a bare "it", or no subject text adjacent at all), the match still
 * starts at "deals" exactly as before this widening. A chapter-numeral/
 * ability-name label before the subject (Summon: Bahamut's own "IV — Mega
 * Flare — ") is deliberately NOT reached for — `destroy-effect-structural`'s
 * own chapters I/II on this same card, and `drawCard-effect-structural`'s
 * own chapter III, already leave that same label uncovered; no recognizer
 * in this pool covers it, so this one doesn't invent a new convention to
 * do so either. */
function clausePattern(name: string): RegExp {
  const subject = selfSubjectAlternation(name);
  return new RegExp(`(?:\\b${subject}\\s+)?\\bdeals\\b[^\\n]*?\\bdamage\\b[^\\n]*?\\bto each opponent\\b`, 'i');
}

/** Small, closed bucket->sink map — same real, checked shape
 * `scripts/prototype-3tier-reconstruct-fin1-10.mjs`'s own throwaway
 * `BUCKET_TO_SINK` already established for this exact tier-2 pairing.
 * Grow only when a real card's own classified bucket needs a new entry —
 * `runtime-dependency-probe.ts`'s own `ROOTS` table is itself deliberately
 * small/closed for the identical reason. */
const BUCKET_TO_SINK: Record<string, { to: 'Battlefield'; controller: 'you'; types?: { has: string[] } }> = {
  'permanents you control': { to: 'Battlefield', controller: 'you' },
  'creatures you control': { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] } },
  'lands you control': { to: 'Battlefield', controller: 'you', types: { has: ['Land'] } },
};

/**
 * Reads one face's own structured `Effect[]` directly (never this face's own
 * oracle text, except to ANCHOR the derived fact's annotation), same
 * all-or-nothing-per-face discipline `destroy-effect-structural.ts` already
 * establishes: zero `dealDamage` effects on this face declines with that
 * reason; one or more, but ANY unresolvable (an `EffectOwner` other than
 * `'opponents'` — no other value has a confirmed real Fact shape yet — or a
 * clause that doesn't verbatim-match) declines the WHOLE face rather than
 * partially claiming only the resolvable ones.
 */
export function recognizeDealDamageEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const effects = allEffects(input).map((o) => o.effect).filter(isDealDamageEffect);
  if (effects.length === 0) {
    return { matched: false, reason: 'no kind:"dealDamage" Effect on this face' };
  }
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // which `Trigger.name` (if any) this face's own container walk found this
  // effect inside; `undefined` for a top-level/ability effect (see
  // `structural-effects.ts`'s own `triggeredByOf` doc comment).
  const effectSource = effectSourceMap(input);

  const facts: RecognizedFact[] = [];

  for (const effect of effects) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    if (effect.target !== 'opponents') {
      return {
        matched: false,
        reason: `a dealDamage effect on this face has target:${JSON.stringify(effect.target)} — only "opponents" has a confirmed real Fact shape in the pool`,
      };
    }

    const pattern = clausePattern(input.name);
    const global = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(global)];
    if (matches.length === 0) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ not found (verbatim) in oracle text "${input.oracleText}"`,
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
      fact: { event: 'damage', controller: 'you', recipient: 'opp', targeted: false, annotations: [annotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });

    if (typeof effect.amount === 'function') {
      const result = probeComputedNumber(effect.amount);
      if (result.classified) {
        const bucketKey = result.tag.replace(/^scales with /, '');
        const sink = BUCKET_TO_SINK[bucketKey];
        if (sink) {
          facts.push({
            role: 'sink',
            fact: { ...sink, annotations: [annotation] },
            provenance: { origin: 'parser', rule: RULE },
          });
        }
        // An unrecognized bucket (e.g. "cards in your graveyard", The
        // Emperor of Palamecia's own real Starfall closure) is a real,
        // honest tier-2 non-match — no sink asserted, same "grow only when
        // forced" restraint `BUCKET_TO_SINK` itself documents. Not an error;
        // the SOURCE `damage` fact above is still asserted regardless.
      }
      // A probe decline (crash, non-numeric, no recognized collection root)
      // is likewise not an error for this recognizer as a whole — it only
      // means no tier-2 sink is derivable, never that the SOURCE fact above
      // should be withheld.
    }
  }

  return { matched: true, facts };
}
