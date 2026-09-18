// Sink catalog entry: Counters (+1/+1) — the first real member of a
// GENERAL "puts a counter of a given type" family, parametrized per real
// `Effect.counterType` string (`card.ts`'s `putCounter`/`putCounterTarget`/
// `putCounterAll` all carry this SAME `counterType: string` field) rather
// than a bare, type-blind "counters" bucket the way `synergy.ts`'s own
// legacy `describeFact` vocabulary collapses every counter type into.
//
// Real motivating card: Exemplar of Light (FDN #11) — a genuine
// self-referential producer/consumer LOOP, same worked-example shape this
// project's own task brief names:
//   - "Whenever you gain life, put a +1/+1 counter on this creature" —
//     Lifegain CONSUMER (`lifegain.ts`'s own `consumerTriggerNames`) +
//     Counters PRODUCER (a real `kind:'putCounter', counterType:'+1/+1'`
//     effect — it genuinely puts the counter).
//   - "Whenever one or more counters are put on this creature, draw a
//     card" — Counters CONSUMER (this entry's own `consumerTriggerNames`).
//
// **Producer** (`query` below) — reuses the EXISTING generic `putCounter`
// `ProducerOccurrence` `match-sink.ts`'s `walkEffects` already derives for
// EVERY `putCounter`/`putCounterTarget`/`putCounterAll` effect (each
// already carries its own real `counterType` on the occurrence, and
// `occurrenceSatisfiesSink`'s event-vs-event branch already compares
// `p.counterType`/`w.counterType` by plain equality) — no new occurrence or
// matcher code needed at all, only a curated query naming the specific
// `counterType` this entry cares about. This is the "one shared matcher,
// label parametrized per counter type" the task asked for: a future
// `counters-minus1minus1.ts`/`counters-loyalty.ts` sibling would be the
// exact same shape, just a different `counterType`/`category` pair — zero
// new code in `match-sink.ts` either.
//
// **Consumer** (`entry.consumerTriggerNames` below) — same gap as `etb.ts`'s
// own Dazzling Angel fix: "whenever one or more counters are put on this
// creature" has no real `Trigger.on` value today (`card.ts`'s closed enum
// has no counter-added member — `ENGINE_GAPS.md`), so this is checked via
// the free-text `Trigger.name` convention instead, same mechanism
// `lifegain.ts`/`etb.ts` already established. `'onCounterAdded'` is the one
// real, checked-in convention name for this shape as of this writing
// (grepped every real FDN `definition.ts` — Exemplar of Light is the only
// card using it). **Deliberately NOT counter-type-aware** — a trigger name
// alone carries no counter-type information (unlike the producer side,
// which reads the real `counterType` field directly off the effect), so a
// future differently-typed counter-added trigger sharing this exact name
// would ambiguously satisfy every counter-type entry that declares it; no
// such collision exists in the pool today (checked), flagged rather than
// guessed at for whenever one does.
//
// **Self-ownership: no `requireConsumerForSelfOwnership` escape hatch**
// (unlike the Battlefield-presence pair) — reasoned through per the task's
// own instruction: putting a `+1/+1` counter via a real `putCounter`-family
// effect is a genuine, deliberate AUTHORED effect (the same class as Bigfin
// Bouncer's real bounce effect or Day of Judgment's real destroy-all
// program), not bare type/subtype MEMBERSHIP the way merely "being a Cat"
// is — there's no over-match risk from every creature vacuously satisfying
// this query the way there was for `battlefield-presence-cats`/`
// -creatures`. The default `selfDirectProducerMatch || selfConsumerMatch`
// rule is correct here unmodified: Exemplar of Light genuinely self-owns
// "Counters (+1/+1)" via its own direct (non-predicate-derived) `putCounter`
// effect walk, exactly as intended.
import type { SinkQuery } from '../sink-query';
import type { SinkCatalogEntry } from './entry';

export const query: SinkQuery = { category: 'Counters (+1/+1)', event: 'putCounter', counterType: '+1/+1', controller: 'you' };

export const entry: SinkCatalogEntry = { slug: 'counters-plus1plus1', query, consumerTriggerNames: ['onCounterAdded'] };
