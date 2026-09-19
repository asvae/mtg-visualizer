// Matcher catalog FAMILY: Counters — a `CountersMatcher` factory parametrized per
// real `Effect.counterType` string (`card.ts`'s `putCounter`/
// `putCounterTarget`/`putCounterAll` all carry this SAME `counterType:
// string` field), rather than a bare, type-blind "counters" bucket the way
// `synergy.ts`'s own legacy `describeFact` vocabulary collapses every
// counter type into. Today only `+1/+1` is a real, currently-existing
// configuration — see `../counters-plus1plus1.ts` (the reusable factory and
// the curated per-instance configuration deliberately don't share a module,
// same family-vs-instance split `battlefield-presence.ts` establishes) for
// the real motivating card, Exemplar of Light (FDN #11): a genuine
// self-referential producer/consumer LOOP —
//   - "Whenever you gain life, put a +1/+1 counter on this creature" —
//     Lifegain CONSUMER (`lifegain.ts`'s own `consumerTriggerNames`) +
//     Counters PRODUCER (a real `kind:'putCounter', counterType:'+1/+1'`
//     effect).
//   - "Whenever one or more counters are put on this creature, draw a
//     card" — Counters CONSUMER (this configuration's own
//     `consumerTriggerNames`/`consumerTriggerOn`).
//
// `CountersMatcher(definition: CardDefinition): Matcher[]` derives every
// field (`counterType`(s)/`slug`/`consumerTriggerNames`/`consumerTriggerOn`)
// from `definition`'s own real structural fields — no hand-authored config
// object exists, since every fact this factory needs already lives on the
// card's own `CardDefinition` and a parallel config would just be a second,
// driftable copy of the same data.
//
// **Producer matching** reuses `deriveOccurrences(candidate, root)`
// (`match-query.ts`) — the same real, structural, `CardDefinition`-derived
// occurrence walk every other matcher family builds on — and inspects the
// result directly rather than going through a `MatcherQuery`/`matchQuery` call:
// each matcher family's matcher inspects the candidate as real code in its own
// function body, not a query object handed to a generic comparator.
import type { CardDefinition, Effect, TriggerOnValue } from '../../../card';
import { triggerCounterAddedMatch, triggerOn } from '../../../card';
import { staticAttrsFor } from '../../../synergy';
import { deriveOccurrences, satisfiesType } from '../../match-query';
import type { MatcherCatalogEntry, MatcherFamily, Matcher } from '../entry';

/** Stable MATCHER FAMILY key shared by every real configured instance — see
 * `MatcherCatalogEntry.family`'s own doc comment (`entry.ts`) for why this
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
 * Walks `definition.effects` AND `definition.triggers[].effects` (the same
 * two real places `deriveOccurrences`'s own `walkEffects` looks at runtime
 * for an arbitrary candidate, scoped down here to just the ONE driving
 * definition this factory is being configured from) for every real
 * `putCounter`/`putCounterTarget`/`putCounterAll` effect, UNIONED with
 * `counterTypesFromConsumerTrigger` below (a card can name a real
 * `counterType` via a consumer-only `on:'counterAdded'` trigger with no
 * separate producer effect at all), and returns every DISTINCT `counterType`
 * string found, in first-seen order.
 *
 * **Dedup rule**: `counterType` is this family's complete instance identity
 * key — every other derived field (`slug`/`category`/`consumerTriggerNames`)
 * is a pure function of `counterType` plus the whole `definition`, never of
 * WHICH specific occurrence produced that `counterType` — so two occurrences
 * sharing the same `counterType` produce the exact same instance and must
 * collapse to one; only a genuinely different `counterType` value is a real
 * difference worth a second instance. A future family whose own instance
 * identity depends on more than one field would need its own, wider dedup
 * key.
 *
 * Throws when both signals (producer effects, consumer trigger) come up
 * empty — `CountersMatcher` only makes sense called with a card that genuinely
 * IS this family's own driving producer OR consumer; silently returning
 * nothing would hide a real authoring mistake instead of surfacing it.
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
  for (const counterType of counterTypesFromConsumerTrigger(definition)) {
    seen.add(counterType);
  }
  if (seen.size === 0) {
    throw new Error(
      `CountersMatcher: "${definition.name}" has no real putCounter/putCounterTarget/putCounterAll effect and no ` +
        `real 'counterAdded' consumer trigger with a counterAddedMatch.counterType ` +
        `(checked definition.effects, definition.triggers[].effects, and definition.triggers[].counterAddedMatch) ` +
        `— cannot derive a counterType from it.`,
    );
  }
  return [...seen];
}

/**
 * Real, structural CONSUMER-side `counterType` signal — every distinct
 * `counterType` named by a `definition.triggers[]` entry whose own
 * `on === 'counterAdded'` and `counterAddedMatch?.counterType` is set (front
 * face only, same scoping `deriveCounterTypes`'s own effect walk uses). A
 * trigger with `on === 'counterAdded'` but no `counterAddedMatch.counterType`
 * (Forge's real "any counter type" case, `CounterType$` param absent) is
 * deliberately skipped — it names no SPECIFIC counter type to derive a
 * `CountersMatcher` instance's own identity from.
 */
