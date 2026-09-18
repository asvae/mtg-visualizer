// Sink catalog FAMILY: Counters — a genuine, reusable `CountersSink` factory
// (2026-09-18 refactor), parametrized per real `Effect.counterType` string
// (`card.ts`'s `putCounter`/`putCounterTarget`/`putCounterAll` all carry
// this SAME `counterType: string` field) rather than a bare, type-blind
// "counters" bucket the way `synergy.ts`'s own legacy `describeFact`
// vocabulary collapses every counter type into. Today only `+1/+1` is a
// real, currently-existing configuration — see `../counters-plus1plus1.ts`
// (2026-09-18, split out of this file so the reusable factory and the
// curated per-instance configuration don't share a module — same
// family-vs-instance separation `battlefield-presence.ts`'s own split
// establishes) for the real motivating card, Exemplar of Light (FDN #11): a
// genuine self-referential producer/consumer LOOP —
//   - "Whenever you gain life, put a +1/+1 counter on this creature" —
//     Lifegain CONSUMER (`lifegain.ts`'s own `consumerTriggerNames`) +
//     Counters PRODUCER (a real `kind:'putCounter', counterType:'+1/+1'`
//     effect — it genuinely puts the counter).
//   - "Whenever one or more counters are put on this creature, draw a
//     card" — Counters CONSUMER (this configuration's own
//     `consumerTriggerNames`).
//
// **Producer** — reuses the EXISTING generic `putCounter` `ProducerOccurrence`
// `match-sink.ts`'s `walkEffects` already derives for EVERY `putCounter`/
// `putCounterTarget`/`putCounterAll` effect (each already carries its own
// real `counterType` on the occurrence) — no new occurrence-DERIVATION code
// needed at all, ever, for a new counter type; a future `+1/+1`-sibling real
// card driving a `'-1/-1'`/`'loyalty'` configuration is the exact same
// shape, zero new code in `match-sink.ts` — this factory is exactly the
// generalization this family's own original header comment already
// anticipated.
//
// **2026-09-18, later still — producer MATCHING no longer goes through a
// `SinkQuery`/`matchSink` at all.** Per the user's own explicit correction
// — "Sink family should produce sink out of card definition. Not out of
// magical query... each sink family's matcher function should directly
// inspect the candidate... written as real code in the function body, not
// built as a standalone object handed to a generic comparator" — this
// factory no longer builds a `SinkQuery` object at all. Instead it calls
// `deriveOccurrences(candidate, root)` (the same real, structural,
// `CardDefinition`-derived occurrence walk `matchSink` itself was always
// built on top of — genuinely reused, not reimplemented) and inspects the
// result directly, inline, in its own function body: does ANY derived
// occurrence have `event === 'putCounter'` and `counterType === counterType`,
// with a controller compatible with `'you'` (the one real constraint the old
// `SinkQuery{controller:'you'}` field contributed — replicated here as a
// direct inline check on `occ.controller`/`occ.target`, mirroring
// `match-sink.ts`'s own private `effectiveController`/`sidesCompatible`
// helpers byte-for-byte in logic, not imported, since this file must not
// modify `match-sink.ts`'s own exports for this narrowly-scoped change).
// Confirmed, by direct derivation against every real `walkEffects` putCounter
// case (`putCounter`/`putCounterTarget`/`putCounterAll`/the AST-derived
// `program:putCounter` case), that this inline check accepts and rejects the
// exact same occurrences `occurrenceSatisfiesSink` used to for this specific
// query shape — see this task's own final report for the full case-by-case
// derivation. The entry built by this factory therefore has NO `query`
// field at all anymore (`SinkCatalogEntry.query` is now optional — see that
// field's own doc comment, `entry.ts`) — `category` (below) is set as its
// own top-level field instead, since there's no `query.category` left to
// carry it. `BattlefieldPresenceSink` (`families/battlefield-presence.ts`)
// has NOT migrated to this shape yet — still builds and matches via a real
// `SinkQuery`/`matchSink` call, deliberately out of scope for this pass (see
// `SINK_MODEL_DESIGN.md`'s own updated section for the "Counters migrated,
// Battlefield-presence hasn't yet" status).
//
// **2026-09-19 — `CountersSink` now takes a real `CardDefinition` directly,
// not a hand-authored config object.** Per the user's own explicit
// instruction — "I don't care about magical configuration file.
// Sink(definition). Got it?" — this factory's public signature is now
// `CountersSink(definition: CardDefinition): SinkInstance`. Every field the
// old `CountersSinkConfig` required (`slug`/`counterType`/
// `consumerTriggerNames`) is now DERIVED from `definition`'s own real
// structural fields at construction time, by a few small, private, pure
// helper functions below (`deriveCounterType`/`deriveConsumerTriggerNames`/
// `slugForCounterType`) — no config object survives as a public or private
// intermediate type; every real fact this factory needs already lives on
// the card's own `CardDefinition`, so authoring it a second time as a
// parallel config was the exact duplication risk the user was rejecting.
// `../counters-plus1plus1.ts` now calls `CountersSink(exemplarOfLight)`
// (the real FDN #11 `CardDefinition`, `../../fdn-cards/exemplar-of-light/
// definition.ts`) instead of a literal `{slug, counterType,
// consumerTriggerNames}` object.
//
// Derivation rules, one per field (each also documented at its own helper
// function below):
//  - `counterType` — this card's own `putCounter`/`putCounterTarget`/
//    `putCounterAll` effect(s), walked across `definition.effects` AND
//    `definition.triggers[].effects` (the same two real places
//    `deriveOccurrences`'s own `walkEffects` looks, scoped down here to just
//    the ONE driving definition being configured, not an arbitrary runtime
//    candidate) — the first real counter-granting effect found names this
//    configuration's own counter type. Exemplar of Light's own `onLifeGain`
//    trigger (`{kind:'putCounter', counterType:'+1/+1', ...}`) is the one
//    real hit, so `counterType` resolves to `'+1/+1'`. Throws (loudly, not
//    silently) if the definition has no real counter-granting effect at
//    all — `CountersSink` is only ever meant to be called with a card that
//    IS this family's own real driving producer, so a definition with no
//    such effect is a genuine authoring mistake, not a legitimate empty
//    result to paper over.
//  - `slug` — deterministically derived from `counterType` itself
//    (`slugForCounterType`), NOT authored separately: sanitizes the counter-
//    type string into a stable identity key (`'+1/+1'` -> lowercase, `+` ->
//    `'plus'`, non-alphanumerics stripped -> `'plus1plus1'`, prefixed
//    `'counters-'`) — reproduces the exact pre-existing real slug
//    (`'counters-plus1plus1'`) byte-for-byte, so every existing filesystem/
//    review-status convention keyed off this slug (`sink-catalog-status.ts`'s
//    `sourceFileFor`/`computeSinkCatalogFingerprint`/`memberEvidenceFor`, all
//    of which resolve `catalog/${slug}.ts`/`catalog/${slug}.corpus.json`
//    directly off `entry.slug`) keeps resolving to the real, unrenamed
//    `catalog/counters-plus1plus1.ts`/`.corpus.json` files on disk with zero
//    changes needed there. A hypothetical future `-1/-1` sibling would
//    derive `'counters-minus1minus1'` the same deterministic way.
//  - `consumerTriggerNames` — see `deriveConsumerTriggerNames`'s own doc
//    comment below for the full "no `on` field is NOT itself a reserved
//    convention" investigation and the real discriminator chosen instead.
//
// **Consumer** (`consumerTriggerNames`, derived — see
// `deriveConsumerTriggerNames` below) — same gap as `etb.ts`'s own Dazzling
// Angel fix: "whenever one or more counters are put on this creature" has
// no real `Trigger.on` value today (`card.ts`'s closed enum has no
// counter-added member — `ENGINE_GAPS.md`), so this is checked via the
// free-text `Trigger.name` convention instead, same mechanism
// `lifegain.ts`/`etb.ts` already establish. `'onCounterAdded'` is the one
// real, checked-in convention name for this shape as of this writing
// (grepped every real FDN `definition.ts` — Exemplar of Light is the only
// card using it). **Deliberately NOT counter-type-aware** — a trigger name
// alone carries no counter-type information (unlike the producer side,
// which reads the real `counterType` field directly off the effect), so a
// future differently-typed counter-added trigger sharing this exact name
// would ambiguously satisfy every counter-type configuration that declares
// it; no such collision exists in the pool today (checked), flagged rather
// than guessed at for whenever one does.
//
// **Self-ownership: no `requireConsumerForSelfOwnership` escape hatch**
// (unlike the Battlefield-presence family) — putting a counter via a real
// `putCounter`-family effect is a genuine, deliberate AUTHORED effect (the
// same class as Bigfin Bouncer's real bounce effect or Day of Judgment's
// real destroy-all program), not bare type/subtype MEMBERSHIP the way
// merely "being a Cat" is — there's no over-match risk from every creature
// vacuously satisfying this query. The default `selfDirectProducerMatch ||
// selfConsumerMatch` rule (`card-interactions.ts`) is correct here
// unmodified.
//
// **2026-09-19, later still — two more real corrections, same day, on top
// of the "takes a `CardDefinition` directly" rewrite above:**
// 1. **Boolean-return callable contract.** `CountersSink(definition)`'s own
//    returned instances now answer `instance(candidate)` with a plain
//    `boolean` (the PRODUCER question only), not the old combined
//    `SinkMatchDetail | null`. `isPredicateDerived` is a new, separate
//    accessor carrying the one real piece of nuance a bare boolean can't
//    (see `entry.ts`'s own `SinkInstance` doc comment for the full "3rd
//    real design iteration" writeup, and `buildCounterInstance`/
//    `producerPredicate` below for the real implementation. The old
//    `deriveCounterType` (singular, first-match-wins) is now
//    `deriveCounterTypes` (plural — see next point); `withPredicates` (the
//    old `{producer, consumer}` pair) is now just `producerPredicate` (the
//    consumer half moved out of this file entirely — callers check
//    `instance.consumerTriggerNames` directly via
//    `matchesConsumerTriggerNames`, imported by THEM, not by this file
//    anymore).
// 2. **`CountersSink` returns `SinkInstance[]`, not one `SinkInstance`** —
//    live user correction: "we need array handling here obviously." A
//    driving `definition` derives one `SinkInstance` PER DISTINCT
//    `counterType` found on it, not just the first — see
//    `deriveCounterTypes`'s own doc comment for the full dedup-rule
//    writeup (exact-duplicate occurrences of the SAME `counterType`
//    collapse to one instance; a genuinely different `counterType` value
//    gets its own). Exemplar of Light (the only real driving definition in
//    the pool today) has exactly one distinct `counterType`, so this is a
//    single-element array in practice today — zero real behavior change,
//    only a widened, honest contract.
import type { CardDefinition, Effect } from '../../../card';
import { deriveOccurrences } from '../../match-sink';
import type { SinkCatalogEntry, SinkFamily, SinkInstance } from '../entry';

