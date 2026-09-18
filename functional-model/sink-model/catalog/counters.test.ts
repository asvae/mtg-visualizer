// Unit tests for the `counters-plus1plus1` sink catalog
// instance (the ONE real configuration of the shared `CountersSink` family
// factory, `families/counters.ts`) — see `lifegain.test.ts`'s own header for
// the "mocked fixtures, not real cards" convention this mirrors (the
// structural gate cares about the STRUCTURAL SHAPE the matcher recognizes,
// not which real card happens to have it). See `families/counters.ts`'s own
// header for the full "one shared matcher, parametrized per counter type"
// design writeup — the real motivating card is Exemplar of Light (FDN #11).
//
// **2026-09-18: rewritten for the `SinkQuery`-free producer mechanism.**
// `CountersSink`'s own producer check no longer builds a `SinkQuery`/calls
// `matchSink` at all (`families/counters.ts`'s own header) — there is no
// `sinkInstance.query` anymore to hand to `matchSink` directly. Every case
// that used to assert `matchSink(sinkInstance.query, card).matched` instead
// calls the sink instance's own real `CallableSink` contract
// (`sinkInstance(card)`) — the SAME real interface
// `card-interactions.ts`/`server/api/sink-catalog/index.get.ts` actually use
// in production — and asserts on `result?.producer` presence. This is a
// STRICTER, more real test than before (it exercises the actual production
// call path end to end, not a hand-assembled query object). "SOURCE
// CANDIDATE"/"SINK CANDIDATE" terminology (2026-09-18, user-directed rename
// — see `app/pages/app/engine/sinks/[[slug]].vue`'s own header for the full
// "avoids colliding with FIN's own `Fact.role` source/sink labels"
// reasoning): a SOURCE CANDIDATE is a card that structurally PRODUCES this
// sink's event; a SINK CANDIDATE is a card that structurally CONSUMES/reacts
// to it. Consumer-mode cases are unaffected by the producer-mechanism
// rewrite — `matchesConsumerTriggerNames` is untouched infrastructure, still
// called directly here for standalone coverage alongside the callable
// contract.
//
// **2026-09-19: `CountersSink` now takes a real `CardDefinition` directly**
// (`families/counters.ts`'s own header for the full rewrite writeup) — there
// is no more `CountersSinkConfig` object to build by hand. This test builds
// its own INLINE mock `CardDefinition` shaped exactly like the real
// Exemplar of Light (FDN #11, `../../fdn-cards/exemplar-of-light/
// definition.ts`) — same two triggers (`onLifeGain` with a real
// `putCounter` `+1/+1` effect; `onCounterAdded`, name-only, no `on` field)
// — rather than importing the real production singleton
// (`counters-plus1plus1.ts`'s own `countersPlus1Plus1` export) OR the real
// `exemplarOfLight` definition itself, per this file's own standing
// "everything visible in one file, mocks inline, no imported production
// value" convention (2026-09-18/19 precedent — see
// `.claude/agent-memory/schema/topics/counters-sinkquery-migration-2026-09-18.md`'s
// own "self-contained-test follow-up" entry).
//
// **2026-09-19, later still — two more real rewrites, same day:**
// 1. **Boolean-return callable contract.** `sinkInstance(card)` now returns
//    a plain `boolean` (the PRODUCER question only), not the old combined
//    `SinkMatchDetail | null` — see `entry.ts`'s own `SinkInstance` doc
//    comment for the full "3rd real design iteration" writeup. The old
//    "CALLABLE" section below (which used to pin down the full
//    `.producer.via`/`.consumer`/`null` detail shape) is replaced by a
//    smaller section proving the boolean call agrees with the SOURCE
//    CANDIDATE cases above (same fixtures, same verdicts, just the new call
//    surface) plus real `isPredicateDerived` coverage.
// 2. **`CountersSink(definition)` returns `SinkInstance[]`, not one
//    `SinkInstance`** — live user correction: "we need array handling here
//    obviously." Every existing call site below destructures the one real
//    element (`const [sinkInstance] = CountersSink(...)`) — Exemplar of
//    Light only ever derives ONE distinct `counterType`, so this is a
//    single-element array in every case here. A NEW "DERIVATION: two
//    distinct counterTypes" case (bottom of this file) is the real,
//    required proof for why the array shape exists at all — a definition
//    with `putCounter` effects of two different `counterType`s must derive
//    TWO independently-correct instances, not silently collapse to one.
import { describe, expect, it } from 'vitest';
import type { CardDefinition, Effect } from '../../card';
import { matchesConsumerTriggerNames } from '../match-sink';
import { CountersSink } from './families/counters';