function counterTypesFromConsumerTrigger(definition: CardDefinition): string[] {
  const seen = new Set<string>();
  for (const trigger of definition.triggers ?? []) {
    const counterAddedMatch = triggerCounterAddedMatch(trigger);
    if (triggerOn(trigger) === 'counterAdded' && counterAddedMatch?.counterType) {
      seen.add(counterAddedMatch.counterType);
    }
  }
  return [...seen];
}

/**
 * Sanitizes `counterType` into a stable, deterministic identity key rather
 * than accepting one as separately authored config (a hand-authored slug can
 * drift out of sync with the counter type it's supposedly naming).
 * `'+1/+1'` -> lowercase, `+`/`-` spelled out, remaining non-alphanumerics
 * stripped, prefixed `'counters-'` -> `'counters-plus1plus1'` — reproduces
 * the real, pre-existing slug byte-for-byte, so every filesystem/
 * review-status convention keyed off `entry.slug`
 * (`matcher-catalog-status.ts`'s `sourceFileFor`/`computeMatcherCatalogFingerprint`/
 * `memberEvidenceFor`, all of which resolve
 * `catalog/${slug}.ts`/`catalog/${slug}.corpus.json` directly) keeps
 * resolving to the real `catalog/counters-plus1plus1.ts`/`.corpus.json`
 * files on disk. A hypothetical future `'-1/-1'` sibling derives
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
 * being added to it" — a genuine, explicit, family-owned allowlist, NOT a
 * computed value derived from some other structural signal. Kept as the
 * FALLBACK path for a hypothetical differently-spelled name-only trigger
 * with no real `on` value at all; `deriveConsumerTriggerOn` below is the
 * PRIMARY, structurally-safer signal for any trigger that sets the real
 * `on: 'counterAdded'` value (every real card in the pool today does, so
 * this allowlist currently matches nothing live).
 *
 * "No `on` field at all" is deliberately NOT itself treated as a signal for
 * this shape — `card.ts`'s own `Trigger.on` doc comment documents dozens of
 * real, currently-shipped FDN/FIN triggers that are name-only for reasons
 * entirely unrelated to counters (not yet retrofitted onto a closed
 * auto-fire occasion, fired only by a scenario's own `Scenario.trigger`
 * field, or a mechanic this schema has no `on` vocabulary for at all yet).
 * Using "no `on` field" alone would over-match: any manually-named trigger a
 * card happens to carry would get swept into "reacts to counters" regardless
 * of what it's actually for.
 */
const COUNTER_ADDED_TRIGGER_NAMES = ['onCounterAdded'];

/**
 * Scans `definition`'s own `triggers` (front face only — `definition` here
 * is the ONE driving card this factory is being configured from, not an
 * arbitrary runtime candidate; `matchesConsumerTriggerNames` is what later
 * checks an arbitrary candidate's front AND back face against the returned
 * list) for a trigger whose `name` is in `COUNTER_ADDED_TRIGGER_NAMES`
 * above. A trigger that already carries a real `on` value is skipped even if
 * its name happens to collide — it's handled by the structurally-safer
 * `deriveConsumerTriggerOn` below instead; a free-text name coincidentally
 * matching this convention on top of a real `on` value would be a name
 * collision, not a genuine second signal. Returns `undefined` (not an empty
 * array) when nothing matches, mirroring
 * `MatcherCatalogEntry.consumerTriggerNames`'s own "omitted, not empty"
 * contract.
 */
