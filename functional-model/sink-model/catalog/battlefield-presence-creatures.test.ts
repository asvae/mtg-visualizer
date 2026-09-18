// Real corpus verification for the `battlefield-presence-creatures` sink
// catalog entry — see `battlefield-presence-cats.test.ts`'s own header for
// the shared "mocked fixtures, not real cards" convention. See
// `battlefield-presence-creatures.ts`'s own header for the full
// "Battlefield presence" archetype writeup — the real motivating card is
// Claws Out (FDN #6), whose "Creatures you control get +2/+2" is THIS
// entry's own real consumer shape.
import { describe, expect, it } from 'vitest';
import type { CardDefinition, Effect } from '../../card';
import { matchesBattlefieldPresenceConsumer, matchSink } from '../match-sink';
import { entry, query } from './battlefield-presence-creatures';

describe('battlefield-presence-creatures sink catalog entry — corpus (mocked CardDefinition fixtures)', () => {
  it('PRODUCER: matches any real creature (its own baseline entersBattlefield occurrence structurally guarantees A creature permanent under your control)', () => {
    const card: CardDefinition = {
      name: 'Mock Vanilla Creature',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Human Soldier',
      pt: [2, 2],
    };
    expect(matchSink(query, card).matched).toBe(true);
  });

  it('PRODUCER: matches a card that creates a creature token (any subtype — real discrimination is on the card TYPE, not a subtype)', () => {
    const card: CardDefinition = {
      name: 'Mock Token Maker',
      manaCost: '{2}{W}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'createToken', token: { name: 'Bird', manaCost: '', types: ['Creature', 'Bird'], basePower: 1, baseToughness: 1 }, amount: 1 } satisfies Effect],
    };
    expect(matchSink(query, card).matched).toBe(true);
  });

  it('PRODUCER: does NOT match a non-creature permanent (real discrimination on card type, not "any permanent counts")', () => {
    const card: CardDefinition = {
      name: 'Mock Artifact',
      manaCost: '{2}',
      typeLine: 'Artifact',
    };
    expect(matchSink(query, card).matched).toBe(false);
  });

  it('PRODUCER: does NOT match a non-creature spell with no token creation at all', () => {
    const card: CardDefinition = {
      name: 'Mock Removal Spell',
      manaCost: '{1}{B}',
      typeLine: 'Instant',
      effects: [{ kind: 'destroy', validType: 'creature' } satisfies Effect],
    };
    expect(matchSink(query, card).matched).toBe(false);
  });

  it('CONSUMER mode: matches a BARE (no-subtype) pumpAll — the real Claws Out (FDN #6) "Creatures you control get +2/+2" shape', () => {
    const card: CardDefinition = {
      name: 'Mock Claws Out',
      manaCost: '{3}{W}{W}',
      typeLine: 'Instant',
      costReduction: { perControlled: { amountPerMatch: 1, subtype: 'Cat' } },
      effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control', power: 2, toughness: 2, untilEndOfTurn: true } satisfies Effect],
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(true);
    expect(matchSink(query, card).matched).toBe(false); // an Instant is never itself a creature producer
  });

  it('CONSUMER mode: matches a BARE (no-subtype) putCounterAll (Warren Elder-shaped "put a counter on each creature you control")', () => {
    const card: CardDefinition = {
      name: 'Mock Bare Counters Spell',
      manaCost: '{2}{W}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'putCounterAll', predicate: 'creatures-you-control', counterType: '+1/+1', amount: 1 } satisfies Effect],
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(true);
  });

  it('CONSUMER mode: does NOT match a pumpAll effect that carries its OWN subtype filter (that is the sibling "Cats" entry\'s own shape, not this bare/generic one)', () => {
    const card: CardDefinition = {
      name: 'Mock Cat Anthem Spell',
      manaCost: '{2}{W}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control', subtype: 'Cat', power: 1, toughness: 1 } satisfies Effect],
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(false);
  });

  it('CONSUMER mode: does NOT match a cost reduction (this entry declares no subtype at all, and no real card has a bare "for each creature you control" cost reduction to confirm that shape against)', () => {
    const card: CardDefinition = {
      name: 'Mock Affinity for Cats Spell',
      manaCost: '{3}{W}{W}',
      typeLine: 'Instant',
      costReduction: { perControlled: { amountPerMatch: 1, subtype: 'Cat' } },
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(false);
  });

  it('CONSUMER mode: does NOT match a vanilla card with no pumpAll/putCounterAll effect at all', () => {
    const card: CardDefinition = {
      name: 'Mock Vanilla Spell',
      manaCost: '{1}{W}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'drawCard' } satisfies Effect],
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(false);
  });

  it('CONSUMER mode: matches via the BACK face of a transforming DFC (the same face-plurality convention matchesConsumerTriggerNames/matchesConsumerTriggerOn already honor)', () => {
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
        effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control', power: 1, toughness: 1 } satisfies Effect],
      },
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(true);
  });
});
