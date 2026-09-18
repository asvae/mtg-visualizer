// Real corpus verification for the `battlefield-presence-cats` sink catalog
// entry — see `lifegain.test.ts`'s own header for the "mocked fixtures, not
// real cards" convention this mirrors (the structural gate cares about the
// SHAPE `matchSink`/`matchesBattlefieldPresenceConsumer` recognize, not
// which real card happens to have it). See `battlefield-presence-cats.ts`'s
// own header for the full "Battlefield presence" archetype writeup — the
// real motivating card is Claws Out (FDN #6).
import { describe, expect, it } from 'vitest';
import type { CardDefinition, Effect } from '../../card';
import { matchesBattlefieldPresenceConsumer, matchSink } from '../match-sink';
import { entry, query } from './battlefield-presence-cats';

describe('battlefield-presence-cats sink catalog entry — corpus (mocked CardDefinition fixtures)', () => {
  it('PRODUCER: matches a real Cat creature (its own baseline entersBattlefield occurrence structurally guarantees a Cat permanent under your control)', () => {
    const card: CardDefinition = {
      name: 'Mock Cat Creature',
      manaCost: '{1}{W}',
      typeLine: 'Creature — Cat Soldier',
      pt: [2, 2],
    };
    expect(matchSink(query, card).matched).toBe(true);
  });

  it('PRODUCER: matches a card that CREATES a Cat token (the real Prideful Parent/Arahbo/Cat Collector shape)', () => {
    const card: CardDefinition = {
      name: 'Mock Cat Token Maker',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Human Citizen',
      pt: [2, 2],
      triggers: [
        {
          name: 'onEnter',
          on: 'enter',
          effects: [{ kind: 'createToken', token: { name: 'Cat', manaCost: '', types: ['Creature', 'Cat'], basePower: 1, baseToughness: 1 }, amount: 1 } satisfies Effect],
        },
      ],
    };
    expect(matchSink(query, card).matched).toBe(true);
  });

  it('PRODUCER: does NOT match a non-Cat creature (real discrimination on subtype, not "any creature counts")', () => {
    const card: CardDefinition = {
      name: 'Mock Human Creature',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Human Soldier',
      pt: [2, 2],
    };
    expect(matchSink(query, card).matched).toBe(false);
  });

  it('PRODUCER: does NOT match a card that creates a non-Cat token', () => {
    const card: CardDefinition = {
      name: 'Mock Bird Token Maker',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Human Citizen',
      pt: [2, 2],
      triggers: [
        {
          name: 'onEnter',
          on: 'enter',
          effects: [{ kind: 'createToken', token: { name: 'Bird', manaCost: '', types: ['Creature', 'Bird'], basePower: 1, baseToughness: 1 }, amount: 1 } satisfies Effect],
        },
      ],
    };
    expect(matchSink(query, card).matched).toBe(false);
  });

  it('CONSUMER mode: matches a real board-COUNTED cost reduction, "Affinity for Cats" (the real Claws Out, FDN #6, shape)', () => {
    const card: CardDefinition = {
      name: 'Mock Affinity for Cats Spell',
      manaCost: '{3}{W}{W}',
      typeLine: 'Instant',
      costReduction: { perControlled: { amountPerMatch: 1, subtype: 'Cat' } },
      effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control', power: 2, toughness: 2, untilEndOfTurn: true } satisfies Effect],
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(true);
    expect(matchSink(query, card).matched).toBe(false); // an Instant is never itself a Cat producer
  });

  it('CONSUMER mode: matches a pumpAll effect subtype-filtered to Cats (Cat-only, not the bare/generic Creatures shape)', () => {
    const card: CardDefinition = {
      name: 'Mock Cat Anthem Spell',
      manaCost: '{2}{W}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control', subtype: 'Cat', power: 1, toughness: 1 } satisfies Effect],
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(true);
  });

  it('CONSUMER mode: matches a putCounterAll effect subtype-filtered to Cats (same predicate/subtype shape pumpAll uses)', () => {
    const card: CardDefinition = {
      name: 'Mock Cat Counters Spell',
      manaCost: '{2}{W}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'putCounterAll', predicate: 'creatures-you-control', subtype: 'Cat', counterType: '+1/+1', amount: 1 } satisfies Effect],
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(true);
  });

  it('CONSUMER mode: does NOT match a pumpAll effect filtered to a DIFFERENT subtype (real discrimination, not "any subtype counts")', () => {
    const card: CardDefinition = {
      name: 'Mock Wizard Anthem Spell',
      manaCost: '{2}{U}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control', subtype: 'Wizard', power: 1, toughness: 1 } satisfies Effect],
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(false);
  });

  it('CONSUMER mode: does NOT match a BARE (no-subtype) pumpAll — that is the sibling "Creatures" entry\'s own shape, not this one', () => {
    const card: CardDefinition = {
      name: 'Mock Bare Anthem Spell',
      manaCost: '{2}{W}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control', power: 1, toughness: 1 } satisfies Effect],
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(false);
  });

  it('CONSUMER mode: does NOT match a vanilla card with no cost reduction and no pumpAll/putCounterAll effect at all', () => {
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
        costReduction: { perControlled: { amountPerMatch: 1, subtype: 'Cat' } },
      },
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(true);
  });
});
