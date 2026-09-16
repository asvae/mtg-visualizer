// New recognizer (2026-09-15, `feedback_facts_must_be_recognizer_derived`
// follow-up — Aerith Rescue Mission's "Hero token ETB"/Battle Menu's "Knight
// token ETB" facts, both previously AI-authored with no `provenance`).
// Structural (`definition.ts`-based, not Forge-script-matching — same
// family as `destroy-effect-structural.ts`/`drawCard-effect-structural.ts`):
// reads a `kind:'createToken'` `Effect` directly and derives the real,
// unavoidable CR 111.7 consequence every token creation has — the token
// itself entering the battlefield — as an `event:'entersBattlefield'`
// SOURCE fact, `controller:'you'` (real, unconditional: `card.ts`'s own
// `case 'createToken'` always calls `actions.createToken(ctx.you, ...)`, no
// owner variant exists on this Effect kind at all).
//
// **The real, closed general rule** (checked against the whole pool's 34
// real `kind:'createToken'` occurrences, 2026-09-15): a token's own real
// printed clause is always some variant of "create <quantifier>[, <name>][
// tapped] [<P>/<T> ][<adjectives> ]<subtype-noun> [creature ]token(s)" — this
// recognizer builds a per-effect regex from the effect's OWN structured
// `amount`/`token`/`tapped` fields (never guessing at unmodeled fields —
// color, in particular, is NOT tracked anywhere on `TokenInfo`/`RealCard`,
// so this recognizer never asserts a color word) and tolerates every
// intervening real adjective/qualifier word (color, "legendary," "tapped")
// via non-greedy same-sentence gaps rather than trying to enumerate them —
// same "verify a real closed anchor, tolerate everything unconfirmed in
// between" discipline `move-effect-structural.ts`'s own `optional`/`notSelf`
// handling already established.
//
// **`amount: Computed<number>` — one real closed template added 2026-09-16
// (recognizer-lane task, `feedback_no_magic_strings_abilities`/task-pushback
// follow-up: this was previously a blanket permanent decline for EVERY
// non-literal amount; re-litigated per-card against real oracle text
// instead of accepted as-is)**: Magic's own real templating language has a
// genuine literal quantifier phrase for "however many of a type you
// control, make one token PER" — "For each <type> you control, create
// <a|an> ... token" (Moogles' Valor's own real printed clause, confirmed
// via `forge-lookup.mjs`: `SVar:X:Count$Valid Creature.YouCtrl`, `TokenAmount$
// X`). This recognizer never introspects the closure itself (opaque, same
// as every other `Computed` field this pool's structural recognizers
// already decline to peek inside — see `ptFormula-scalingPump-structural
// .ts`'s own `addPerEquipmentControlled` branch for the same "read the
// printed English, not the runtime closure" discipline); it gates on the
// literal, real anchor phrase `/\bfor each\b[^.,]*\byou control\b\s*,\s*
// create\b/i` being present in the SAME sentence as the token's own
// structural identity (subtype noun/P-T/tapped, same suffix the
// literal-number branch already requires) before asserting anything —
// **checked against the real, NAMED remaining pool below, not a blanket
// "non-literal declines" bucket**:
//   - `moogles-valor` — the one real, confirmed MATCH for this template
//     (2026-09-16).
//   - `rufus-shinra` — genuinely NOT this shape: "if you don't control a
//     creature named Darkstar, create Darkstar..." is a NAMED-creature
//     PRESENCE check (0-or-1, no "for each" scaling at all), confirmed via
//     `forge-lookup.mjs` (`IsPresent$ Creature.YouCtrl+namedDarkstar |
//     PresentCompare$ EQ0`). Would decline this amount-anchor check too (no
//     "for each" anywhere in the printed text) — but in practice declines
//     one check earlier, via the inline-`TokenInfo`/no-`TOKENS`-registry
//     reason below (Darkstar's own token is a one-off literal, not a
//     registry reference).
//   - `the-final-days` — genuinely NOT this shape either: "Create two
//     tapped 2/2 black Horror creature tokens. If this spell was cast from a
//     graveyard, instead create X of those tokens, where X is the number of
//     creature cards in your graveyard." is a two-branch CONDITIONAL (a
//     fixed "two" normally, a "where X is the number of..." replacement only
//     when cast from graveyard) — no "for each ... you control" phrase
//     anywhere. This one IS a `TOKENS` registry token, so it genuinely
//     reaches (and correctly fails) this amount-anchor check.
//   - `the-wandering-minstrel` — genuinely NOT this shape either: "if you
//     control five or more Towns, create a 2/2 Elemental creature token" is
//     a THRESHOLD gate (0-or-1, same family as `ptFormula-scalingPump-
//     structural.ts`'s own `thresholdBonus` branch), not a per-instance
//     "for each" scaling count. Same as rufus-shinra: would decline this
//     check too, but in practice declines one check earlier (its Elemental
//     token is also an inline literal, no registry id).
//   All three re-verified directly against real Forge script text
//   (2026-09-16), not assumed from this comment's own prior characterization
//   — the prior version of this comment lumped all 4 under one blanket
//   "non-literal amount, no template" reason; that was accurate as a
//   decline VERDICT for 3 of the 4 but imprecise about WHY, and simply wrong
//   that no template could ever exist for the 4th.
//
// **Still exactly 1 SOURCE fact per matching effect, even for this new
// branch — no paired sink** (matches this recognizer's own single-fact
// convention for every other one of its 17 pre-existing real matches,
// checked directly before writing this branch; also matches
// `continuousPTGrantsEquipped-structural.ts`'s own `scalePerType`/
// `scalePerSelfCounter` branches, the more directly analogous "widen an
// existing structural-Effect recognizer to also cover a board-count-scaled
// version of the same claim" precedent — NOT `ptFormula-scalingPump-
// structural.ts`'s own 2-fact source+sink convention, which is a
// DIFFERENT real claim family: a self-pump CDA mirroring a card's own
// pre-existing hand-authored pair, not a token-creation ETB fact at all).
// The counted type itself is deliberately never asserted as a `Fact` claim
// (unlike `ptFormula`'s sink) — it's never available structurally (buried
// inside an opaque closure), only confirmed to be PRESENT as a literal
// quantifier phrase in the anchor text.
//
//   - **`effect.token` is not a `TOKENS.<key>` registry reference** — this
//     recognizer resolves the derived fact's `subject: {token: '<id>'}`
//     via REVERSE lookup against `tokens.ts`'s own shared `TOKENS` registry
//     (the only real, confirmed source of a token's own canonical id
//     string this pool has); an INLINE `TokenInfo` object literal (no
//     registry key) has no such id available, and this recognizer will
//     never invent one — real color IS part of several real cards' own
//     canonical Forge `TokenScript$` ids (`b_0_1_wizard_snipe`, per several
//     of these cards' own `definition.ts` comments), but color is not
//     tracked anywhere in this structural data, so no deterministic id can
//     be derived from the `Effect` alone. Confirmed real cases: `call-the-
//     mountain-chocobo`, `choco-comet`, `circle-of-power`, `cornered-by-
//     black-mages`, `gysahl-greens`, `kuja-genome-sorcerer-trance-kuja-
//     fate-defied`, `lindblum-industrial-regency-mage-siege`, `mysidian-
//     elder`, `queen-brahne`, `rinoa-heartilly`, `sidequest-raise-a-
//     chocobo-black-chocobo`, `summon-fat-chocobo`, `chocobo-racetrack` —
//     every one of these already has its own `definition.ts` comment
//     independently confirming the same "not in TOKENS, built inline"
//     reason, not a new finding this recognizer invented.
//
// **All-or-nothing per face, not per-effect** — same simplification
// `destroy-effect-structural.ts`/`move-effect-structural.ts` both make: a
// face with 2+ `createToken` effects (a Saga's chapters, e.g. `summon-
// knights-of-round`'s own 4 identical chapters) where ANY one can't resolve
// declines the whole face.
//
// **No exclusive-consumption line-claiming** (deliberately DIFFERENT from
// `move-effect-structural.ts`'s own `claimedLines` set) — a Saga's own
// repeated chapters (`summon-knights-of-round`) legitimately share the
// exact SAME printed clause/line across 4 structural effects; each one
// independently searches the WHOLE oracle text for its own pattern (real
// precedent: `dion-bahamut-s-dominant-bahamut-warden-of-light`'s own single
// real hand-authored fact already confirms 4 structurally-identical chapter
// effects collapse to exactly 1 real fact — `apply-recognizers.mjs`'s own
// shared runner-level `mergeRecognizedFactsByIdentity` pass does that
// collapsing, not this recognizer).
//
// **Real, whole-pool check confirming exactly 18 real matches** (2026-09-16,
// was 17 as of 2026-09-15 — `moogles-valor` added by the "for each ... you
// control" branch above): `aerith-rescue-mission`, `ancient-adamantoise`,
// `battle-menu`, `dion-bahamut-s-dominant-bahamut-warden-of-light` (front
// face), `dragoon-s-wyvern`, `dwarven-castle-guard`, `magic-pot`,
// `magitek-armor`, `moogles-valor`, `namazu-trader`, `prompto-argentum`,
// `sidequest-hunt-the-mark-yiazmat-ultimate-mark`, `summon-knights-of-round`,
// `tellah-great-sage`, `the-crystal-s-chosen`, `thranduil-sindarin-liege-
// silvan-rally`, `undercity-dire-rat`, `zidane-tantalus-thief` — re-check
// this comment if a future card changes that count.
import type { Effect } from '../card';
import { TOKENS } from '../tokens';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'token-creation-structural' as const;