function deriveConsumerTriggerNames(definition: CardDefinition): string[] | undefined {
  const names = (definition.triggers ?? []).filter((trigger) => !triggerOn(trigger) && COUNTER_ADDED_TRIGGER_NAMES.includes(trigger.name)).map((trigger) => trigger.name);
  return names.length > 0 ? names : undefined;
}

/**
 * The structurally-safer sibling to `deriveConsumerTriggerNames` above,
 * mirroring `etb.ts`'s own `consumerTriggerOn: ['enter']` precedent (see
 * `MatcherCatalogEntry.consumerTriggerOn`'s own doc comment, `catalog/entry.ts`,
 * for the full "genuinely safer than `consumerTriggerNames`, no
 * name-collision risk" reasoning). Returns `['counterAdded']` iff
 * `definition` (front face only) has at least one trigger with the real
 * `on: 'counterAdded'` value — `undefined` otherwise, same "omitted, not
 * empty array" contract. Checked via `match-query.ts`'s own
 * `matchesConsumerTriggerOn` at the caller side (`card-interactions.ts`),
 * same as every other `consumerTriggerOn`-declaring entry.
 */
function deriveConsumerTriggerOn(definition: CardDefinition): Array<TriggerOnValue> | undefined {
  const hasCounterAddedTrigger = (definition.triggers ?? []).some((trigger) => triggerOn(trigger) === 'counterAdded');
  return hasCounterAddedTrigger ? ['counterAdded'] : undefined;
}

/**
 * The MIDDLE step of the `Self Definition -> Sink -> (Predicates) ->
 * Candidate Definition` chain (`MATCHER_MODEL_DESIGN.md`), made a real, named
 * piece of code instead of anonymous matching logic buried inside the
 * sink's own callable closure. `producerPredicate` closes over this ONE
 * configured instance's own `counterType`/`ownName`/`ownTypes` and returns
 * the real predicate function `buildCounterInstance` below needs; the
 * callable itself only ever answers the producer question (a plain
 * `boolean` — see `entry.ts`'s own `Matcher` doc comment). The consumer
 * check is a separate concern, called directly against this instance's own
 * plain `consumerTriggerNames`/`consumerTriggerOn` DATA fields by whichever
 * caller needs it (`card-interactions.ts`, `server/api/sink-catalog/
 * index.get.ts`), not funneled through this family's own closure.
 */
function producerPredicate(counterType: string, ownName: string, ownTypes: string[]) {
  /** Does `candidate` itself structurally PUT a counter of `counterType` on
   * a card another candidate could actually be? `deriveOccurrences` IS the
   * real "produced from the card definition" machinery (walks `candidate`'s
   * own effects/triggers/program AST) — reused here directly.
   *
   * `occ.target` matters here, not just `event`/`counterType`/`controller`:
   * a `putCounter` occurrence with `target: 'self'` can only ever land the
   * counter on the SAME card that owns the effect — it structurally can
   * never reach a different candidate. `ownName`/`ownTypes` (the driving
   * definition's own identity) are what let this distinguish "Exemplar of
   * Light's own self-targeted trigger is genuinely its own producer" (the
   * real self-loop this family exists for) from "a self-only producer can
   * never satisfy any OTHER card's sink" (the false-positive this closure
   * used to return before this check existed). A type-constrained target
   * (`putCounterTarget`/chosen-target `putCounter`/`putCounterAll`) is
   * checked against `ownTypes` via `satisfiesType`, the same machinery
   * `match-query.ts`'s own `occurrenceSatisfiesQuery` uses for the equivalent
   * same-shape check on other sink families. An occurrence with no `target`
   * at all (an untyped program-AST-derived broadcast) carries no
   * restriction to check, so it passes through unconditionally. */
  return (candidate: CardDefinition, root: string) => {
    return deriveOccurrences(candidate, root).find((occ) => {
      if (occ.event !== 'putCounter' || occ.counterType !== counterType) return false;
      // The one real constraint the old `MatcherQuery{controller:'you'}` field
      // contributed: a putCounter occurrence never sets `controller`
      // directly (only a `target:'self'`-shaped occurrence implies `'you'`),
      // so no resolvable controller is compatible by construction; only an
      // occurrence explicitly resolving to `'opp'` is genuinely incompatible.
      const controller = occ.controller ?? (occ.subject === 'self' || occ.target === 'self' ? 'you' : undefined);
      if (controller && controller !== 'you') return false;
      if (occ.target === 'self') return candidate.name === ownName;
      if (occ.target) return satisfiesType(ownTypes, occ.target.types);
      return true;
    });
  };
}

