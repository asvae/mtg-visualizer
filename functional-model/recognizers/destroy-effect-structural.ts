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
// **No more companion `dies` consequence fact (removed 2026-09-16, real
// user-reported authoring-time redundancy)** — this recognizer used to ALSO
// emit a paired CR 700.4 `dies` CONSEQUENCE fact (same target constraint,
// same annotation span, `from:'Battlefield'`/`to:'Graveyard'`/
// `targeted:true`) alongside the `destroy` ACT fact above, on the reasoning
// that a real destroy is always followed by dying. That reasoning is true
// but the SEPARATE fact was pure duplication, not new information — the
// `destroy` fact's own `target` filter already says everything the `dies`
// fact said, and both facts were anchored to the IDENTICAL annotation span
// (confirmed live on `battle-menu`/fin-9: "Destroy target creature with
// power 4 or greater" produced a byte-for-byte-annotation-identical
// `destroy` AND `dies` fact pair). Removed in favor of a MATCH-TIME
// equivalence instead: `synergy.ts`'s `factsInteract` now treats a
// `destroy`-event SOURCE fact as satisfying any "wants a creature to arrive
// in a graveyard" want (a zone-shaped `to:'Graveyard'` sink, or an
// event-shaped `event:'dies'` sink) directly — see that file's own
// `satisfiesDestroyImpliesDies`/`isGraveyardArrivalWant` doc comments for
// the exact matching rule, and `.claude/contracts/card-schema.md`/
// `SYNERGY_DESIGN.md` for the contract-level writeup. Verified via a real
// full-pool `find-synergies.mjs` before/after diff at removal time: zero
// real (producer, wanter) card-pairs lost any edge — every match the old
// `dies` fact used to provide is still produced, just through the
// `destroy` fact's own widened match instead of a second, separately
// authored fact.
//
// **Companion SINK fact (2026-09-14, fin/9 gap closure — Battle Menu's own
// "wants a target creature with power 4 or greater present" precondition)**
// — emitted UNCONDITIONALLY whenever this recognizer confidently recognizes
// a `destroy` effect, narrowed to a real type filter when `target` (above)
// has one, or bare (`{to:'Battlefield'}`, no `types` at all) for an
// unrestricted "Destroy target permanent" — **corrected 2026-09-15**: this
// comment used to claim the unrestricted case never gets a sink at all,
// citing `dion-bahamut-s-dominant-bahamut-warden-of-light`'s own back face
// as the confirming precedent; that precedent was actually STALE (that
// card's own real hand-authored data DOES carry a bare sink for this exact
// clause, just never retagged since this recognizer never emitted a match
// for it to retag against) — see the real fix in `recognize`'s own body,
// right after this comment used to be wrong about. Same "one real clause
// names both what happens and what it wants present" convention
// `putCounterTarget-effect-structural.ts`'s own paired sink already
// establishes for a different Effect kind.
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit): the sink used to reuse the SAME whole-clause span as the paired
// SOURCE/`dies` facts ("Destroy target creature," verb included) — this
// comment used to justify that by analogy to `putCounterTarget-effect-
// structural.ts`'s own paired sink, but that file's own sink got narrowed
// to just the object phrase the same day (see its own module doc
// comment), and this recognizer just hadn't caught up.
// `expectedClausePattern` now wraps the object phrase ("[up to one]
// target <type>[ with power N or greater]") in its own capturing group;
// the SOURCE and `dies` facts keep the WHOLE clause (unchanged —
// "Destroy" is squarely part of what those 2 facts claim), only the SINK
// narrows to the object-phrase group.
import type { Effect } from '../card';
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

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
  return new RegExp(`\\bDestroy (${escapeRegExp(phrase)})(?=[.\\n]|$)`, 'i');
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
  const destroyEffects = allEffects(input).map((o) => o.effect).filter(isDestroyEffect);
  if (destroyEffects.length === 0) {
    return { matched: false, reason: 'no kind:"destroy" Effect on this face' };
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of destroyEffects) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    const pattern = expectedClausePattern(effect);
    if (!pattern) {
      return {
        matched: false,
        reason: `a destroy effect on this face (${JSON.stringify(effect)}) has no confirmed structural→text template (owner-restricted, non-literal qty/minPower, qty!=1, or an unsupported validType/minPower combination)`,
      };
    }

    const global = new RegExp(pattern.source, pattern.flags + 'gd');
    const matches = [...input.oracleText.matchAll(global)] as Array<RegExpMatchArray & { indices: Array<[number, number] | undefined> }>;
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
    const [objectStart, objectEnd] = m.indices[1]!;
    const objectAnnotation = toLineOffset(input.oracleText, objectStart, objectEnd);
    if (!annotation || !objectAnnotation) {
      return { matched: false, reason: `matched span [${start},${end}) (or its own inner object-phrase span) did not resolve to a single real oracle-text line` };
    }

    const target = buildTargetConstraint(effect);
    const fact: RecognizedFact = {
      role: 'source',
      fact: {
        event: 'destroy',
        ...(target ? { target } : {}),
        targeted: true,
        annotations: [annotation],
        ...(triggeredBy ? { triggeredBy } : {}),
      },
      provenance: { origin: 'parser', rule: RULE },
    };

    facts.push(fact);

    // No companion `dies` CONSEQUENCE fact here anymore — see module doc
    // comment ("No more companion `dies` consequence fact"). The `destroy`
    // fact above now satisfies a graveyard-arrival want directly, at MATCH
    // time (`synergy.ts`'s `satisfiesDestroyImpliesDies`).

    // **2026-09-15 correction (fin/16-25 pass)**: the module doc comment
    // above used to say an unrestricted "Destroy target permanent" never
    // gets a sink at all, citing `dion-bahamut-s-dominant-...`'s own back
    // face as the confirming precedent — that precedent turned out to be
    // STALE, not confirming: this card's own real, pre-existing
    // hand-authored data actually DOES carry a bare `{to:'Battlefield'}`
    // sink (no `types` at all) for this exact unrestricted destroy, left
    // unprovenanced/untouched because this recognizer never produced
    // anything to retag it against. A bare bare-permanent "wants a permanent
    // present" want is a real, if maximally broad, precondition — CR 601.2c,
    // a destroy spell can't resolve without a legal target — so it's emitted
    // unconditionally now (with no `types` key at all when `target` itself
    // is undefined), same as every type-filtered case above.
    const sinkFact: Record<string, unknown> = { to: 'Battlefield', annotations: [objectAnnotation] };
    if (target?.types) sinkFact.types = target.types;
    if (target?.power) sinkFact.power = target.power;
    facts.push({ role: 'sink', fact: sinkFact as RecognizedFact['fact'], provenance: { origin: 'parser', rule: RULE } });
  }

  return { matched: true, facts };
}
