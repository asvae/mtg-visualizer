// Recognizer C (`PRD_AUTOMATED_AUTHORING.md`, 2026-09-13 follow-up) — the
// PRD's own "flagged future direction, not yet attempted" fork (A): read a
// `CardDefinition`'s already-typed `Effect[]` STRUCTURE directly (never
// oracle text, never Forge script) and, for `kind: 'destroy'` specifically,
// derive the corresponding `event: 'destroy'` Fact from its structured
// fields. Deliberately a THIRD source domain, not a rework of Recognizers
// A/B (`instant-sorcery-resolves-to-graveyard.ts` / `permanent-enters-
// battlefield-normally.ts`), both of which only ever read a face's own
// printed `typeLine`/`oracleText`.
//
// **Why `destroy` specifically**: the user's own motivating example, real
// `cards/summon-bahamut/definition.ts` fin/1 —
//   `{ kind: 'destroy', validType: 'permanent', nonLand: true, qty: 1,
//      optional: true } satisfies Effect`
// — every field a Fact needs (target type, quantity, optional-ness) is
// already a plain, typed, non-function value on the object, no text parsing
// required at all. Contrast the PRD's own rejected Forge-script prototype
// (`forge-script-parser.prototype.ts`), which had to parse a SECOND external
// DSL; this recognizer reads THIS APP'S OWN already-agent-verified
// `definition.ts`, one source, already checked against Forge when it was
// authored.
//
// **The real open problem this recognizer exists to test a fix for**: an
// `Effect` object carries no text-span pointer — `card.ts`'s own header is
// explicit that a `CardDefinition` is DATA a real interpreter (`resolveCard`)
// consumes, not an annotated parse tree. Unlike the rejected Forge-script
// prototype (where mapping structured fields back onto English prose needed
// real templating judgment — quote-aware clause bounding, word-order drift
// between the script's own field order and a card's prose), this recognizer
// gets to try something narrower and more mechanical: BUILD the expected
// English clause directly FROM the structured fields (Magic's own removal
// templating is a small, closed vocabulary — "[up to N] target
// <type>[with power N or greater]"), then require that exact literal phrase
// to appear EXACTLY ONCE in the face's own real oracle text, immediately
// followed by a real clause boundary (a period, a newline, or end of
// string). If it doesn't appear exactly once with that boundary, this
// recognizer declines rather than guess — same conservative-by-construction
// discipline as Recognizers A/B, not a license to force a match.
//
// **Real, deliberate scope narrowing found while building this (see this
// recognizer's own `recognize` doc comment for the exact declines)**:
// - `owner` (`EffectOwner` — "an opponent controls") declines UNCONDITIONALLY.
//   No real hand-authored `destroy`-ACT fact in the pool combines `owner`
//   with a bare `event:'destroy'` tag today (every real card carrying
//   `owner:'opponents'` on its `destroy` Effect — `deadly-embrace`,
//   `ultima-weapon`, `summon-primal-odin` — has NO `event:'destroy'` fact in
//   its own `synergy.json` at all; see this recognizer's own test file for
//   the full grep). Whether the intended shape is a top-level
//   `controller:'opp'` sibling field (the convention this pool's own
//   `dies`-shaped consequence facts for these same three cards already use
//   — e.g. `summon-primal-odin`'s `{event:'dies', controller:'opp', ...}`)
//   is a REASONABLE guess by analogy, but genuinely unconfirmed for the ACT
//   fact specifically — declining rather than guessing wrong here.
// - Non-literal `qty`/`minPower` (a `Computed<number>` function, not a plain
//   number) decline — same "opaque closure" wall the PRD's own black-box-
//   execution section already names; nothing in this pool needs it yet
//   (every real `destroy` Effect found has a literal `qty: 1`).
// - `qty !== 1` declines — no real card in the pool has `qty: 2+` to verify
//   real MTG pluralization templating ("destroy two target creatures")
//   against; asserting a guessed plural phrasing with zero real ground
//   truth to check it against would be exactly the kind of guess this
//   recognizer exists to avoid. Revisit once a real qty>1 card exists.
// - Any trailing oracle-text qualifier the structured `Effect` doesn't
//   represent at all declines, by construction, via the required clause-
//   boundary check — `qutrub-forayer`'s own real "Destroy target creature
//   THAT WAS DEALT DAMAGE THIS TURN." is the real card that surfaced this:
//   its `Effect` (`{ kind: 'destroy', validType: 'creature', qty: 1 }`) has
//   no field at all for "that was dealt damage this turn" (this pool's own
//   `Constraints` vocabulary — `synergy.ts`'s `types`/`cmc`/`power`/
//   `toughness`/`amount`/`name`/`attacking` — has no such predicate either,
//   so even a human author couldn't encode it more precisely than a bare
//   "target creature" claim would already imply); rather than silently
//   truncating the annotation at "creature" and asserting a fact that reads
//   as broader than the real card, this recognizer declines the whole
//   card and leaves it for normal agent authorship.
//
// **Companion `dies` consequence fact (2026-09-13 follow-up)** — whenever
// this recognizer confidently recognizes a `destroy` effect, it ALSO emits
// the paired CR 700.4 `dies` CONSEQUENCE fact (same target constraint, same
// annotation span, `from:'Battlefield'`/`to:'Graveyard'`/`targeted:true`) —
// see `recognize`'s own doc comment, right below the loop that builds it,
// for the full reasoning and the real pool cards (`battle-menu`,
// `fate-of-the-sun-cryst`, `dion-bahamut-s-dominant-bahamut-warden-of-
// light`'s own back face) that already carry this exact pairing
// hand-authored, confirming it's a general pattern rather than a one-off
// for Summon: Bahamut.
import type { Effect } from '../card';
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

