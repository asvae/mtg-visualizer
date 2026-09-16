// New recognizer (2026-09-14, fact-parity pass — ENGINE_GAPS.md's own
// "Counter-conditional continuous effects" closure, Ultima, Origin of
// Oblivion's own `onAttack` trigger) — structural, same family as
// `destroy-effect-structural.ts`/`dealDamage-effect-structural.ts`: reads a
// `kind:'putCounterTarget'` `Effect` straight off `CardDefinition`
// (`structural-effects.ts`'s shared `collectEffects` walker), then requires a
// built clause to appear verbatim in this face's own real oracle text before
// asserting anything.
//
// Genuinely different fact shape from `putCounter-broadcast-structural.ts`'s
// own (unconditional, unchosen "each X you control") — this is CR 601.2c
// TARGETED counter placement, `targeted: true`, on a CHOSEN object, never
// `target: 'self'`.
//
// **Real, whole-pool check done first** (same discipline every recognizer in
// this catalog already uses) — grepped every real `kind:'putCounterTarget'`
// `Effect` across `functional-model/cards/*/definition.ts` (15 real
// occurrences, 13 distinct cards, checked individually against each face's
// own real Scryfall oracle text):
//   - **In scope, matched real clean templates** (this recognizer's own
//     confirmed shape — "put <qty> <counterType> counter(s) on target
//     <typeWord>", regardless of what sits between "on" and "target" —
//     "up to one," nothing at all): Cloudbound Moogle ("put a +1/+1 counter
//     on target creature"), Combat Tutorial ("Put a +1/+1 counter on up to
//     one target creature you control"), Ultima, Origin of Oblivion ("put a
//     blight counter on target land"), Ride the Shoopuf ("put a +1/+1
//     counter on target creature you control"), Rosa, Resolute White Mage
//     ("put a +1/+1 counter on target creature you control"), Prishe's
//     Wanderings ("put a +1/+1 counter on target creature you control"),
//     Clash of the Eikons's own "Put a lore counter on target Saga you
//     control" mode (`validType: 'any'` — no confirmed English typeWord
//     template for "Saga" exists on this `validType` union at all, so this
//     shape omits the typeWord requirement entirely rather than guessing
//     one, see `buildPattern` below).
//   - **Structurally OUT OF SCOPE (declined at the SCOPE stage, before any
//     regex is even built — never reaches 'mismatch')**:
//     - **A literal non-positive `amount`** (Clash of the Eikons's OWN
//       "Remove a lore counter" mode, `amount: -1`) — a `putCounter` Fact
//       claims counters being ADDED; a negative delta is a genuinely
//       different real action (`DB$ RemoveCounter` in Forge, not
//       `DB$ PutCounter`), not something this Fact shape can honestly
//       represent.
//     - **`validType: 'creature-or-artifact'`** (Omega, Heartless
//       Evolution) — same restraint `putCounter-broadcast-structural.ts`'s
//       own "no confirmed multi-adjective English template" already
//       establishes for a disjunctive type word: no real pool card's own
//       printed text is confirmed to read "creature or artifact" for this
//       specific `validType` (Omega's own real text is "nonland permanent,"
//       a DIFFERENT, unconfirmed disjunction entirely — see its own
//       definition.ts comment).
//     - **Immediately preceded by a `kind:'tapTarget'` effect in the SAME
//       container** — **CLOSED 2026-09-16** (recognizer-lane escalation,
//       card-results-lane triage) — see the new "Pronoun-carryover" section
//       below.
//   - **Genuine `'mismatch'` declines, real, confirmed model approximations,
//     each carrying its own `// recognizer-exception:` marker** (both
//     already-documented in their own definition.ts comments before this
//     recognizer existed, not discovered by it):
//     - **The Earth Crystal** — real printed text is "Distribute two +1/+1
//       counters among one or two target creatures you control," never
//       "put ... counter on target" at all (`DividedAsYouChoose$2`, no
//       `putCounterTarget`-shaped Effect kind can honestly express a shared
//       pool divided across a player-chosen target COUNT).
//     - **Torgal, A Fine Hound** — real printed text is "...that creature
//       enters with an additional +1/+1 counter on it for each Dog and/or
//       Wolf you control," no "target"/"put" at all (the counter lands on
//       "that creature," a trigger-input reference this model has no way to
//       address except by (ab)using `putCounterTarget`'s own targeting
//       machinery — see that card's own definition.ts comment).
//
// **Pronoun-carryover branch (2026-09-16, recognizer-lane escalation)** —
// real, whole-pool-checked shape (3 cards, all checked directly): a
// `putCounterTarget` effect immediately preceded, in the SAME container, by
// a `kind:'tapTarget'` effect whose own chosen object the counter placement
// then refers back to via a bare pronoun, NOT a fresh "target <noun>"
// clause — Ice Flan/Summon: Shiva's own "Tap target creature an opponent
// controls. Put a stun counter on IT." (singular pronoun) and Omega,
// Heartless Evolution's own "...tap up to one target nonland permanent...
// Put X stun counters ON EACH OF THOSE PERMANENTS..." (plural, referring
// back to the "for each opponent" tap loop). Neither real clause ever
// prints a type word ("creature"/"artifact"/"land") anywhere near the
// counter-placement sentence itself — the type is only ever named in the
// PRECEDING tap sentence, already independently anchored by
// `tapTarget-effect-structural`'s own recognizer — so this branch:
//   1. Matches a genuinely different, narrower real English template with
//      NO "target" word requirement at all: "put ... counter(s) on it" or
//      "put ... counters on each of those permanents" (`buildPronounCarryoverPattern`
//      below) — the two confirmed real phrasings, never guessed beyond them.
//   2. Derives the emitted fact's own `target` constraint STRUCTURALLY, off
//      the PRECEDING tapTarget effect's own `validType`
//      (`pronounTargetConstraintFor` below) — sidesteps the "no confirmed
//      English typeWord template for creature-or-artifact" problem entirely,
//      since the constraint is never extracted from this sentence's own
//      text (which doesn't name a type at all); it only needs to be a real,
//      accurate reflection of what object the earlier tap already
//      constrained. Widened here (not `targetConstraintFor`, which the
//      OTHER, non-pronoun branch still uses and which still declines
//      'creature-or-artifact' for genuinely different reasons) to also cover
//      `'creature-or-artifact'` as `hasAny:['Creature','Artifact']` — a real,
//      already-established fact shape (Ice Flan's/Omega's own pre-existing
//      hand-authored facts already use exactly this shape) once the typeWord
//      confirmation problem no longer applies.
//   3. `amount` is intentionally NOT re-checked against the non-positive
//      guard here beyond the shared check already applied — Omega's own
//      real `amount` is a live `Computed<number>` (`ctx.you.getLandsInPlay()
//      .length`), never a literal, so the existing `typeof === 'number'`
//      guard already leaves it alone (never a false decline).
//
// **Paired SINK fact** — only emitted when `validType` narrows to a real
// type constraint (`'creature'`/`'land'`/`'artifact'`; never for `'any'`,
// which asserts no type constraint at all — matches Clash of the Eikons's
// own real hand-authored fact, which has never carried a sink for its LORE
// counter either). Deliberately built with `to` (never `zone`) — see
// `scripts/apply-recognizers.mjs`'s own `coreKey` doc comment for the
// `zone`/`to` normalization this pass added specifically so this
// recognizer's own `to`-shaped sink correctly retags a pre-existing
// `zone`-shaped hand-authored one (Ride the Shoopuf, Rosa's own sinks)
// instead of appending a near-duplicate.
//
// **2026-09-16 source/sink split fix (real user-reported bug, non-pronoun-
// carryover branch only), revised same day** — the sink used to reuse the
// SOURCE's own whole-clause annotation byte-for-byte (Ultima, Origin of
// Oblivion's own sink covered "put a blight counter on target land," the
// whole clause, verb included, when the sink only actually claims "a
// target land exists"). `buildPattern` splits its confirmed-typeWord
// template into TWO capturing groups — group 1 the ACTION clause ("put
// <qty> <counterType> counter(s) on"), group 2 the narrower TARGET
// object-phrase ("[up to one] target <typeWord>") — and the main loop
// below uses the `d` (indices) regex flag to anchor the SINK fact to group
// 2. The SOURCE fact, however, stays anchored to the FULL match (group 1 +
// group 2 together) rather than group 1 alone — user-confirmed same day
// (Ultima): "put a counter on target X" is one coherent action whose
// target is part of the action itself, not a separate condition/multiplier
// the way "each Equipment you control" is for `ptFormula-scalingPump-
// structural.ts`'s own sibling fix, so the source keeps the whole clause
// and a real span overlap with the sink is expected, not a bug — this is
// NOT the same "whole-clause source, narrow-object-phrase sink, fully
// disjoint" split `putCounter-broadcast-structural.ts`'s own Aerith/Dion/
// Crystal's Chosen fix uses; don't copy that file's disjoint convention
// back into this one. Affects 6 of this recognizer's 10 real users
// (Cloudbound Moogle, Ride the Shoopuf, Combat Tutorial, Prishe's
// Wanderings, Rosa Resolute White Mage, Ultima); the `'any'`-typed Clash of
// the Eikons mode has no sink to split (unchanged, single whole-clause
// span, see `buildPattern`'s own `!typeWord` branch); the 3
// PRONOUN-CARRYOVER cards (Ice Flan, Omega Heartless Evolution, Summon:
// Shiva) are **explicitly NOT covered by this fix** — see the
// "Pronoun-carryover branch" doc comment above for why (that clause's own
// text never names a type at all, so there is no in-clause object-phrase
// to split off; the real type-bearing text lives in the PRECEDING
// `tapTarget` effect's own separate clause, owned by a different
// recognizer, `tapTarget-effect-structural.ts` — which was found, while
// investigating this fix, to carry the IDENTICAL "sink reuses source's own
// whole-clause span" bug in its own domain, undiscovered/unfixed here
// since it's a different file/rule entirely; a real, named follow-up, not
// silently swallowed).
//
// Also fixed alongside this (same `buildPattern` change): a real, separate,
// PRE-EXISTING over-broad SOURCE-anchoring bug on Prishe's Wanderings — its
// own line has TWO "put" occurrences ("put it onto the battlefield tapped,
// then shuffle. When you search your library this way, put a +1/+1 counter
// on target creature you control."), and the old, unbounded `[^\n]*?` gap
// between "put" and the counterType happily matched clear across the
// PERIOD separating those two sentences, anchoring the whole clause (both
// source AND sink, before this fix) to the WRONG, earlier "put" — regex
// always prefers the leftmost valid match start. `buildPattern`'s gaps are
// now `[^\n.]*?` (excludes a literal period, not just newline) specifically
// so a match can never cross a sentence boundary; checked directly against
// all 10 real users that no other real clause here legitimately needs to
// span a period, so this is a strict, safe tightening, not a behavior
// change for the other 5 typeWord-confirmed cards.
import type { CardDefinition, Effect } from '../card';
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