/** Stable SINK FAMILY key shared by every real configured instance — see
 * `SinkCatalogEntry.family`'s own doc comment (`entry.ts`) for why this
 * drives real review-status grouping, not just display. Today only 1 real
 * instance (`+1/+1`) shares it — the family grouping still applies (it
 * simply coincides with a single-member group until a real `-1/-1`/loyalty
 * sibling lands). */
const FAMILY = 'counters';

/** Returns `effect`'s own `counterType` iff it's one of the three real
 * `Effect.kind` values that put a counter (`putCounter`/`putCounterTarget`/
 * `putCounterAll`, `card.ts`) — `undefined` for every other effect kind.
 * Pure structural field read, no oracle text involved. */
function counterTypeOfEffect(effect: Effect): string | undefined {
  if (effect.kind === 'putCounter' || effect.kind === 'putCounterTarget' || effect.kind === 'putCounterAll') {
    return effect.counterType;
  }
  return undefined;
}

/**
 * `counterType`S derivation (2026-09-19, widened from a single-value
 * derivation to a real array — live correction: "we need array handling
 * here obviously" — see `entry.ts`'s own `SinkFamily` doc comment for the
 * full "`SinkFamily(definition)` returns `SinkInstance[]`, not one
 * `SinkInstance`" rewrite writeup). Walks `definition.effects` AND
 * `definition.triggers[].effects` (the same two real places
 * `deriveOccurrences`'s own `walkEffects` looks at runtime for an arbitrary
 * candidate, scoped down here to just the ONE driving definition this
 * factory is being configured from) for EVERY real
 * `putCounter`/`putCounterTarget`/`putCounterAll` effect, and returns every
 * DISTINCT `counterType` string found, in first-seen order — not just the
 * first one. Exemplar of Light's own `onLifeGain` trigger
 * (`{kind:'putCounter', counterType:'+1/+1', ...}`) is the one real hit in
 * the pool today, so this still resolves to the single-element `['+1/+1']`
 * for the one real card driving this family — zero behavior change for
 * today's real pool, only a widened contract for whenever a second,
 * differently-typed counter-granting effect lands on the same definition.
 *
 * **Dedup rule (2026-09-19, live correction — user's own explicit
 * framing)**: "we should not have any absolutely identical sinks (i.e. when
 * card has 2 locations for exactly the same effect), but any difference
 * should create separate sink." For THIS family, `counterType` is the
 * complete identity key — every other derived field a `CountersSink`
 * instance carries (`slug`/`category`/`consumerTriggerNames`) is a pure
 * function of `counterType` plus the whole `definition` (never of WHICH
 * specific occurrence produced that `counterType`), so two occurrences
 * sharing the same `counterType` genuinely produce the exact same instance
 * and must collapse to one; only a genuinely different `counterType` value
 * is a real difference worth a second instance. Deduping on the raw string
 * itself (a `Set`) is therefore the correct and COMPLETE implementation of
 * that general rule for this family — not an approximation of it. A future
 * family whose own instance identity depends on more than one field would
 * need its own, wider dedup key (whatever fields actually determine ITS
 * instance identity), not this same single-string shortcut.
 *
 * Throws if `definition` has no real counter-granting effect at all —
 * `CountersSink` only makes sense called with a card that genuinely IS this
 * family's own driving producer; silently returning nothing would hide a
 * real authoring mistake instead of surfacing it.
 */