/**
 * Builds ONE real, fully-configured, invocable `Matcher` for exactly
 * one `counterType` derived off `definition` — see `deriveCounterTypes`'s
 * own doc comment for the array-of-instances contract this is called once
 * per distinct `counterType` under. `consumerTriggerNames`/
 * `consumerTriggerOn` are computed ONCE by the caller (off `definition` as a
 * whole, not per `counterType` — deliberately NOT counter-type-aware, since
 * a trigger name/`on` value alone carries no counter-type information) and
 * passed in rather than re-derived per instance.
 *
 * **No `requireConsumerForSelfOwnership` escape hatch** (unlike
 * Battlefield-presence) — putting a counter via a real `putCounter`-family
 * effect is a genuine, deliberate AUTHORED effect, not bare type/subtype
 * MEMBERSHIP the way merely "being a Cat" is, so there's no over-match risk
 * from every creature vacuously satisfying this query; the default
 * `selfDirectProducerMatch || selfConsumerMatch` rule
 * (`card-interactions.ts`) is correct here unmodified.
 */
function buildCounterInstance(
  definition: CardDefinition,
  counterType: string,
  consumerTriggerNames: string[] | undefined,
  consumerTriggerOn: Array<TriggerOnValue> | undefined,
): Matcher {
  const slug = slugForCounterType(counterType);
  const category = counterType;
  const ownName = definition.name;
  const ownTypes = staticAttrsFor(definition).types;
  const producer = producerPredicate(counterType, ownName, ownTypes);

  // `isPredicateDerived` carries the one real piece of nuance a bare boolean
  // can't (whether the match came from a sink-derivation predicate rather
  // than a direct effect/trigger walk) — see `entry.ts`'s own `Matcher`
  // doc comment. `card-interactions.ts`'s `matchEntry` is the one real
  // caller that needs it.
  const sink = ((candidate: CardDefinition, root: string = process.cwd()): boolean => {
    return !!producer(candidate, root);
  }) as Matcher;
  sink.isPredicateDerived = (candidate: CardDefinition, root: string = process.cwd()) => !!producer(candidate, root)?.predicateDerived;

  const data: MatcherCatalogEntry = {
    slug,
    category,
    ...(consumerTriggerNames ? { consumerTriggerNames } : {}),
    ...(consumerTriggerOn ? { consumerTriggerOn } : {}),
    family: FAMILY,
  };
  Object.assign(sink, data);
  return sink;
}

/**
 * The shared factory — `CountersMatcher(definition)` derives, from
 * `definition`'s own real structural fields, and returns EVERY real, fully-
 * configured, invocable `Matcher` for each DISTINCT counter type
 * `definition` itself grants (see `deriveCounterTypes`'s own doc comment for
 * the dedup rule). Exemplar of Light (the one real driving definition in the
 * pool today) derives exactly one distinct `counterType` (`'+1/+1'`), so
 * this resolves to a single-element array today. A real
 * `MatcherFamily<CardDefinition>` value.
 */
export const CountersMatcher: MatcherFamily<CardDefinition> = (definition) => {
  const counterTypes = deriveCounterTypes(definition);
  const consumerTriggerNames = deriveConsumerTriggerNames(definition);
  const consumerTriggerOn = deriveConsumerTriggerOn(definition);
  return counterTypes.map((counterType) => buildCounterInstance(definition, counterType, consumerTriggerNames, consumerTriggerOn));
};