/** Minimal `CardDefinition` builder for this file's own mocks — `name`/
 * `manaCost`/`typeLine` are `CardDefinition`'s only REQUIRED fields
 * (`card.ts`), but `manaCost`/`typeLine` are never structurally relevant to
 * `CountersSink`'s own derivation/matching (`families/counters.ts` never
 * reads either), so every mock here fills them with an empty-string
 * placeholder and only spells out whichever `overrides` its own test case
 * actually exercises. */
function mockCard(name: string, overrides: Partial<CardDefinition> = {}): CardDefinition {
  return { name, manaCost: '', typeLine: '', ...overrides };
}

describe('counters-plus1plus1 sink instance (mocked CardDefinition fixtures)', () => {
  // Mirrors the real Exemplar of Light's own two triggers (see this file's
  // own header) — MUST keep producing `counterType: '+1/+1'` /
  // `consumerTriggerNames: ['onCounterAdded']` when derived, or this test
  // silently stops testing the real production configuration.
  const mockDrivingDefinition = mockCard('Mock Sink-Defining Card', {
    triggers: [
      { name: 'onLifeGain', on: 'lifeGained', effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect] },
      { name: 'onCounterAdded', effects: [] },
    ],
  });
  // `CountersSink` returns `SinkInstance[]` (2026-09-19, later still — one
  // instance per distinct `counterType`) — Exemplar of Light only ever
  // grants ONE distinct counter type, so destructure the one real element.
  const [sinkInstance] = CountersSink(mockDrivingDefinition);

  it('SOURCE CANDIDATE: matches a plain self-targeted putCounter effect with counterType "+1/+1" (the real Exemplar of Light, FDN #11, shape)', () => {
    const card = mockCard('Mock Counter Source', {
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    });
    expect(sinkInstance(card)).toBe(true);
  });

  it('SOURCE CANDIDATE: matches a TRIGGERED putCounter (trigger effects are walked too, not just top-level effects)', () => {
    const card = mockCard('Mock Triggered Counter Source', {
      triggers: [{ name: 'onEnter', effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect] }],
    });
    expect(sinkInstance(card)).toBe(true);
  });

  it('SOURCE CANDIDATE: matches a broadcast putCounterAll effect with counterType "+1/+1" (a real "put a +1/+1 counter on each creature you control" shape)', () => {
    const card = mockCard('Mock Counter Anthem Source', {
      effects: [{ kind: 'putCounterAll', predicate: 'creatures-you-control', counterType: '+1/+1', amount: 1 } satisfies Effect],
    });
    expect(sinkInstance(card)).toBe(true);
  });

  it('SOURCE CANDIDATE: does NOT match a DIFFERENTLY-typed counter effect (counterType "-1/-1") — real discrimination on counter type, not "any putCounter counts"', () => {
    const card = mockCard('Mock -1/-1 Counter Spell', {
      effects: [{ kind: 'putCounterTarget', validType: 'creature', counterType: '-1/-1', amount: 1 } satisfies Effect],
    });
    expect(sinkInstance(card)).toBe(false);
  });

  it('SOURCE CANDIDATE: does NOT match a vanilla creature with no effects at all', () => {
    const card = mockCard('Mock Vanilla Creature');
    expect(sinkInstance(card)).toBe(false);
  });

  it('SINK CANDIDATE: matches a card whose own named trigger is "onCounterAdded" (the real Exemplar of Light shape) even with no putCounter effect walked for THIS check — proves the sink-candidate signal is a genuinely separate check from the source-candidate check', () => {
    const card = mockCard('Mock Counter Sink', {
      triggers: [{ name: 'onCounterAdded', effects: [] }],
    });
    expect(matchesConsumerTriggerNames(sinkInstance.consumerTriggerNames, card)).toBe(true);
  });

  it('SINK CANDIDATE: does NOT match a card with a DIFFERENTLY-named trigger (real discrimination, not "any trigger counts")', () => {
    const card = mockCard('Mock Unrelated Reactor', {
      triggers: [{ name: 'onAttack', effects: [] }],
    });
    expect(matchesConsumerTriggerNames(sinkInstance.consumerTriggerNames, card)).toBe(false);
  });

  it('SINK CANDIDATE: does NOT match a card with no triggers at all', () => {
    const card = mockCard('Mock Vanilla Reactor');
    expect(matchesConsumerTriggerNames(sinkInstance.consumerTriggerNames, card)).toBe(false);
  });

  it('SINK CANDIDATE: matches via the BACK face of a transforming DFC (same face-plurality convention every other sink-candidate signal already honors)', () => {
    const card = mockCard('Mock Front Face', {
      backFace: mockCard('Mock Back Face Sink', {
        triggers: [{ name: 'onCounterAdded', effects: [] }],
      }),
    });
    expect(matchesConsumerTriggerNames(sinkInstance.consumerTriggerNames, card)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // CallableSink contract (2026-09-19, boolean-return rewrite) — the
  // callable answers the PRODUCER question ONLY now, as a plain `boolean`
  // (see `entry.ts`'s own `SinkInstance` doc comment for the full "3rd real
  // design iteration" writeup) — the SOURCE CANDIDATE cases above already
  // exercise this exact call surface directly (`expect(sinkInstance(card))
  // .toBe(true/false)`), so this section is now scoped to the ONE real piece
  // of behavior not covered there: `isPredicateDerived`, the small, separate
  // accessor that survives from the old combined-detail contract.
  it('CALLABLE: a sink-candidate-only card (no producer match) is correctly NOT a source candidate — proves producer/consumer stay genuinely separate checks now', () => {
    const card = mockCard('Mock Counter Sink', {
      triggers: [{ name: 'onCounterAdded', effects: [] }],
    });
    expect(sinkInstance(card)).toBe(false);
    expect(matchesConsumerTriggerNames(sinkInstance.consumerTriggerNames, card)).toBe(true);
  });

  it('isPredicateDerived: false for a direct, authored putCounter effect (not inferred from engine automation)', () => {
    const card = mockCard('Mock Counter Source', {
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    });
    expect(sinkInstance(card)).toBe(true);
    expect(sinkInstance.isPredicateDerived?.(card)).toBe(false);
  });

  it('isPredicateDerived: false (not thrown) for a card with no producer match at all', () => {
    const card = mockCard('Mock Vanilla Creature');
    expect(sinkInstance(card)).toBe(false);
    expect(sinkInstance.isPredicateDerived?.(card)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Derivation (2026-09-19) — `CountersSink(definition)` now derives every
  // field off `mockDrivingDefinition` itself (`families/counters.ts`'s own
  // header for the full writeup) instead of accepting a hand-authored
  // config; this section pins down that derivation directly, not just its
  // downstream matching behavior. `CountersSink` returns `SinkInstance[]`
  // (2026-09-19, later still) — every case below destructures the one real
  // element unless it's specifically testing the array shape itself (the
  // last case in this section).
  it('DERIVATION: derives slug/category/consumerTriggerNames off the driving definition itself', () => {
    expect(sinkInstance.slug).toBe('counters-plus1plus1');
    expect(sinkInstance.category).toBe('+1/+1');
    expect(sinkInstance.consumerTriggerNames).toEqual(['onCounterAdded']);
  });

  it('DERIVATION: a differently-typed driving definition derives a differently-sanitized slug/category ("-1/-1" -> "counters-minus1minus1")', () => {
    const mockMinusOneDefinition = mockCard('Mock -1/-1 Sink-Defining Card', {
      effects: [{ kind: 'putCounter', target: 'self', counterType: '-1/-1', amount: 1 } satisfies Effect],
    });
    const [instance] = CountersSink(mockMinusOneDefinition);
    expect(instance.slug).toBe('counters-minus1minus1');
    expect(instance.category).toBe('-1/-1');
  });

  it('DERIVATION: throws when the driving definition has no real putCounter-family effect anywhere (effects or triggers[].effects) — a genuine authoring mistake, not a silent empty result', () => {
    const mockNonProducerDefinition = mockCard('Mock Non-Producer', {
      effects: [{ kind: 'drawCard' } satisfies Effect],
    });
    expect(() => CountersSink(mockNonProducerDefinition)).toThrow(/no real putCounter/);
  });

  it('DERIVATION: a name-only trigger NOT in the recognized allowlist is correctly excluded (real discrimination, not "any name-only trigger counts")', () => {
    const mockDefinitionWithUnrelatedNameOnlyTrigger = mockCard('Mock Sink-Defining Card With Unrelated Trigger', {
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
      triggers: [{ name: 'onSomeUnrelatedThing', effects: [] }],
    });
    const [instance] = CountersSink(mockDefinitionWithUnrelatedNameOnlyTrigger);
    expect(instance.consumerTriggerNames).toBeUndefined();
  });

  it('DERIVATION: a trigger named "onCounterAdded" that ALSO carries a real `on` value is excluded (a real closed auto-fire occasion already explains it; a coincidental name match is not a genuine second signal)', () => {
    const mockDefinitionWithClaimedOnValue = mockCard('Mock Sink-Defining Card With Claimed Trigger', {
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
      triggers: [{ name: 'onCounterAdded', on: 'enter', effects: [] }],
    });
    const [instance] = CountersSink(mockDefinitionWithClaimedOnValue);
    expect(instance.consumerTriggerNames).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Array-of-instances / dedup rule (2026-09-19, live user correction —
  // "we need array handling here obviously") — the real point of
  // `CountersSink` returning `SinkInstance[]`, not just a shape change with
  // no case proving why it exists.
  it('DERIVATION: a definition with TWO distinct counterTypes across its effects derives TWO independently-correct instances', () => {
    const mockTwoCounterTypeDefinition = mockCard('Mock Two-Counter-Type Sink-Defining Card', {
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
      triggers: [{ name: 'onSomeTrigger', effects: [{ kind: 'putCounter', target: 'self', counterType: '-1/-1', amount: 1 } satisfies Effect] }],
    });
    const instances = CountersSink(mockTwoCounterTypeDefinition);
    expect(instances).toHaveLength(2);
    const [plusOne, minusOne] = instances;
    expect(plusOne!.category).toBe('+1/+1');
    expect(plusOne!.slug).toBe('counters-plus1plus1');
    expect(minusOne!.category).toBe('-1/-1');
    expect(minusOne!.slug).toBe('counters-minus1minus1');
    // Each instance's own producer check is genuinely independent — a
    // +1/+1-typed candidate only satisfies the +1/+1 instance, not the
    // -1/-1 one, and vice versa (real discrimination, not "any instance
    // from this definition matches any counterType").
    const plusOneCard = mockCard('Mock +1/+1 Card', { effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect] });
    const minusOneCard = mockCard('Mock -1/-1 Card', { effects: [{ kind: 'putCounter', target: 'self', counterType: '-1/-1', amount: 1 } satisfies Effect] });
    expect(plusOne!(plusOneCard)).toBe(true);
    expect(plusOne!(minusOneCard)).toBe(false);
    expect(minusOne!(minusOneCard)).toBe(true);
    expect(minusOne!(plusOneCard)).toBe(false);
  });

  it('DERIVATION: two occurrences sharing the SAME counterType (one top-level effect, one trigger effect) collapse to ONE instance, not two duplicates', () => {
    const mockDuplicateCounterTypeDefinition = mockCard('Mock Duplicate-Counter-Type Sink-Defining Card', {
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
      triggers: [{ name: 'onSomeTrigger', effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect] }],
    });
    const instances = CountersSink(mockDuplicateCounterTypeDefinition);
    expect(instances).toHaveLength(1);
    expect(instances[0]!.category).toBe('+1/+1');
  });
});
