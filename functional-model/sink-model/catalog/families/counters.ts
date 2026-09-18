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
// needed at all, ever, for a new counter type; a future
// `CountersSink({counterType:'-1/-1', ...})`/`CountersSink({counterType:
// 'loyalty', ...})` configuration is the exact same shape, zero new code in
// `match-sink.ts` — this factory is exactly the generalization this
// family's own original header comment already anticipated.
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
// **Consumer** (`consumerTriggerNames`, optional per configuration) — same
// gap as `etb.ts`'s own Dazzling Angel fix: "whenever one or more counters
// are put on this creature" has no real `Trigger.on` value today (`card.ts`'s
// closed enum has no counter-added member — `ENGINE_GAPS.md`), so this is
// checked via the free-text `Trigger.name` convention instead, same
// mechanism `lifegain.ts`/`etb.ts` already establish. `'onCounterAdded'` is
// the one real, checked-in convention name for this shape as of this
// writing (grepped every real FDN `definition.ts` — Exemplar of Light is
// the only card using it). **Deliberately NOT counter-type-aware** — a
// trigger name alone carries no counter-type information (unlike the
// producer side, which reads the real `counterType` field directly off the
// effect), so a future differently-typed counter-added trigger sharing this
// exact name would ambiguously satisfy every counter-type configuration
// that declares it; no such collision exists in the pool today (checked),
// flagged rather than guessed at for whenever one does.
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
import type { CardDefinition } from '../../../card';
import { deriveOccurrences, matchesConsumerTriggerNames } from '../../match-sink';
import type { SinkCatalogEntry, SinkFamily, SinkInstance, SinkMatchDetail } from '../entry';

/** Stable SINK FAMILY key shared by every real configured instance — see
 * `SinkCatalogEntry.family`'s own doc comment (`entry.ts`) for why this
 * drives real review-status grouping, not just display. Today only 1 real
 * instance (`+1/+1`) shares it — the family grouping still applies (it
 * simply coincides with a single-member group until a real `-1/-1`/loyalty
 * sibling lands). */
const FAMILY = 'counters';

export interface CountersSinkConfig {
  /** Stable identity key — unchanged real slug (`counters-plus1plus1`),
   * still a real review-status key and URL path. */
  slug: string;
  /** Real `Effect.counterType` this configuration cares about — e.g.
   * `'+1/+1'`. Also THE real display category verbatim (2026-09-18: no
   * separate `category` field — see `getName` below — the counter-type
   * string already IS the exact display label wanted, so a parallel
   * `category: '+1/+1'` field would be pure duplication with a real risk of
   * drifting out of sync with `counterType`). */
  counterType: string;
  /** Real, structural CONSUMER-side `Trigger.name` list — see this file's
   * own header for why this is deliberately NOT counter-type-aware.
   * Omitted for a hypothetical future configuration with no real
   * consumer-naming convention in the pool yet. */
  consumerTriggerNames?: string[];
}

/** The real display category, derived from `config`'s own structural
 * fields rather than authored as a separate, independently-typeable field
 * (2026-09-18) — see `CountersSinkConfig.counterType`'s own doc comment.
 * Trivial for this family: the counter-type string already is the exact
 * label wanted (`'+1/+1'`, a hypothetical future `'-1/-1'`/`'loyalty'`, ...).
 * See `BattlefieldPresenceSink`'s own `getName` (`battlefield-presence.ts`)
 * for the sibling family's less-trivial version of this same derivation. */
function getName(config: CountersSinkConfig): string {
  return config.counterType;
}

/**
 * The shared factory — `CountersSink(config)` returns ONE real, fully-
 * configured, invocable `SinkInstance` for `config.counterType`. See
 * `BattlefieldPresenceSink`'s own doc comment (`battlefield-presence.ts`)
 * for the identical "every existing consumer still reads plain data fields;
 * calling the returned value directly is the new, additive capability"
 * shape — this factory follows it exactly. A real `SinkFamily<...>` value.
 */
export const CountersSink: SinkFamily<CountersSinkConfig> = (config) => {
  const { slug, counterType, consumerTriggerNames } = config;
  const category = getName(config);

  const sink = ((candidate: CardDefinition, root: string = process.cwd()): SinkMatchDetail | null => {
    // Direct structural inspection of `candidate` — no `SinkQuery`/`matchSink`
    // involved (see this file's own header for the full 2026-09-18 rewrite
    // writeup). `deriveOccurrences` IS the real "produced from the card
    // definition" machinery (walks `candidate`'s own effects/triggers/
    // program AST) — reused here directly rather than reimplemented; only
    // the MATCHING condition itself is now inline, real code instead of a
    // reified query object handed to a generic comparator.
    const occurrence = deriveOccurrences(candidate, root).find((occ) => {
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
    const consumerMatched = matchesConsumerTriggerNames(consumerTriggerNames, candidate);
    if (!occurrence && !consumerMatched) return null;
    const detail: SinkMatchDetail = {};
    if (occurrence) detail.producer = { via: occurrence.via, predicateDerived: occurrence.predicateDerived };
    if (consumerMatched) detail.consumer = { via: 'triggerName' };
    return detail;
  }) as SinkInstance;

  const data: SinkCatalogEntry = {
    slug,
    category,
    ...(consumerTriggerNames ? { consumerTriggerNames } : {}),
    family: FAMILY,
  };
  Object.assign(sink, data);
  return sink;
};
