// Sink catalog FAMILY: Counters — a genuine, reusable `CountersSink` factory
// (2026-09-18 refactor), parametrized per real `Effect.counterType` string
// (`card.ts`'s `putCounter`/`putCounterTarget`/`putCounterAll` all carry
// this SAME `counterType: string` field) rather than a bare, type-blind
// "counters" bucket the way `synergy.ts`'s own legacy `describeFact`
// vocabulary collapses every counter type into. Today only `+1/+1` is a
// real, currently-existing configuration — see this file's own header
// history (`counters-plus1plus1.ts`, now folded in here) for the real
// motivating card, Exemplar of Light (FDN #11): a genuine self-referential
// producer/consumer LOOP —
//   - "Whenever you gain life, put a +1/+1 counter on this creature" —
//     Lifegain CONSUMER (`lifegain.ts`'s own `consumerTriggerNames`) +
//     Counters PRODUCER (a real `kind:'putCounter', counterType:'+1/+1'`
//     effect — it genuinely puts the counter).
//   - "Whenever one or more counters are put on this creature, draw a
//     card" — Counters CONSUMER (this configuration's own
//     `consumerTriggerNames`).
//
// **Producer** (`query`) — reuses the EXISTING generic `putCounter`
// `ProducerOccurrence` `match-sink.ts`'s `walkEffects` already derives for
// EVERY `putCounter`/`putCounterTarget`/`putCounterAll` effect (each
// already carries its own real `counterType` on the occurrence, and
// `occurrenceSatisfiesSink`'s event-vs-event branch already compares
// `p.counterType`/`w.counterType` by plain equality) — no new occurrence or
// matcher code needed at all, ever, for a new counter type; a future
// `CountersSink({counterType:'-1/-1', ...})`/`CountersSink({counterType:
// 'loyalty', ...})` configuration is the exact same shape, zero new code in
// `match-sink.ts` — this factory is exactly the generalization this
// family's own original header comment already anticipated.
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
import type { CardDefinition } from '../../card';
import { matchesConsumerTriggerNames, matchSink } from '../match-sink';
import type { SinkQuery } from '../sink-query';
import type { SinkCatalogEntry, SinkFamily, SinkInstance, SinkMatchDetail } from './entry';

/** Stable SINK FAMILY key shared by every real configured instance below —
 * see `SinkCatalogEntry.family`'s own doc comment (`entry.ts`) for why this
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
   * `'+1/+1'`. */
  counterType: string;
  /** The real display category — e.g. `'Counters (+1/+1)'`. */
  category: string;
  /** Real, structural CONSUMER-side `Trigger.name` list — see this file's
   * own header for why this is deliberately NOT counter-type-aware.
   * Omitted for a hypothetical future configuration with no real
   * consumer-naming convention in the pool yet. */
  consumerTriggerNames?: string[];
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
  const { slug, counterType, category, consumerTriggerNames } = config;
  const query: SinkQuery = { category, event: 'putCounter', counterType, controller: 'you' };

  const sink = ((candidate: CardDefinition, root: string = process.cwd()): SinkMatchDetail | null => {
    const producer = matchSink(query, candidate, root);
    const consumerMatched = matchesConsumerTriggerNames(consumerTriggerNames, candidate);
    if (!producer.matched && !consumerMatched) return null;
    const detail: SinkMatchDetail = {};
    if (producer.matched) detail.producer = { via: producer.via!, predicateDerived: producer.predicateDerived };
    if (consumerMatched) detail.consumer = { via: 'triggerName' };
    return detail;
  }) as SinkInstance;

  const data: SinkCatalogEntry = {
    slug,
    query,
    ...(consumerTriggerNames ? { consumerTriggerNames } : {}),
    family: FAMILY,
  };
  Object.assign(sink, data);
  return sink;
};

// ---------------------------------------------------------------------------
// The 1 real, currently-existing configuration. A future `-1/-1`/loyalty
// sibling would be exactly one more `CountersSink({...})` call here.

export const countersPlus1Plus1: SinkInstance = CountersSink({
  slug: 'counters-plus1plus1',
  counterType: '+1/+1',
  category: 'Counters (+1/+1)',
  consumerTriggerNames: ['onCounterAdded'],
});