const RULE = 'putCounterTarget-effect-structural' as const;

export type { StructuralRecognizerInput };

type PutCounterTargetEffect = Extract<Effect, { kind: 'putCounterTarget' }>;

function isPutCounterTargetEffect(e: Effect): e is PutCounterTargetEffect {
  return e.kind === 'putCounterTarget';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `validType` -> the one type word this recognizer has a confirmed real
 * English template for — `undefined` for `'any'` (no typeWord requirement at
 * all, see module doc comment) and for `'creature-or-artifact'` (no
 * confirmed template, structurally out of scope — see `isEligible` below,
 * which never even calls this for that value). */
function typeWordFor(validType: PutCounterTargetEffect['validType']): string | undefined {
  switch (validType) {
    case 'creature':
      return 'creature';
    case 'land':
      return 'land';
    case 'artifact':
      return 'artifact';
    default:
      return undefined;
  }
}

function targetConstraintFor(validType: PutCounterTargetEffect['validType']): Constraints | undefined {
  const typeWord = typeWordFor(validType);
  if (!typeWord) return undefined;
  return { types: { has: [typeWord[0]!.toUpperCase() + typeWord.slice(1)] } };
}

/** The pronoun-carryover branch's own STRUCTURAL constraint derivation — see
 * module doc comment's own "Pronoun-carryover branch" section for why this
 * is a wholly separate function from `targetConstraintFor` (which still
 * declines `'creature-or-artifact'`, correctly, for the OTHER, non-pronoun
 * branch): here the constraint is read off the PRECEDING tapTarget's own
 * `validType`, never extracted from this sentence's own text, so the "no
 * confirmed English typeWord template" problem that blocks
 * `targetConstraintFor` doesn't apply. `'any'` still yields `undefined` (no
 * real card combines a pronoun-carryover shape with an unrestricted
 * `'any'`-typed preceding tap today — nothing to confirm either way). */
function pronounTargetConstraintFor(validType: PutCounterTargetEffect['validType']): Constraints | undefined {
  switch (validType) {
    case 'creature':
      return { types: { has: ['Creature'] } };
    case 'land':
      return { types: { has: ['Land'] } };
    case 'artifact':
      return { types: { has: ['Artifact'] } };
    case 'creature-or-artifact':
      return { types: { hasAny: ['Creature', 'Artifact'] } };
    default:
      return undefined;
  }
}

/** "put <qty> <counterType> counter(s) on it" / "... on each of those
 * permanents" — the two confirmed real pronoun-carryover phrasings (see
 * module doc comment), deliberately requiring NO "target" word and no
 * typeWord at all, unlike `buildPattern` below. */
function buildPronounCarryoverPattern(counterType: string): RegExp {
  const ct = escapeRegExp(counterType);
  return new RegExp(`\\bput\\b[^\\n]*?${ct}[^\\n]*?\\bcounters?\\b[^\\n]*?\\bon\\b[^\\n]*?\\b(?:it|each of those permanents)\\b`, 'i');
}

/** "put <qty> <counterType> counter(s) on [up to one] target [<typeWord>]" —
 * deliberately loose between anchors (same non-greedy convention
 * `dealDamage-effect-structural.ts` already establishes), never anchoring
 * the quantifier word (a literal number, "a", "an", "X" — this Fact carries
 * no magnitude, see that file's own doc comment for the identical reasoning
 * applied to a different Effect kind). Every gap is `[^\n.]*?` (excludes a
 * literal period, not just a newline) — see this file's own module doc
 * comment's "2026-09-16 source/sink split fix" section for why (a real,
 * separate over-broad-SOURCE-anchoring bug this same tightening fixes on
 * Prishe's Wanderings, whose own line has an earlier, unrelated "put" in a
 * PRECEDING sentence).
 *
 * `typeWord` omitted entirely (not even the literal "target" is followed by
 * anything else required) for the `'any'` case — see module doc comment —
 * and, since that case never pairs with a sink at all (see
 * `targetConstraintFor`), returns a single-group pattern with nothing to
 * split: the whole match stays the one and only span, exactly as before
 * this fix.
 *
 * Otherwise (a confirmed `typeWord`) returns a TWO-capturing-group pattern
 * — group 1 the ACTION clause ("put ... counter(s) on"), group 2 the
 * narrower TARGET object-phrase ("[up to one] target <typeWord>") — so the
 * caller can anchor the source fact to group 1 and the paired sink fact to
 * group 2 instead of reusing the same whole-clause span for both (see
 * module doc comment's own "source/sink split fix" section). */
function buildPattern(counterType: string, typeWord: string | undefined): RegExp {
  const ct = escapeRegExp(counterType);
  if (!typeWord) {
    return new RegExp(`\\bput\\b[^\\n.]*?${ct}[^\\n.]*?\\bcounters?\\b[^\\n.]*?\\btarget\\b`, 'i');
  }
  const objectPhrase = `(?:up to one )?\\btarget\\b[^\\n.]*?\\b${escapeRegExp(typeWord)}\\b`;
  return new RegExp(`(\\bput\\b[^\\n.]*?${ct}[^\\n.]*?\\bcounters?\\b[^\\n.]*?\\bon\\b)\\s+(${objectPhrase})`, 'i');
}

/** Structural scope gate — see module doc comment's own "Structurally OUT OF
 * SCOPE" section for exactly which real pool cases each branch declines.
 * `pronounCarryover: true` (2026-09-16) is a real, ELIGIBLE branch, not a
 * decline — see this file's own "Pronoun-carryover branch" doc comment.
 * Checked BEFORE the `'creature-or-artifact'` decline below, deliberately:
 * a pronoun-carryover clause's own eligibility never depends on ITS OWN
 * `validType` having a confirmed English typeWord (it has no typeWord in
 * its text at all), so it must win precedence over that decline whenever
 * both conditions happen to be true on the same real card (Ice Flan,
 * Omega). */
function isEligible(
  effect: PutCounterTargetEffect,
  precedingKind: Effect['kind'] | undefined,
): { ok: true; pronounCarryover: boolean } | { ok: false; reason: string } {
  if (typeof effect.amount === 'number' && effect.amount <= 0) {
    return { ok: false, reason: `amount ${effect.amount} is non-positive — a putCounterTarget Fact only ever claims counters being ADDED, not removed` };
  }
  if (precedingKind === 'tapTarget') {
    return { ok: true, pronounCarryover: true };
  }
  if (effect.validType === 'creature-or-artifact') {
    return { ok: false, reason: `validType 'creature-or-artifact' has no confirmed real English typeWord template in this pool (checked: the one real card using it, Omega, Heartless Evolution, prints "nonland permanent," not "creature or artifact")` };
  }
  return { ok: true, pronounCarryover: false };
}

export function recognizePutCounterTargetEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  // Walked per-container (not via the flattened `allEffects`) so each
  // putCounterTarget effect can see whether a `tapTarget` effect immediately
  // precedes it IN THE SAME container — `allEffects` itself is still used
  // below only to confirm at least one candidate exists at all.
  if (allEffects(input).map((o) => o.effect).filter(isPutCounterTargetEffect).length === 0) {
    return { matched: false, reason: 'no kind:"putCounterTarget" Effect on this face' };
  }

  const containers: Effect[][] = [];
  if (input.effects) containers.push(input.effects);
  for (const t of input.triggers ?? []) if (t.effects) containers.push(t.effects);
  for (const a of input.abilities ?? []) if (a.effects) containers.push(a.effects);
  // `modal` modes each carry their own independent container too (Clash of
  // the Eikons's own 3 modes) — walked one level deep here since a
  // `tapTarget` predecessor is only ever meaningful WITHIN one mode's own
  // effects list, never across sibling modes.
  const modalContainers: Effect[][] = [];
  for (const list of containers) {
    for (const e of list) {
      if (e.kind === 'modal') for (const mode of e.modes) if (mode.effects) modalContainers.push(mode.effects);
    }
  }
  containers.push(...modalContainers);

  const facts: RecognizedFact[] = [];
  const annotationByEffect = new Map<PutCounterTargetEffect, ReturnType<typeof toLineOffset>>();
  let anyEligible = false;
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // built off `allEffects()`'s own real container walk (which covers every
  // real Effect, including inside a `modal` mode), not the manual `containers`
  // walk right above it (that walk exists only to see each effect's own
  // IMMEDIATE predecessor for the pronoun-carryover check, a different real
  // need — see `dealDamage-effect-structural.ts`'s own identical comment for
  // why this lookup is safe by object identity).
  const effectSource = effectSourceMap(input);

  for (const list of containers) {
    for (let i = 0; i < list.length; i++) {
      const effect = list[i]!;
      if (!isPutCounterTargetEffect(effect)) continue;
      const preceding = i > 0 ? list[i - 1]! : undefined;
      const eligibility = isEligible(effect, preceding?.kind);
      if (!eligibility.ok) continue; // structurally out of scope — see module doc comment; never a 'mismatch'
      anyEligible = true;
      const triggeredBy = triggeredByOf(effectSource.get(effect));

      const pattern = eligibility.pronounCarryover
        ? buildPronounCarryoverPattern(effect.counterType)
        : buildPattern(effect.counterType, typeWordFor(effect.validType));
      const global = new RegExp(pattern.source, pattern.flags + 'gd');
      const matches = [...input.oracleText.matchAll(global)] as Array<
        RegExpMatchArray & { indices: Array<[number, number] | undefined> }
      >;
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
      const [fullStart, fullEnd] = m.indices[0]!;
      // **2026-09-16 source/sink split fix, revised same day** — the SINK
      // narrows to just the target object-phrase (group 2, "target
      // <typeWord>") since a sink fact only ever claims "an object of this
      // type exists to receive the counter." The SOURCE, unlike the sibling
      // fix in `putCounter-broadcast-structural.ts`/
      // `ptFormula-scalingPump-structural.ts`, stays anchored to the FULL
      // clause (verb through target phrase, "put a blight counter on target
      // land") rather than truncating at the object phrase's own start —
      // user-confirmed (Ultima, Origin of Oblivion): "put a counter on
      // target X" is one coherent action description whose target is part
      // of the action itself, not a separate condition/multiplier the way
      // "each Equipment you control" is for ptFormula-scalingPump. A real
      // overlap between source and sink spans here is expected and fine.
      // The pronoun-carryover branch and the typeWord-less 'any' case never
      // have split groups at all, so both source and sink still fall back
      // to the one whole-match span unchanged.
      const hasSplitGroups = m.indices[1] !== undefined && m.indices[2] !== undefined;
      const [sinkStart, sinkEnd] = hasSplitGroups ? m.indices[2]! : [fullStart, fullEnd];
      const sourceAnnotation = toLineOffset(input.oracleText, fullStart, fullEnd);
      const sinkAnnotation = toLineOffset(input.oracleText, sinkStart, sinkEnd);
      if (!sourceAnnotation || !sinkAnnotation) {
        return {
          matched: false,
          reason: `matched span [${fullStart},${fullEnd}) (or its own inner source/sink split spans) did not resolve to a single real oracle-text line`,
        };
      }
      annotationByEffect.set(effect, sourceAnnotation);

      // Pronoun-carryover: the constraint comes off the PRECEDING tapTarget
      // effect's own `validType`, never this effect's own (see module doc
      // comment) — `preceding` is guaranteed a `tapTarget` effect whenever
      // `eligibility.pronounCarryover` is true (that's exactly what made
      // `isEligible` return it).
      const target = eligibility.pronounCarryover
        ? pronounTargetConstraintFor((preceding as Extract<Effect, { kind: 'tapTarget' }>).validType)
        : targetConstraintFor(effect.validType);
      facts.push({
        role: 'source',
        fact: {
          event: 'putCounter',
          counterType: effect.counterType,
          ...(target ? { target } : {}),
          targeted: true,
          annotations: [sourceAnnotation],
          ...(triggeredBy ? { triggeredBy } : {}),
        },
        provenance: { origin: 'parser', rule: RULE },
      });

      if (target) {
        facts.push({
          role: 'sink',
          fact: { to: 'Battlefield', types: target.types!, annotations: [sinkAnnotation] },
          provenance: { origin: 'parser', rule: RULE },
        });
      }
    }
  }

  if (!anyEligible) {
    return { matched: false, reason: 'every kind:"putCounterTarget" Effect on this face was structurally out of scope (non-positive amount, or a creature-or-artifact validType with no preceding tapTarget) — see module doc comment' };
  }
  return { matched: true, facts };
}