function deriveCounterTypes(definition: CardDefinition): string[] {
  const seen = new Set<string>();
  for (const effect of definition.effects ?? []) {
    const counterType = counterTypeOfEffect(effect);
    if (counterType) seen.add(counterType);
  }
  for (const trigger of definition.triggers ?? []) {
    for (const effect of trigger.effects) {
      const counterType = counterTypeOfEffect(effect);
      if (counterType) seen.add(counterType);
    }
  }
  if (seen.size === 0) {
    throw new Error(
      `CountersSink: "${definition.name}" has no real putCounter/putCounterTarget/putCounterAll effect ` +
        `(checked definition.effects and definition.triggers[].effects) — cannot derive a counterType from it.`,
    );
  }
  return [...seen];
}

/**
 * `slug` derivation (2026-09-19) — sanitizes `counterType` into a stable,
 * deterministic identity key rather than accepting one as separately
 * authored config (the exact duplication risk the user rejected: a slug
 * authored by hand can drift out of sync with the counter type it's
 * supposedly naming). `'+1/+1'` -> lowercase, `+` replaced with the word
 * `plus`, every remaining non-alphanumeric character (the `/`) stripped,
 * prefixed with `'counters-'` -> `'counters-plus1plus1'` — reproduces the
 * real, pre-existing slug byte-for-byte, so every filesystem/review-status
 * convention keyed off `entry.slug` (`sink-catalog-status.ts`'s
 * `sourceFileFor`/`computeSinkCatalogFingerprint`/`memberEvidenceFor`, all
 * of which resolve `catalog/${slug}.ts`/`catalog/${slug}.corpus.json`
 * directly) keeps resolving to the real, unrenamed
 * `catalog/counters-plus1plus1.ts`/`.corpus.json` files with zero changes
 * needed there. A hypothetical future `'-1/-1'` sibling derives
 * `'counters-minus1minus1'` the same way.
 */