type CreateTokenEffect = Extract<Effect, { kind: 'createToken' }>;

function isCreateTokenEffect(e: Effect): e is CreateTokenEffect {
  return e.kind === 'createToken';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The real, canonical Forge token id this effect's own `token` object
 * resolves to — reverse lookup against `tokens.ts`'s own shared `TOKENS`
 * registry by REFERENCE (every real registry-backed card literally writes
 * `token: TOKENS.<key>`, the same object, never a structural copy), never
 * derived from the object's own fields (see module doc comment: color, part
 * of several real cards' own canonical id, isn't tracked here at all).
 * `undefined` for an inline `TokenInfo` literal with no matching registry
 * entry. */
function registryIdFor(token: CreateTokenEffect['token']): string | undefined {
  return Object.entries(TOKENS).find(([, v]) => v === token)?.[0];
}

/** Real, literal anchor confirming the one confirmed "for each <type> you
 * control, create ..." per-instance quantifier template — see module doc
 * comment for the full real-pool citation (why this is narrowly gated to
 * this exact run of words, not a bare "for each" scan, and why the 3 other
 * real non-literal-amount cards in the pool correctly fail this check). */
const FOR_EACH_YOU_CONTROL_CREATE = /\bfor each\b[^.,]*\byou control\b\s*,\s*create\b/i;

