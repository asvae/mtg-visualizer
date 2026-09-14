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
//       container** (Ice Flan, Summon: Shiva's chapters I/II, Ultros,
//       Obnoxious Octopus, Omega a second time) — real, structural signal
//       that this putCounterTarget's own "it" pronoun refers back to the
//       PRECEDING tap's own chosen object, not a fresh "target <noun>"
//       clause of its own (Ice Flan's own definition.ts comment: "Put a stun
//       counter on it," the SAME object just tapped) — no confirmed English
//       template exists for this pronoun-carryover shape, so it's declined
//       structurally rather than guessed at via a second, riskier pattern.
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
// **Paired SINK fact** — only emitted when `validType` narrows to a real
// type constraint (`'creature'`/`'land'`/`'artifact'`; never for `'any'`,
// which asserts no type constraint at all — matches Clash of the Eikons's
// own real hand-authored fact, which has never carried a sink for its LORE
// counter either). Reuses the SAME span as the paired source fact, same
// "one real clause names both what happens and what it wants present"
// convention `putCounter-broadcast-structural.ts`'s own sink already
// establishes. Deliberately built with `to` (never `zone`) — see
// `scripts/apply-recognizers.mjs`'s own `coreKey` doc comment for the
// `zone`/`to` normalization this pass added specifically so this
// recognizer's own `to`-shaped sink correctly retags a pre-existing
// `zone`-shaped hand-authored one (Ride the Shoopuf, Rosa's own sinks)
// instead of appending a near-duplicate.
import type { CardDefinition, Effect } from '../card';
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

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

/** "put <qty> <counterType> counter(s) on [up to one] target [<typeWord>]" —
 * deliberately loose between anchors (same non-greedy, newline-excluded
 * `[^\n]*?` convention `dealDamage-effect-structural.ts` already
 * establishes), never anchoring the quantifier word (a literal number, "a",
 * "an", "X" — this Fact carries no magnitude, see that file's own doc
 * comment for the identical reasoning applied to a different Effect kind).
 * `typeWord` omitted entirely (not even the literal "target" is followed by
 * anything else required) for the `'any'` case — see module doc comment. */
function buildPattern(counterType: string, typeWord: string | undefined): RegExp {
  const ct = escapeRegExp(counterType);
  const tail = typeWord ? `\\btarget\\b[^\\n]*?\\b${escapeRegExp(typeWord)}\\b` : `\\btarget\\b`;
  return new RegExp(`\\bput\\b[^\\n]*?${ct}[^\\n]*?\\bcounters?\\b[^\\n]*?${tail}`, 'i');
}

/** Structural scope gate — see module doc comment's own "Structurally OUT OF
 * SCOPE" section for exactly which real pool cases each branch declines. */
function isEligible(effect: PutCounterTargetEffect, precedingKind: Effect['kind'] | undefined): { ok: true } | { ok: false; reason: string } {
  if (typeof effect.amount === 'number' && effect.amount <= 0) {
    return { ok: false, reason: `amount ${effect.amount} is non-positive — a putCounterTarget Fact only ever claims counters being ADDED, not removed` };
  }
  if (effect.validType === 'creature-or-artifact') {
    return { ok: false, reason: `validType 'creature-or-artifact' has no confirmed real English typeWord template in this pool (checked: the one real card using it, Omega, Heartless Evolution, prints "nonland permanent," not "creature or artifact")` };
  }
  if (precedingKind === 'tapTarget') {
    return {
      ok: false,
      reason: 'immediately preceded by a tapTarget effect in the same container — this putCounterTarget likely refers back to that tap\'s own chosen object ("put a counter on it"), not a fresh "target <noun>" clause; no confirmed template for that pronoun-carryover shape',
    };
  }
  return { ok: true };
}

export function recognizePutCounterTargetEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  // Walked per-container (not via the flattened `allEffects`) so each
  // putCounterTarget effect can see whether a `tapTarget` effect immediately
  // precedes it IN THE SAME container — `allEffects` itself is still used
  // below only to confirm at least one candidate exists at all.
  if (allEffects(input).filter(isPutCounterTargetEffect).length === 0) {
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

  for (const list of containers) {
    for (let i = 0; i < list.length; i++) {
      const effect = list[i]!;
      if (!isPutCounterTargetEffect(effect)) continue;
      const preceding = i > 0 ? list[i - 1]!.kind : undefined;
      const eligibility = isEligible(effect, preceding);
      if (!eligibility.ok) continue; // structurally out of scope — see module doc comment; never a 'mismatch'
      anyEligible = true;

      const typeWord = typeWordFor(effect.validType);
      const pattern = buildPattern(effect.counterType, typeWord);
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
      annotationByEffect.set(effect, annotation);

      const target = targetConstraintFor(effect.validType);
      facts.push({
        role: 'source',
        fact: {
          event: 'putCounter',
          counterType: effect.counterType,
          ...(target ? { target } : {}),
          targeted: true,
          annotations: [annotation],
        },
        provenance: { origin: 'parser', rule: RULE },
      });

      if (target) {
        facts.push({
          role: 'sink',
          fact: { to: 'Battlefield', types: target.types!, annotations: [annotation] },
          provenance: { origin: 'parser', rule: RULE },
        });
      }
    }
  }

  if (!anyEligible) {
    return { matched: false, reason: 'every kind:"putCounterTarget" Effect on this face was structurally out of scope (non-positive amount, creature-or-artifact validType, or a tapTarget-preceded pronoun reference) — see module doc comment' };
  }
  return { matched: true, facts };
}