const RULE = 'destroy-effect-structural' as const;

// Re-exported for backward compatibility — this recognizer's own tests (and
// any future caller) import `StructuralRecognizerInput` from this file;
// factoring the type out to `structural-effects.ts` (2026-09-13, once
// `drawCard-effect-structural.ts` needed the identical shape) shouldn't move
// the import path too.
export type { StructuralRecognizerInput };

type DestroyEffect = Extract<Effect, { kind: 'destroy' }>;

function isDestroyEffect(e: Effect): e is DestroyEffect {
  return e.kind === 'destroy';
}

const NUMBER_WORDS: Record<number, string> = { 1: 'one' };

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds the expected literal English clause for one structurally-read
 * `destroy` effect — real, closed Magic removal-spell templating (see this
 * file's own module doc comment), not a generic scan. Returns `undefined`
 * (never guesses) whenever a field falls outside what this recognizer has a
 * real, pool-confirmed template for — see the module doc comment's own
 * "deliberate scope narrowing" list for exactly which. */
function expectedClausePattern(effect: DestroyEffect): RegExp | undefined {
  if (effect.owner) return undefined; // unconfirmed Fact-shape for an owner-restricted destroy ACT — see module doc comment
  if (typeof effect.qty !== 'number') return undefined; // Computed<number> closure — opaque, can't read without executing it
  if (effect.qty !== 1) return undefined; // no real qty>1 card to verify plural templating against
  if (effect.minPower !== undefined && typeof effect.minPower !== 'number') return undefined;

  const numberWord = NUMBER_WORDS[effect.qty]!;
  const quantifier = effect.optional ? `up to ${numberWord} target` : 'target';

  let typeWord: string;
  if (effect.validType === 'creature') typeWord = 'creature';
  else if (effect.validType === 'land') typeWord = 'land';
  else if (effect.validType === 'permanent' && effect.nonLand) typeWord = 'nonland permanent';
  else if (effect.validType === 'permanent') typeWord = 'permanent';
  else return undefined;

  let suffix = '';
  if (effect.minPower !== undefined) {
    if (effect.validType !== 'creature') return undefined; // no real card combines minPower with a non-creature validType
    suffix = ` with power ${effect.minPower} or greater`;
  }

  const phrase = `${quantifier} ${typeWord}${suffix}`;
  // Case-insensitive (a mid-sentence real clause, e.g. Sidequest: Hunt the
  // Mark's own "When this enchantment enters, destroy up to one target
  // creature.", starts lowercase) `destroy`, word-bounded so it never
  // matches inside a longer word, immediately followed by the built phrase,
  // immediately followed by a real clause boundary (period/newline/end of
  // string) — the boundary check is what makes qutrub-forayer's own real
  // "...creature THAT WAS DEALT DAMAGE THIS TURN." correctly fail to match
  // (see module doc comment).
  return new RegExp(`\\bDestroy ${escapeRegExp(phrase)}(?=[.\\n]|$)`, 'i');
}

function buildTargetConstraint(effect: DestroyEffect): Constraints | undefined {
  const constraints: Constraints = {};
  if (effect.validType === 'creature') constraints.types = { has: ['Creature'] };
  else if (effect.validType === 'land') constraints.types = { has: ['Land'] };
  else if (effect.validType === 'permanent' && effect.nonLand) constraints.types = { not: ['Land'] };
  // validType === 'permanent' with no nonLand restriction: no type filter at
  // all — matches real hand-authored `dion-bahamut-s-dominant-bahamut-
  // warden-of-light`'s own back-face destroy fact, which omits `target`
  // entirely for its own unrestricted "Destroy target permanent."
  if (typeof effect.minPower === 'number') constraints.power = { min: effect.minPower };
  return Object.keys(constraints).length > 0 ? constraints : undefined;
}

/**
 * Reads one face's own structured `Effect[]` directly (never this face's own
 * oracle text, except to ANCHOR the derived fact's annotation — see module
 * doc comment) and derives the `event: 'destroy'` Fact(s) implied by every
 * `kind: 'destroy'` effect this recognizer can confidently resolve.
 *
 * **All-or-nothing per face, not per-effect** (a real, stated simplification
 * — see module doc comment): if this face has zero `destroy` effects,
 * declines with that reason; if it has one or more but ANY of them can't be
 * confidently resolved to a real, uniquely-anchored fact, the WHOLE face
 * declines rather than partially claiming only the resolvable ones. No real
 * card in the pool this recognizer was checked against actually needs
 * finer-grained partial success (every real multi-`destroy`-effect case —
 * `summon-bahamut`'s own chapterI/chapterII pair — maps to the exact SAME
 * single real fact), so this is left as a known open question for the
 * recognizer library to solve later, not solved here.
 *
 * **No dedup here** — every matched `destroy` effect on this face produces
 * its own `RecognizedFact` below, including a literal duplicate when two
 * effects share one real clause (`summon-bahamut`'s own chapterI/chapterII
 * pair, above). Dedup/merge across those (and, more generally, merging two
 * facts that are the same real claim but point at DIFFERENT real annotation
 * spans) is now a single shared runner-level pass
 * (`apply-recognizers.mjs`'s own `mergeRecognizedFactsByIdentity` — see that
 * function's own doc comment), not this recognizer's own concern — moved
 * there 2026-09-13 per the PRD's own follow-up (this file used to keep its
 * own per-face `seen` Set here, keyed on the full `JSON.stringify(fact)`,
 * which only ever collapsed two facts sharing the exact same annotation
 * span; that bespoke copy is gone).
 */
export function recognizeDestroyEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const destroyEffects = allEffects(input).filter(isDestroyEffect);
  if (destroyEffects.length === 0) {
    return { matched: false, reason: 'no kind:"destroy" Effect on this face' };
  }

  const facts: RecognizedFact[] = [];

  for (const effect of destroyEffects) {
    const pattern = expectedClausePattern(effect);
    if (!pattern) {
      return {
        matched: false,
        reason: `a destroy effect on this face (${JSON.stringify(effect)}) has no confirmed structural→text template (owner-restricted, non-literal qty/minPower, qty!=1, or an unsupported validType/minPower combination)`,
      };
    }

    const global = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(global)];
    if (matches.length === 0) {
      // A pattern WAS built from this face's own structured data but never
      // appears verbatim in its real oracle text — `kind:'mismatch'` (see
      // `types.ts`'s own doc comment): either a real recognizer bug, or a
      // real divergence between the structured `Effect` and the card's own
      // prose (`qutrub-forayer`'s trailing "that was dealt damage this turn"
      // qualifier is the confirmed real example — see module doc comment).
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

    const target = buildTargetConstraint(effect);
    const fact: RecognizedFact = {
      role: 'source',
      fact: {
        event: 'destroy',
        ...(target ? { target } : {}),
        targeted: true,
        value: 1,
        annotations: [annotation],
      },
      provenance: { origin: 'parser', rule: RULE },
    };

    facts.push(fact);

    // Companion `dies` CONSEQUENCE fact (2026-09-13 follow-up, closing
    // Summon: Bahamut/fin-1's own last-but-one agent-derived fact) — CR
    // 700.4: destroying something IS moving it from the battlefield to a
    // graveyard, so whenever this recognizer confidently recognizes a real
    // `destroy` effect, the SAME real dying is ALSO a guaranteed, checkable
    // consequence — same "ACT vs CONSEQUENCE" standing rule
    // `SYNERGY_DESIGN.md` already codifies for `saga-lore-and-sacrifice-
    // structural.ts`'s own sacrifice->dies pair (a sacrifice ACT has no
    // rules-based prevention mechanism either, but the destroy ACT itself
    // genuinely can be prevented — indestructible/regeneration — which is
    // exactly why `destroy-effect-structural`'s OWN fact above stays a bare
    // ACT tag with no zone fields; the paired `dies` fact below is the
    // separate, always-real CONSEQUENCE, unconditionally eligible the
    // moment a destroy effect is recognized at all, per that same rule).
    //
    // **Real pool check confirming this is a general pattern, not a
    // Bahamut-specific hack**: `battle-menu` and `fate-of-the-sun-cryst`
    // both ALREADY carry this exact pairing hand-authored (same target
    // constraint, `from:'Battlefield'`/`to:'Graveyard'`/`targeted:true`,
    // same annotation span as their own `destroy` fact) — this recognizer's
    // own output is verified byte-for-byte against both in
    // `destroy-effect-structural.test.ts`. `dion-bahamut-s-dominant-
    // bahamut-warden-of-light`'s own back face (an unrestricted "Destroy
    // target permanent," no `target` constraint at all) carries the
    // identical pairing too. Same span as the paired `destroy` fact — CR
    // 700.4's own consequence has no separate textual anchor of its own; the
    // ACT clause IS the only real anchor either fact has.
    facts.push({
      role: 'source',
      fact: {
        event: 'dies',
        from: 'Battlefield',
        to: 'Graveyard',
        ...(target ? { target } : {}),
        targeted: true,
        value: 1,
        annotations: [annotation],
      },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