/** The real, closed regex this effect's own structured data implies — see
 * module doc comment for the full rule and the real decline reasons.
 * `undefined` when `amount` is a literal number outside 0-10 (no real card
 * in this pool needs a quantity above ten), or a non-literal `Computed`
 * amount whose own face's oracle text doesn't carry the one confirmed
 * "for each ... you control, create" anchor (see module doc comment: this
 * is a real, deliberate per-card gate, not a guess). */
function buildExpectedPattern(effect: CreateTokenEffect, oracleText: string): RegExp | undefined {
  const token = effect.token;
  const isCreature = token.types.includes('Creature');
  const subtypeWords = token.types.filter((t) => t !== 'Legendary' && t !== 'Creature' && t !== 'Artifact');
  const noun = subtypeWords[subtypeWords.length - 1] ?? token.name;
  // A named Legendary token (Rinoa Heartilly's own "create Angelo, a
  // legendary 1/1 ... Dog creature token") prints its own proper name
  // BEFORE the generic quantifier phrase — tolerated as an optional prefix,
  // never required, since most tokens in this pool have no such name.
  const namePrefix = token.types.includes('Legendary') ? `(?:${escapeRegExp(token.name)}, )?` : '';

  let quantifierPart: string;
  if (typeof effect.amount === 'number') {
    const qtyWord = effect.amount === 1 ? '(?:a|an|one)' : NUMBER_WORDS[effect.amount];
    if (!qtyWord) return undefined;
    quantifierPart = `\\bcreate ${namePrefix}${qtyWord}\\b`;
  } else {
    // Non-literal `Computed<number>` amount (a closure, opaque to this
    // recognizer — see module doc comment). Only the one real confirmed
    // "for each <type> you control, create a/an ..." per-instance template
    // qualifies; gate on that literal generic anchor being present in this
    // face's own oracle text BEFORE building anything stricter, so every
    // OTHER real non-literal-amount shape in the pool (rufus-shinra's
    // named-creature presence check, the-final-days's cast-from-graveyard
    // conditional count, the-wandering-minstrel's controlled-permanent-count
    // threshold gate — none of which contain this phrase) still declines
    // silently (`scope`) rather than forcing a `mismatch` hard-fail.
    if (!FOR_EACH_YOU_CONTROL_CREATE.test(oracleText)) return undefined;
    quantifierPart = `\\bfor each [^.,]+ you control,\\s*create ${namePrefix}(?:a|an)\\b`;
  }

  const parts = [quantifierPart];
  if (isCreature) parts.push(`[^.]*?${escapeRegExp(String(token.basePower))}\\/${escapeRegExp(String(token.baseToughness))}`);
  parts.push(`[^.]*?\\b${escapeRegExp(noun)}s?\\b`);
  parts.push(`[^.]*?\\btokens?\\b`);
  return new RegExp(parts.join(''), 'i');
}

