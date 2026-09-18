// Real corpus verification for the `etb` sink catalog entry — see
// `lifegain.test.ts`'s own header for the "mocked fixtures, not real cards"
// convention this mirrors.
//
// **2026-09-18, later still: producer/consumer split, replacing the earlier
// single-role design entirely.** See `etb.ts`'s own header for the full
// "blink/bounce value" archetype writeup — the real user correction to the
// original ("has an `on:'enter'` trigger, no split needed") design, which
// over-matched (`felidar-savior` self-showed "ETB: 20" against the real
// 100-card FDN pool). Producer cases below exercise the new `query`
// (`event:'bounce'`, matched via a real bounce-to-hand `move` effect);
// consumer cases exercise `entry.consumerTriggerOn` (`matchesConsumerTriggerOn`,
// `Trigger.on === 'enter'`) — the ONE part of the original design that was
// already correct and is kept as-is.
//
// **`consumerTriggerNames` cases added (2026-09-18, later still)** — see
// `etb.ts`'s own header for the real Dazzling Angel (FDN #9) gap this
// closes: "whenever ANOTHER creature you control enters" has no `on` value
// at all (a genuinely different real trigger shape from `on:'enter'`), so
// `consumerTriggerOn` alone can never recognize it.
import { describe, expect, it } from 'vitest';
import type { CardDefinition, Effect } from '../../card';
import { matchesConsumerTriggerNames, matchesConsumerTriggerOn, matchSink } from '../match-sink';
import { entry, query } from './etb';

describe('etb sink catalog entry — corpus (mocked CardDefinition fixtures)', () => {
  it('PRODUCER: matches a real bounce-to-hand effect (the real Bigfin Bouncer, FDN, shape: from Battlefield, to Hand, validType creature)', () => {
    const card: CardDefinition = {
      name: 'Mock Bounce Creature',
      manaCost: '{3}{U}',
      typeLine: 'Creature — Shark',
      pt: [3, 2],
      triggers: [{ name: 'onEnter', on: 'enter', effects: [{ kind: 'move', owner: 'opponents', from: 'Battlefield', to: 'Hand', qty: 1, validType: 'creature', target: true } satisfies Effect] }],
    };
    expect(matchSink(query, card).matched).toBe(true);
  });

  it('PRODUCER: does NOT match a graveyard-recursion move (from Graveyard to Hand — a card in a graveyard is never a "permanent," CR 110.1, so this is not a bounce)', () => {
    const card: CardDefinition = {
      name: 'Mock Recursion Spell',
      manaCost: '{2}{B}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'move', owner: 'you', from: 'Graveyard', to: 'Hand', qty: 1, validType: 'creature', target: true } satisfies Effect],
    };
    expect(matchSink(query, card).matched).toBe(false);
  });

  it('PRODUCER: does NOT match a move to a different destination (Battlefield -> Graveyard, e.g. a sacrifice-shaped effect) — real discrimination on `to`, not "any move counts"', () => {
    const card: CardDefinition = {
      name: 'Mock Sacrifice Spell',
      manaCost: '{1}{B}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'sacrifice', validType: 'creature' } satisfies Effect],
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

  it('CONSUMER mode: matches a creature with a real on:\'enter\' trigger (the real Felidar Savior/Helpful Hunter shape) regardless of what the trigger\'s own effect does — it owns "ETB" as the thing worth re-triggering, even with no bounce effect of its own', () => {
    const card: CardDefinition = {
      name: 'Mock ETB Creature',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Cat',
      pt: [2, 2],
      triggers: [{ name: 'onEnter', on: 'enter', effects: [{ kind: 'drawCard' } satisfies Effect] }],
    };
    expect(matchSink(query, card).matched).toBe(false);
    expect(matchesConsumerTriggerOn(entry.consumerTriggerOn, card)).toBe(true);
  });

  it('CONSUMER mode: does NOT match a creature whose only trigger has a DIFFERENT `on` value (e.g. \'attacks\') — real discrimination, not "any trigger counts"', () => {
    const card: CardDefinition = {
      name: 'Mock Attack Trigger Creature',
      manaCost: '{2}{R}',
      typeLine: 'Creature — Goblin',
      pt: [2, 1],
      triggers: [{ name: 'onAttack', on: 'attacks', effects: [{ kind: 'drawCard' } satisfies Effect] }],
    };
    expect(matchesConsumerTriggerOn(entry.consumerTriggerOn, card)).toBe(false);
  });

  it('CONSUMER mode: does NOT match a card with no triggers at all', () => {
    const card: CardDefinition = {
      name: 'Mock Vanilla Reactor',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Human',
      pt: [2, 2],
    };
    expect(matchesConsumerTriggerOn(entry.consumerTriggerOn, card)).toBe(false);
  });

  it('CONSUMER mode: matches via the BACK face of a transforming DFC (the same face-plurality convention `matchesConsumerTriggerNames`/`deriveOccurrences` itself already honors)', () => {
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
        triggers: [{ name: 'onEnter', on: 'enter', effects: [{ kind: 'drawCard' } satisfies Effect] }],
      },
    };
    expect(matchesConsumerTriggerOn(entry.consumerTriggerOn, card)).toBe(true);
  });

  it('CONSUMER mode (consumerTriggerNames): matches a creature whose only trigger is named \'onOtherCreatureEnter\' (the real Dazzling Angel, FDN #9, shape — "whenever another creature you control enters," no `on` value at all, so `consumerTriggerOn` alone can never see it)', () => {
    const card: CardDefinition = {
      name: 'Mock Other-Creature-Enter Reactor',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Angel',
      pt: [2, 3],
      triggers: [{ name: 'onOtherCreatureEnter', effects: [{ kind: 'gainLife', amount: 1 } satisfies Effect] }],
    };
    expect(matchesConsumerTriggerOn(entry.consumerTriggerOn, card)).toBe(false);
    expect(matchesConsumerTriggerNames(entry.consumerTriggerNames, card)).toBe(true);
  });

  it('CONSUMER mode (consumerTriggerNames): does NOT match a card with a DIFFERENTLY-named trigger (real discrimination, not "any name-only trigger counts")', () => {
    const card: CardDefinition = {
      name: 'Mock Unrelated Reactor',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Human',
      pt: [1, 1],
      triggers: [{ name: 'onLifeGain', effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect] }],
    };
    expect(matchesConsumerTriggerNames(entry.consumerTriggerNames, card)).toBe(false);
  });

  it('CONSUMER mode (consumerTriggerNames): matches via the BACK face of a transforming DFC (same face-plurality convention as consumerTriggerOn above)', () => {
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
        triggers: [{ name: 'onOtherCreatureEnter', effects: [{ kind: 'gainLife', amount: 1 } satisfies Effect] }],
      },
    };
    expect(matchesConsumerTriggerNames(entry.consumerTriggerNames, card)).toBe(true);
  });
});
