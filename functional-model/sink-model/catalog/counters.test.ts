// Real corpus verification for the `counters-plus1plus1` sink catalog
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

describe('counters-plus1plus1 sink instance — corpus (mocked CardDefinition fixtures)', () => {
  // Mirrors the real Exemplar of Light's own two triggers (see this file's
  // own header) — MUST keep producing `counterType: '+1/+1'` /
  // `consumerTriggerNames: ['onCounterAdded']` when derived, or this test
  // silently stops testing the real production configuration.
  const mockExemplarOfLight = mockCard('Mock Sink-Defining Angel', {
    triggers: [
      { name: 'onLifeGain', on: 'lifeGained', effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect] },
      { name: 'onCounterAdded', effects: [] },
    ],
  });
  const sinkInstance = CountersSink(mockExemplarOfLight);

  it('SOURCE CANDIDATE: matches a plain self-targeted putCounter effect with counterType "+1/+1" (the real Exemplar of Light, FDN #11, shape)', () => {
    const card = mockCard('Mock Counter Source', {
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    });
    expect(sinkInstance(card)?.producer).toBeDefined();
  });

  it('SOURCE CANDIDATE: matches a TRIGGERED putCounter (trigger effects are walked too, not just top-level effects)', () => {
    const card = mockCard('Mock Triggered Counter Source', {
      triggers: [{ name: 'onEnter', effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect] }],
    });
    expect(sinkInstance(card)?.producer).toBeDefined();
  });

  it('SOURCE CANDIDATE: matches a broadcast putCounterAll effect with counterType "+1/+1" (a real "put a +1/+1 counter on each creature you control" shape)', () => {
    const card = mockCard('Mock Counter Anthem Source', {
      effects: [{ kind: 'putCounterAll', predicate: 'creatures-you-control', counterType: '+1/+1', amount: 1 } satisfies Effect],
    });
    expect(sinkInstance(card)?.producer).toBeDefined();
  });

  it('SOURCE CANDIDATE: does NOT match a DIFFERENTLY-typed counter effect (counterType "-1/-1") — real discrimination on counter type, not "any putCounter counts"', () => {
    const card = mockCard('Mock -1/-1 Counter Spell', {
      effects: [{ kind: 'putCounterTarget', validType: 'creature', counterType: '-1/-1', amount: 1 } satisfies Effect],
    });
    expect(sinkInstance(card)).toBeNull();
  });

  it('SOURCE CANDIDATE: does NOT match a vanilla creature with no effects at all', () => {
    const card = mockCard('Mock Vanilla Creature');
    expect(sinkInstance(card)).toBeNull();
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
  // CallableSink contract — see `battlefield-presence.test.ts`'s own
  // identical section header for the full "first real callers of
  // entry(candidate)" writeup; same 3-case shape reused here, against this
  // family's own real fixtures. Deliberately still a real, standalone
  // assertion block (not merged into the SOURCE CANDIDATE cases above) —
  // those already exercise `sinkInstance(candidate)` too now, but this block
  // is the one that specifically pins down the FULL `SinkMatchDetail` shape
  // (`.producer.via`/`.consumer`/`null`), not just presence/absence.
  it('CALLABLE: source-candidate-only match returns real detail (producer.via set, no consumer)', () => {
    const card = mockCard('Mock Counter Source', {
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    });
    const result = sinkInstance(card);
    expect(result).not.toBeNull();
    expect(result!.producer?.via).toEqual(expect.any(String));
    expect(result!.consumer).toBeUndefined();
  });

  it('CALLABLE: sink-candidate-only match returns real detail (consumer.via set, no producer)', () => {
    const card = mockCard('Mock Counter Sink', {
      triggers: [{ name: 'onCounterAdded', effects: [] }],
    });
    const result = sinkInstance(card);
    expect(result).not.toBeNull();
    expect(result!.consumer).toEqual({ via: 'triggerName' });
    expect(result!.producer).toBeUndefined();
  });

  it('CALLABLE: no source-candidate or sink-candidate signal at all returns null', () => {
    const card = mockCard('Mock Vanilla Creature');
    expect(sinkInstance(card)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Derivation (2026-09-19) — `CountersSink(definition)` now derives every
  // field off `mockExemplarOfLight` itself (`families/counters.ts`'s own
  // header for the full writeup) instead of accepting a hand-authored
  // config; this section pins down that derivation directly, not just its
  // downstream matching behavior.
  it('DERIVATION: derives slug/category/consumerTriggerNames off the driving definition itself', () => {
    expect(sinkInstance.slug).toBe('counters-plus1plus1');
    expect(sinkInstance.category).toBe('+1/+1');
    expect(sinkInstance.consumerTriggerNames).toEqual(['onCounterAdded']);
  });

  it('DERIVATION: a differently-typed driving definition derives a differently-sanitized slug/category ("-1/-1" -> "counters-minus1minus1")', () => {
    const mockMinusOneDefinition = mockCard('Mock -1/-1 Sink-Defining Blight', {
      effects: [{ kind: 'putCounter', target: 'self', counterType: '-1/-1', amount: 1 } satisfies Effect],
    });
    const instance = CountersSink(mockMinusOneDefinition);
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
    const mockDefinitionWithUnrelatedNameOnlyTrigger = mockCard('Mock Sink-Defining Angel With Unrelated Trigger', {
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
      triggers: [{ name: 'onSomeUnrelatedThing', effects: [] }],
    });
    const instance = CountersSink(mockDefinitionWithUnrelatedNameOnlyTrigger);
    expect(instance.consumerTriggerNames).toBeUndefined();
  });

  it('DERIVATION: a trigger named "onCounterAdded" that ALSO carries a real `on` value is excluded (a real closed auto-fire occasion already explains it; a coincidental name match is not a genuine second signal)', () => {
    const mockDefinitionWithClaimedOnValue = mockCard('Mock Sink-Defining Angel With Claimed Trigger', {
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
      triggers: [{ name: 'onCounterAdded', on: 'enter', effects: [] }],
    });
    const instance = CountersSink(mockDefinitionWithClaimedOnValue);
    expect(instance.consumerTriggerNames).toBeUndefined();
  });
});