function slugForCounterType(counterType: string): string {
  const sanitized = counterType
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/-/g, 'minus')
    .replace(/[^a-z0-9]/g, '');
  return `counters-${sanitized}`;
}

/**
 * Recognized `Trigger.name` spellings for "this card reacts to a counter
 * being added to it" (2026-09-19) — a genuine, explicit, family-owned
 * allowlist, NOT a computed value derived from some other structural
 * signal. `card.ts`'s `Trigger.on` closed enum has no counter-added member
 * yet (a real, tracked gap — `ENGINE_GAPS.md`), so there is no real,
 * structural way for a trigger to SAY "I react to a counter being added"
 * other than its own free-text `name`.
 *
 * Investigated (per this task's own explicit instruction) whether "this
 * trigger has no `on` field at all" was ALREADY a meaningful, reserved
 * discriminator for this shape elsewhere in the codebase before assuming
 * it — it is NOT: `card.ts`'s own `Trigger.on` doc comment documents dozens
 * of real, currently-shipped FDN/FIN triggers that are name-only (no `on`
 * set) for reasons entirely unrelated to "reacts to a counter" — not yet
 * retrofitted onto a closed auto-fire occasion, fired only by a scenario's
 * own `Scenario.trigger` field, or simply a mechanic this schema has no
 * `on` vocabulary for at all yet (e.g. `'castNoncreatureSpell'`-family gaps
 * predating this pass). Using "no `on` field" alone as the discriminator
 * would over-match: ANY manually-named trigger a card happens to carry
 * would get swept into "reacts to counters," regardless of what it's
 * actually for.
 *
 * The one real signal that DOES exist and IS already an established,
 * checked-in convention (per this family's own pre-2026-09-19 header
 * comment) is the literal name `'onCounterAdded'` itself (grepped every
 * real FDN `definition.ts` as of this writing — Exemplar of Light is the
 * only card using it). Kept here as a small, explicit allowlist so a
 * second real card establishing a differently-spelled convention for the
 * same idea is a deliberate one-line addition, not a guess — and so this
 * factory's own derivation reuses the SAME real convention name the old,
 * hand-authored `consumerTriggerNames: ['onCounterAdded']` config already
 * relied on, rather than inventing a new rule.
 */