export function recognizeTokenCreationStructural(input: StructuralRecognizerInput): RecognizerResult {
  const effects = allEffects(input).map((o) => o.effect).filter(isCreateTokenEffect);
  if (effects.length === 0) {
    return { matched: false, reason: "no kind:'createToken' Effect on this face" };
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);
  for (const effect of effects) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    const tokenId = registryIdFor(effect.token);
    if (!tokenId) {
      return {
        matched: false,
        reason: `this face's own createToken effect uses an inline TokenInfo literal (${JSON.stringify(effect.token)}) with no matching TOKENS registry entry — no canonical id derivable (see module doc comment: color isn't tracked structurally)`,
      };
    }
    const pattern = buildExpectedPattern(effect, input.oracleText);
    if (!pattern) {
      return {
        matched: false,
        reason: `a createToken effect on this face (${JSON.stringify(effect)}) has a non-literal or unconfirmed amount, and this face's own oracle text has no confirmed "for each ... you control, create" anchor either — no real quantifier template to verify (see module doc comment)`,
      };
    }
    const m = pattern.exec(input.oracleText);
    if (!m) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected pattern /${pattern.source}/ not found in oracle text "${input.oracleText}"`,
      };
    }
    const start = m.index;
    const end = m.index + m[0].length;
    const annotation = toLineOffset(input.oracleText, start, end);
    if (!annotation) {
      return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
    }
    facts.push({
      role: 'source',
      fact: { event: 'entersBattlefield', to: 'Battlefield', controller: 'you', subject: { token: tokenId }, annotations: [annotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
