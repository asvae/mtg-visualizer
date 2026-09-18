// Real corpus verification for the `counters-plus1plus1` sink catalog
// instance (the ONE real configuration of the shared `CountersSink` family
// factory, `families/counters.ts`, as of the 2026-09-18 factory refactor —
// this instance's own config lives in `counters-plus1plus1.ts`) — see
// `lifegain.test.ts`'s own header for the "mocked fixtures, not real cards"
// convention this mirrors (the structural gate cares about the STRUCTURAL
// SHAPE `matchSink`/`matchesConsumerTriggerNames` recognize, not which real
// card happens to have it). See `families/counters.ts`'s own header for the
// full "one shared matcher, parametrized per counter type" design writeup —
// the real motivating card is Exemplar of Light (FDN #11).
import { describe, expect, it } from 'vitest';
import type { CardDefinition, Effect } from '../../card';
import { matchesConsumerTriggerNames, matchSink } from '../match-sink';
import { countersPlus1Plus1 } from './counters-plus1plus1';

describe('counters-plus1plus1 sink catalog entry — corpus (mocked CardDefinition fixtures)', () => {
  const entry = countersPlus1Plus1;
  const { query } = entry;

  it('PRODUCER: matches a plain self-targeted putCounter effect with counterType "+1/+1" (the real Exemplar of Light, FDN #11, shape)', () => {
    const card: CardDefinition = {
      name: 'Mock Counter Creature',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Angel',
      pt: [2, 2],
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    };
    expect(matchSink(query, card).matched).toBe(true);
  });

  it('PRODUCER: matches a TRIGGERED putCounter (trigger effects are walked too, not just top-level effects)', () => {
    const card: CardDefinition = {
      name: 'Mock Triggered Counter Creature',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Bird',
      pt: [1, 1],
      triggers: [{ name: 'onEnter', on: 'enter', effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect] }],
    };
    expect(matchSink(query, card).matched).toBe(true);
  });

  it('PRODUCER: matches a broadcast putCounterAll effect with counterType "+1/+1" (a real "put a +1/+1 counter on each creature you control" shape)', () => {
    const card: CardDefinition = {
      name: 'Mock Counter Anthem Spell',
      manaCost: '{2}{W}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'putCounterAll', predicate: 'creatures-you-control', counterType: '+1/+1', amount: 1 } satisfies Effect],
    };
    expect(matchSink(query, card).matched).toBe(true);
  });

  it('PRODUCER: does NOT match a DIFFERENTLY-typed counter effect (counterType "-1/-1") — real discrimination on counter type, not "any putCounter counts"', () => {
    const card: CardDefinition = {
      name: 'Mock -1/-1 Counter Spell',
      manaCost: '{1}{B}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'putCounterTarget', validType: 'creature', counterType: '-1/-1', amount: 1 } satisfies Effect],
    };
    expect(matchSink(query, card).matched).toBe(false);
  });

  it('PRODUCER: does NOT match a vanilla creature with no effects at all', () => {
    const card: CardDefinition = {
      name: 'Mock Vanilla Creature',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Human',
      pt: [2, 2],
    };
    expect(matchSink(query, card).matched).toBe(false);
  });

  it('CONSUMER mode: matches a card whose own named trigger is "onCounterAdded" (the real Exemplar of Light shape) even with no putCounter effect walked for THIS check — proves the consumer signal is a genuinely separate check from the producer query', () => {
    const card: CardDefinition = {
      name: 'Mock Counter Reactor',
      manaCost: '{1}{W}',
      typeLine: 'Creature — Human Cleric',
      pt: [1, 1],
      triggers: [{ name: 'onCounterAdded', effects: [{ kind: 'drawCard', amount: 1 } satisfies Effect] }],
    };
    expect(matchesConsumerTriggerNames(entry.consumerTriggerNames, card)).toBe(true);
  });

  it('CONSUMER mode: does NOT match a card with a DIFFERENTLY-named trigger (real discrimination, not "any trigger counts")', () => {
    const card: CardDefinition = {
      name: 'Mock Unrelated Reactor',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Human',
      pt: [1, 1],
      triggers: [{ name: 'onAttack', effects: [{ kind: 'drawCard' } satisfies Effect] }],
    };
    expect(matchesConsumerTriggerNames(entry.consumerTriggerNames, card)).toBe(false);
  });

  it('CONSUMER mode: does NOT match a card with no triggers at all', () => {
    const card: CardDefinition = {
      name: 'Mock Vanilla Reactor',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Human',
      pt: [2, 2],
    };
    expect(matchesConsumerTriggerNames(entry.consumerTriggerNames, card)).toBe(false);
  });

  it('CONSUMER mode: matches via the BACK face of a transforming DFC (same face-plurality convention every other consumer signal already honors)', () => {
    const card: CardDefinition = {
      name: 'Mock Front Face',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Human',
      pt: [2, 2],
      backFace: {
        name: 'Mock Back Face',
        manaCost: '',
        typeLine: 'Creature — Human',
        pt: [3, 3],
        triggers: [{ name: 'onCounterAdded', effects: [{ kind: 'drawCard', amount: 1 } satisfies Effect] }],
      },
    };
    expect(matchesConsumerTriggerNames(entry.consumerTriggerNames, card)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // CallableSink contract (2026-09-18, new with the factory refactor) — see
  // `battlefield-presence.test.ts`'s own identical section header for the
  // full "first real callers of entry(candidate)" writeup; same 3-case
  // shape reused here, against this family's own real fixtures.
  it('CALLABLE: producer-only match returns real detail (producer.via set, no consumer)', () => {
    const card: CardDefinition = {
      name: 'Mock Counter Creature',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Angel',
      pt: [2, 2],
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    };
    const result = entry(card);
    expect(result).not.toBeNull();
    expect(result!.producer?.via).toEqual(expect.any(String));
    expect(result!.consumer).toBeUndefined();
  });

  it('CALLABLE: consumer-only match returns real detail (consumer.via set, no producer)', () => {
    const card: CardDefinition = {
      name: 'Mock Counter Reactor',
      manaCost: '{1}{W}',
      typeLine: 'Creature — Human Cleric',
      pt: [1, 1],
      triggers: [{ name: 'onCounterAdded', effects: [{ kind: 'drawCard', amount: 1 } satisfies Effect] }],
    };
    const result = entry(card);
    expect(result).not.toBeNull();
    expect(result!.consumer).toEqual({ via: 'triggerName' });
    expect(result!.producer).toBeUndefined();
  });

  it('CALLABLE: no producer or consumer signal at all returns null', () => {
    const card: CardDefinition = {
      name: 'Mock Vanilla Creature',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Human',
      pt: [2, 2],
    };
    expect(entry(card)).toBeNull();
  });
});