const COUNTER_ADDED_TRIGGER_NAMES = ['onCounterAdded'];

/**
 * `consumerTriggerNames` derivation (2026-09-19) — scans `definition`'s own
 * `triggers` (front face only; `definition` here is the ONE driving card
 * this factory is being configured from, not an arbitrary runtime
 * candidate — `matchesConsumerTriggerNames` is what later checks an
 * arbitrary candidate's front AND back face against the returned list) for
 * a trigger whose `name` is in `COUNTER_ADDED_TRIGGER_NAMES` above. As an
 * extra safety margin against the exact over-match risk that section's own
 * doc comment describes, a trigger that ALREADY carries a real `on` value
 * is skipped even if its name happens to collide — a trigger with a real,
 * closed auto-fire occasion already has its real reason to exist recorded
 * structurally; a free-text name coincidentally matching this convention on
 * top of that would be a name collision, not a genuine second signal.
 * Exemplar of Light's own `onCounterAdded` trigger (no `on` field, name
 * matches) is the one real hit; its `onLifeGain` trigger is correctly
 * excluded (real `on: 'lifeGained'` value). Returns `undefined` (not an
 * empty array) when nothing matches, mirroring the pre-existing "omitted
 * for a hypothetical future configuration with no real consumer-naming
 * convention in the pool yet" contract `SinkCatalogEntry.consumerTriggerNames`
 * already documents.
 */
function deriveConsumerTriggerNames(definition: CardDefinition): string[] | undefined {
  const names = (definition.triggers ?? []).filter((trigger) => !trigger.on && COUNTER_ADDED_TRIGGER_NAMES.includes(trigger.name)).map((trigger) => trigger.name);
  return names.length > 0 ? names : undefined;
}

/**
 * The MIDDLE step of the `Self Definition -> Sink -> (Predicates) ->
 * Candidate Definition` chain (`SINK_MODEL_DESIGN.md`), made a real, named
 * piece of code instead of anonymous matching logic buried inside the
 * sink's own callable closure. `producerPredicate(counterType)` closes over
 * this ONE configured instance's own `counterType` and returns the ONE real
 * predicate function `buildCounterInstance` below needs.
 *
 * **2026-09-19, later still, boolean-return rewrite** — this used to be
 * `withPredicates(counterType, consumerTriggerNames)`, returning a
 * `{producer, consumer}` pair (`consumer` calling `matchesConsumerTriggerNames`
 * internally). The CONSUMER half is gone from here entirely now: the
 * callable itself only ever answers the producer question (a plain
 * `boolean` — see `entry.ts`'s own `SinkInstance` doc comment for the full
 * "3rd real design iteration on this callable contract" writeup), and the
 * consumer check is called directly, against this instance's own plain
 * `consumerTriggerNames` DATA field (still assigned onto the returned
 * `SinkInstance` below, unchanged), by whichever caller actually needs it
 * (`card-interactions.ts`, `server/api/sink-catalog/index.get.ts`) — not
 * funneled through this family's own closure at all anymore.
 */
