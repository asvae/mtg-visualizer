// New recognizer (2026-09-14, fact-parity pass — Aerith Gainsborough's own
// remaining unprovenanced SOURCE fact) — structural, same family as
// `putCounterTarget-effect-structural.ts`/`putCounter-broadcast-structural.ts`:
// reads a `kind:'putCounter'` `Effect` (the ALWAYS-self-target variant —
// `card.ts` line ~508: `{ kind: 'putCounter'; target: 'self'; counterType:
// string; amount: Computed<number> }`, structurally distinct from
// `putCounterTarget`'s own chosen-object shape) straight off `CardDefinition`
// (`structural-effects.ts`'s shared `allEffects` walker, which already
// recurses into `modal` modes for free), then requires a built clause to
// appear verbatim in this face's own real oracle text before asserting
// anything.
//
// **Real, whole-pool check done first**: grepped every real `kind:
// 'putCounter'` `Effect` (the self-target variant — `kind:'putCounterTarget'`
// is a DIFFERENT effect kind, already covered by its own recognizer) across
// `functional-model/cards/*/definition.ts` — 19 real occurrences, 18 distinct
// cards (`vincent-valentine-galian-beast`'s own FRONT face carries one; its
// back face, Galian Beast, has an unrelated `custom` onDies effect, no
// putCounter at all) — checked individually against each face's own real
// Scryfall oracle text:
//   - **Matched real clean templates** ("put <anything> <counterType>
//     counter(s) on <self-subject>", self-subject being either this face's
//     own printed name/short-name-before-a-comma, same
//     `dies-trigger-structural.ts`-established alternation reused here
//     verbatim, or a fixed permanent-supertype word — "this creature"/"this
//     artifact"/etc.): Aerith Gainsborough ("on Aerith Gainsborough"), Blazing
//     Bomb ("on this creature"), Demon Wall ("on this creature"), Judge
//     Magister Gabranth ("on Judge Magister Gabranth"), Excalibur II ("on
//     Excalibur II" — counterType `'CHARGE'` vs. printed "charge," matched
//     case-insensitively same as every other recognizer in this catalog),
//     Quina, Qu Gourmet ("on Quina" — short name), Sephiroth, Planet's Heir
//     ("on Sephiroth" — short name), Sahagin ("on this creature"), Zodiark,
//     Umbral God ("on Zodiark" — short name), Sazh's Chocobo ("on this
//     creature" — the printed name itself has an apostrophe, not a comma, so
//     only the type-word alternation matches here, not a short name), Seymour
//     Flux ("on Seymour Flux"), Tidus, Blitzball Star ("on Tidus" — short
//     name), Ultros, Obnoxious Octopus ("on Ultros" — short name; this card's
//     OWN OTHER "tap target creature ... put a stun counter on it" clause,
//     `counterType:'stun'`, is a genuinely different chosen-target effect
//     this recognizer never sees at all), Vincent Valentine (front face —
//     "put a number of +1/+1 counters on Vincent Valentine equal to that
//     creature's power" — `amount` here is a `Computed<number>` CLOSURE, not
//     a literal number; this recognizer's own Fact carries no magnitude at
//     all (same "nothing to lose by not pinning the quantifier word down"
//     reasoning `putCounter-broadcast-structural.ts`'s own doc comment
//     already gives for a different Effect kind), so a non-literal amount is
//     genuinely irrelevant to whether the literal clause matches — matches
//     cleanly), Vivi Ornitier ("on Vivi Ornitier").
//   - **Genuine `'mismatch'` declines, real, confirmed model approximations
//     — a DIFFERENT real English idiom for the identical underlying game
//     effect (an ETB/return-to-battlefield modifier clause, "enters/returns
//     ... with a counter on it," never the verb "put" at all), each needing
//     its own `// recognizer-exception:` marker (none of these 3 cards had
//     one for this brand-new rule id before this pass — added directly to
//     each one's own `definition.ts`, same convention `the-earth-crystal`'s
//     own pre-existing marker for `putCounterTarget-effect-structural`
//     already established)**:
//     - **Zack Fair** — "Zack Fair enters with a +1/+1 counter on it." — no
//       "put" verb at all; this card's OWN LATER "Put Zack Fair's counters on
//       that creature" sentence (a genuinely different action — relocating
//       EXISTING counters onto a chosen OTHER creature, not adding a new one
//       to self) never contains the literal counterType substring `+1/+1`
//       either, so it correctly never accidentally matches.
//     - **Tonberry** — "This creature enters tapped with a stun counter on
//       it." — same idiom, no "put" verb anywhere near "stun" in this card's
//       own text.
//     - **Relentless X-ATM092** — "Return this card from your graveyard to
//       the battlefield tapped with a finality counter on it." — same idiom
//       again, applied to a return-from-graveyard clause instead of a plain
//       ETB.
//   - **Structurally OUT OF SCOPE, no card needs this yet but kept for
//     symmetry with `putCounterTarget-effect-structural.ts`'s own identical
//     gate**: a literal non-positive `amount` (a REMOVAL, not an addition —
//     no real pool card's own self-target `putCounter` effect has one today).
//   - **Real, deliberate, narrower-vocabulary decline, NOT force-fit**:
//     **Phantom Train** — "Sacrifice another artifact or creature: Put a
//     +1/+1 counter on this Vehicle." — genuinely has the "put ... counter
//     on" verb shape, but its own self-subject is "this Vehicle" (a printed
//     SUBTYPE, not this card's own name NOR any of the fixed permanent-
//     supertype words `dies-trigger-structural.ts`'s own
//     `PERMANENT_TYPE_WORDS` list already establishes — this card's printed
//     typeLine is `Artifact — Vehicle`, so "this artifact" is the only
//     supertype-word alternative available, and the real text doesn't say
//     that). Deliberately NOT widened to also try "this <printed subtype>"
//     for this one card — that would be a brand-new, unvetted piece of
//     self-subject vocabulary invented for a single real card, the same kind
//     of guess this whole catalog is built to avoid; needs its own
//     `// recognizer-exception:` marker instead, same as the 3 ETB-idiom
//     cards above.
import type { CardDefinition, Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

const RULE = 'putCounterSelf-effect-structural' as const;

export type { StructuralRecognizerInput };

type PutCounterSelfEffect = Extract<Effect, { kind: 'putCounter' }>;

function isPutCounterSelfEffect(e: Effect): e is PutCounterSelfEffect {
  return e.kind === 'putCounter';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Same self-referential-subject vocabulary `dies-trigger-structural.ts`
 * already established and vetted (this card's own printed name, its short
 * form before a first comma if different, or a fixed permanent-supertype
 * word — "this creature"/"this artifact"/"this enchantment"/"this
 * planeswalker"/"this battle"/"this permanent") — duplicated here (not
 * imported) per this catalog's own established convention of each recognizer
 * file keeping its own small regex helpers rather than sharing a module for
 * this narrow a piece of logic (see `structural-effects.ts`'s own doc
 * comment on why ONLY the container-walking helpers were ever worth
 * factoring out). Deliberately does NOT invent any new vocabulary (e.g. a
 * printed SUBTYPE like "this Vehicle") — see this file's own module doc
 * comment for the one real card (Phantom Train) that needs exactly that and
 * is deliberately declined instead. */
const PERMANENT_TYPE_WORDS = ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle'];

function selfSubjectAlternation(name: string): string {
  const typeAlt = PERMANENT_TYPE_WORDS.map((w) => `this ${w.toLowerCase()}`).join('|');
  const shortName = name.split(',')[0]!.trim();
  const nameAlt = shortName !== name ? `${escapeRegExp(name)}|${escapeRegExp(shortName)}` : escapeRegExp(name);
  return `(?:${typeAlt}|this permanent|${nameAlt})`;
}

/** "put <anything> <counterType> counter(s) on <self-subject>" — the
 * quantity phrase between "put" and the counterType (a literal number,
 * "a"/"an", "X," or Vincent Valentine's own 3-word "a number of") is never
 * anchored to a specific word — same reasoning `putCounter-broadcast-
 * structural.ts`'s own doc comment gives for a different Effect kind: this
 * Fact carries no magnitude at all, so there's nothing to lose by not
 * pinning it down (and a genuinely variable, `Computed<number>`-shaped
 * `amount`, like Vincent Valentine's own "equal to that creature's power,"
 * has no fixed literal word to anchor to in the first place). "counter(s)"
 * and "on" are required IMMEDIATELY adjacent (whitespace only), and so is
 * the counterType and "counter(s)" itself — every real matched card in this
 * file's own whole-pool review has both pairs directly adjacent, never a
 * modifier in between.
 *
 * **The quantity-phrase gap is BOUNDED (at most 5 whitespace-separated
 * tokens), not an unbounded `[^\n]*?` — a real, confirmed bug fix, not just
 * stylistic tightening.** An unbounded gap let Aerith Gainsborough's own
 * SAME oracle-text line, which prints the literal counterType `+1/+1` TWICE
 * in one sentence ("put X +1/+1 counters on each legendary creature you
 * control, where X is the number of +1/+1 counters on Aerith Gainsborough"),
 * produce a SECOND, spurious match: the regex correctly failed to complete
 * at the FIRST `+1/+1` (immediately followed by "counters on each legendary
 * creature," not a recognized self-subject), but an unbounded gap let it
 * keep backtracking forward past that failure, skip the entire first clause,
 * and re-anchor on the SECOND, unrelated `+1/+1` occurrence near the end of
 * the same sentence — which IS immediately followed by "counters on Aerith
 * Gainsborough," producing a bogus long-spanning match alongside the real,
 * correct line-1 match and a false "matched 2 times — ambiguous" decline.
 * Bounding the quantity-phrase gap at 5 tokens (comfortably above every real
 * quantity phrase this file's own whole-pool review found — 1 word in every
 * case but Vincent Valentine's 3-word "a number of") makes that cross-clause
 * skip impossible (the real gap between the two `+1/+1` occurrences on
 * Aerith's own line is roughly 14 tokens) while losing no real coverage. */
function buildPattern(counterType: string, subjectAlt: string): RegExp {
  const ct = escapeRegExp(counterType);
  return new RegExp(`\\bput\\b(?:\\s+\\S+){0,5}?\\s+${ct}\\s+counters?\\s+on\\s+${subjectAlt}\\b`, 'i');
}

/** Structural scope gate — see module doc comment's own "Structurally OUT OF
 * SCOPE" section. Mirrors `putCounterTarget-effect-structural.ts`'s own
 * identical check; kept for symmetry even though no real pool card hits it
 * today (a self-target `putCounter` REMOVING a counter would need a
 * different, negative-amount `Effect`, not this recognizer's own asserted
 * ADD claim). */
function isEligible(effect: PutCounterSelfEffect): { ok: true } | { ok: false; reason: string } {
  if (typeof effect.amount === 'number' && effect.amount <= 0) {
    return { ok: false, reason: `amount ${effect.amount} is non-positive — a putCounter Fact only ever claims counters being ADDED, not removed` };
  }
  return { ok: true };
}

export function recognizePutCounterSelfEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const candidates = allEffects(input).filter(isPutCounterSelfEffect);
  if (candidates.length === 0) {
    return { matched: false, reason: 'no kind:"putCounter" (self-target) Effect on this face' };
  }

  const subjectAlt = selfSubjectAlternation(input.name);
  const facts: RecognizedFact[] = [];
  let anyEligible = false;

  for (const effect of candidates) {
    const eligibility = isEligible(effect);
    if (!eligibility.ok) continue; // structurally out of scope — see module doc comment; never a 'mismatch'
    anyEligible = true;

    const pattern = buildPattern(effect.counterType, subjectAlt);
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
      fact: { event: 'putCounter', counterType: effect.counterType, target: 'self', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  if (!anyEligible) {
    return { matched: false, reason: 'every kind:"putCounter" (self-target) Effect on this face was structurally out of scope (non-positive amount)' };
  }
  return { matched: true, facts };
}

// Re-exported purely so this file's own `.test.ts` (and any future caller)
// can build a `StructuralRecognizerInput` the same way every sibling
// recognizer's own test does, without a second import of `CardDefinition`
// just for that.
export type { CardDefinition };