function producerPredicate(counterType: string) {
  /** Does `candidate` itself structurally PUT a counter of `counterType`?
   * Direct structural inspection — no `SinkQuery`/`matchSink` involved (see
   * this file's own header for the full 2026-09-18 rewrite writeup).
   * `deriveOccurrences` IS the real "produced from the card definition"
   * machinery (walks `candidate`'s own effects/triggers/program AST) —
   * reused here directly rather than reimplemented. */
  return (candidate: CardDefinition, root: string) => {
    return deriveOccurrences(candidate, root).find((occ) => {
      if (occ.event !== 'putCounter' || occ.counterType !== counterType) return false;
      // The one real constraint the old `SinkQuery{controller:'you'}` field
      // contributed — mirrors `match-sink.ts`'s own private
      // `effectiveController`/`sidesCompatible` helpers byte-for-byte in
      // logic (not imported — this change must not touch `match-sink.ts`'s
      // own exports): a `putCounter`/`putCounterTarget`/`putCounterAll`
      // occurrence never sets `controller` directly (only a `target:'self'`
      // self-directed `putCounter` implies `'you'`), so an occurrence with
      // NO resolvable controller at all is compatible by construction; only
      // an occurrence explicitly resolving to `'opp'` (a program-AST-derived
      // broadcast over an `opponents` pool) is genuinely incompatible.
      const controller = occ.controller ?? (occ.subject === 'self' || occ.target === 'self' ? 'you' : undefined);
      return !controller || controller === 'you';
    });
  };
}

/**
 * Builds ONE real, fully-configured, invocable `SinkInstance` for exactly
 * one `counterType` derived off `definition` (2026-09-19, split out of the
 * factory body itself so `CountersSink` below can call this once per
 * distinct `counterType` — see `deriveCounterTypes`'s own doc comment for
 * the full array-of-instances rewrite writeup). `consumerTriggerNames` is
 * computed ONCE by the caller (off `definition` as a whole, not per
 * `counterType` — see `deriveConsumerTriggerNames`'s own doc comment for why
 * this stays deliberately NOT counter-type-aware) and passed in rather than
 * re-derived per instance.
 */
function buildCounterInstance(definition: CardDefinition, counterType: string, consumerTriggerNames: string[] | undefined): SinkInstance {
  const slug = slugForCounterType(counterType);
  const category = counterType;
  const producer = producerPredicate(counterType);

  // **2026-09-19, boolean-return rewrite** — the callable itself answers
  // ONLY the producer question now, as a plain `boolean` (the user's own
  // explicit target shape — see `entry.ts`'s own `SinkInstance` doc comment
  // for the full "3rd real design iteration" writeup). `isPredicateDerived`
  // carries the one real piece of nuance a bare boolean can't (whether the
  // match came from a sink-derivation predicate rather than a direct
  // effect/trigger walk) as its own small, separate accessor — `card-
  // interactions.ts`'s `matchEntry` is the one real caller that needs it.
  const sink = ((candidate: CardDefinition, root: string = process.cwd()): boolean => {
    return !!producer(candidate, root);
  }) as SinkInstance;
  sink.isPredicateDerived = (candidate: CardDefinition, root: string = process.cwd()) => !!producer(candidate, root)?.predicateDerived;

  const data: SinkCatalogEntry = {
    slug,
    category,
    ...(consumerTriggerNames ? { consumerTriggerNames } : {}),
    family: FAMILY,
  };
  Object.assign(sink, data);
  return sink;
}

/**
 * The shared factory — `CountersSink(definition)` derives, from
 * `definition`'s own real structural fields, and returns EVERY real, fully-
 * configured, invocable `SinkInstance` for each DISTINCT counter type
 * `definition` itself grants (2026-09-19, widened from returning one
 * `SinkInstance` to `SinkInstance[]` — see `deriveCounterTypes`'s own doc
 * comment for the full array/dedup rewrite writeup, and this file's own
 * header for the earlier 2026-09-19 "takes a real `CardDefinition`, not a
 * config object" rewrite). Exemplar of Light (the one real driving
 * definition in the pool today) derives exactly one distinct `counterType`
 * (`'+1/+1'`), so this resolves to a single-element array — zero real
 * behavior change for today's pool. A real `SinkFamily<CardDefinition>`
 * value.
 */
export const CountersSink: SinkFamily<CardDefinition> = (definition) => {
  const counterTypes = deriveCounterTypes(definition);
  const consumerTriggerNames = deriveConsumerTriggerNames(definition);
  return counterTypes.map((counterType) => buildCounterInstance(definition, counterType, consumerTriggerNames));
};
