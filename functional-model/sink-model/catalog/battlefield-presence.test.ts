// Unit tests for the `battlefield-presence-{cats,creatures,
// hare-apparent}` sink catalog entries — 3 configurations of ONE shared
// factory (`BattlefieldPresenceSink`, `families/battlefield-presence.ts`) as
// of the 2026-09-18 factory refactor (see that file's own header for the
// full archetype writeup; each instance's own config lives in its own
// sibling `battlefield-presence-<slug>.ts`). Consolidated from 3 formerly-
// separate per-slug test files into this one family file (same real
// coverage, migrated verbatim — no case dropped or weakened) — each
// configuration's own `<slug>.corpus.json` manifest stays separate/
// unchanged (review-status is still computed per real slug, not per
// family). See `lifegain.test.ts`'s own header for the "mocked fixtures,
// not real cards" convention every `describe` block below mirrors.
import { describe, expect, it } from 'vitest';
import type { CardDefinition, Effect } from '../../card';
import { you } from '../../combinator';
import { matchesBattlefieldPresenceConsumer, matchSink } from '../match-sink';
import { battlefieldPresenceCats } from './battlefield-presence-cats';
import { battlefieldPresenceCreatures } from './battlefield-presence-creatures';
import { battlefieldPresenceHareApparent } from './battlefield-presence-hare-apparent';

describe('battlefield-presence-cats sink catalog entry (mocked CardDefinition fixtures)', () => {
  const entry = battlefieldPresenceCats;
  const { query } = entry;

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

  // -------------------------------------------------------------------------
  // CallableSink contract (2026-09-18, new with the factory refactor) — the
  // returned `entry` is itself directly invocable: `entry(candidate)`.
  //
  // **2026-09-19, boolean-return rewrite** — `entry(candidate)` now answers
  // the PRODUCER question ONLY, as a plain `boolean` (not the old combined
  // `SinkMatchDetail | null` — see `entry.ts`'s own `SinkInstance` doc
  // comment for the full "3rd real design iteration" writeup); the CONSUMER
  // question is checked directly against `entry.consumerBattlefieldPresence`
  // via `matchesBattlefieldPresenceConsumer` (same real function the CONSUMER
  // mode cases above already use), not through the callable at all anymore.
  it('CALLABLE: producer-only match returns true; the same card is NOT a consumer match via the entry\'s own data field', () => {
    const card: CardDefinition = {
      name: 'Mock Cat Creature',
      manaCost: '{1}{W}',
      typeLine: 'Creature — Cat Soldier',
      pt: [2, 2],
    };
    expect(entry(card)).toBe(true);
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(false);
  });

  it('CALLABLE: consumer-only match returns false from the callable (producer question only) even though the entry\'s own data field DOES recognize it as a consumer', () => {
    const card: CardDefinition = {
      name: 'Mock Affinity for Cats Spell',
      manaCost: '{3}{W}{W}',
      typeLine: 'Instant',
      costReduction: { perControlled: { amountPerMatch: 1, subtype: 'Cat' } },
      effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control', power: 2, toughness: 2, untilEndOfTurn: true } satisfies Effect],
    };
    expect(entry(card)).toBe(false);
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(true);
  });

  it('CALLABLE: no producer signal at all returns false', () => {
    const card: CardDefinition = {
      name: 'Mock Vanilla Spell',
      manaCost: '{1}{W}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'drawCard' } satisfies Effect],
    };
    expect(entry(card)).toBe(false);
  });

  it('isPredicateDerived: false for a direct, structural Cat creature (baseline entersBattlefield, not inferred from a sink-derivation predicate)', () => {
    const card: CardDefinition = {
      name: 'Mock Cat Creature',
      manaCost: '{1}{W}',
      typeLine: 'Creature — Cat Soldier',
      pt: [2, 2],
    };
    expect(entry(card)).toBe(true);
    expect(entry.isPredicateDerived?.(card)).toBe(false);
  });
});

describe('battlefield-presence-creatures sink catalog entry (mocked CardDefinition fixtures)', () => {
  const entry = battlefieldPresenceCreatures;
  const { query } = entry;

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

describe('battlefield-presence-hare-apparent sink catalog entry (mocked CardDefinition fixtures)', () => {
  const entry = battlefieldPresenceHareApparent;
  const { query } = entry;

  it('PRODUCER: matches a normal permanent literally named "Hare Apparent" (its own baseline entersBattlefield occurrence)', () => {
    const card: CardDefinition = {
      name: 'Hare Apparent',
      manaCost: '{1}{W}',
      typeLine: 'Creature — Rabbit Noble',
      pt: [2, 2],
    };
    expect(matchSink(query, card).matched).toBe(true);
  });

  it('PRODUCER: does NOT match a differently-named creature, even an otherwise identical Rabbit', () => {
    const card: CardDefinition = {
      name: 'Mock Rabbit Creature',
      manaCost: '{1}{W}',
      typeLine: 'Creature — Rabbit Noble',
      pt: [2, 2],
    };
    expect(matchSink(query, card).matched).toBe(false);
  });

  it('CONSUMER mode: matches the real Hare Apparent shape — a createToken effect whose amount counts other same-named creatures', () => {
    const card: CardDefinition = {
      name: 'Hare Apparent',
      manaCost: '{1}{W}',
      typeLine: 'Creature — Rabbit Noble',
      pt: [2, 2],
      triggers: [
        {
          name: 'onEnter',
          on: 'enter',
          effects: [
            {
              kind: 'createToken',
              token: { name: 'Rabbit', manaCost: '0', types: ['Creature', 'Rabbit'], basePower: 1, baseToughness: 1 },
              amount: you.creaturesInPlay().filter('sameNameAsSelf').count(),
            } satisfies Effect,
          ],
        },
      ],
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(true);
  });

  it('CONSUMER mode: does NOT match a createToken effect with a plain literal amount (no board-count at all)', () => {
    const card: CardDefinition = {
      name: 'Mock Token Maker',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Human Citizen',
      pt: [2, 2],
      triggers: [
        {
          name: 'onEnter',
          on: 'enter',
          effects: [{ kind: 'createToken', token: { name: 'Rabbit', manaCost: '0', types: ['Creature', 'Rabbit'], basePower: 1, baseToughness: 1 }, amount: 1 } satisfies Effect],
        },
      ],
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(false);
  });

  it('CONSUMER mode: does NOT match a createToken effect whose amount is still a raw (ctx) => number closure (the exact shape this migration replaced)', () => {
    const card: CardDefinition = {
      name: 'Mock Raw Closure Card',
      manaCost: '{1}{W}',
      typeLine: 'Creature — Rabbit Noble',
      pt: [2, 2],
      triggers: [
        {
          name: 'onEnter',
          on: 'enter',
          effects: [
            {
              kind: 'createToken',
              token: { name: 'Rabbit', manaCost: '0', types: ['Creature', 'Rabbit'], basePower: 1, baseToughness: 1 },
              amount: (ctx) => ctx.you.getCreaturesInPlay().filter((c) => c.getName() === 'Mock Raw Closure Card' && c.getId() !== ctx.self.getId()).length,
            } satisfies Effect,
          ],
        },
      ],
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(false);
  });

  it('CONSUMER mode: does NOT match a board-count amount filtered on subtype instead of same-name (the -cats/-creatures shape, not this one)', () => {
    const card: CardDefinition = {
      name: 'Mock Subtype-Counted Card',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Cat Soldier',
      pt: [2, 2],
      triggers: [
        {
          name: 'onEnter',
          on: 'enter',
          effects: [
            {
              kind: 'createToken',
              token: { name: 'Cat', manaCost: '0', types: ['Creature', 'Cat'], basePower: 1, baseToughness: 1 },
              amount: you.creaturesInPlay().filter('subtype', 'Cat').count(),
            } satisfies Effect,
          ],
        },
      ],
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(false);
  });

  it('CONSUMER mode: does NOT match a vanilla card with no createToken effect at all', () => {
    const card: CardDefinition = {
      name: 'Mock Vanilla Creature',
      manaCost: '{1}{W}',
      typeLine: 'Creature — Human',
      pt: [1, 1],
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(false);
  });

  it('CONSUMER mode: matches via the BACK face of a transforming DFC (the same face-plurality convention -cats/-creatures already honor)', () => {
    const card: CardDefinition = {
      name: 'Mock Front Face',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Human',
      pt: [2, 2],
      backFace: {
        name: 'Mock Back Face',
        manaCost: '',
        typeLine: 'Creature — Rabbit Noble',
        pt: [3, 3],
        triggers: [
          {
            name: 'onEnter',
            on: 'enter',
            effects: [
              {
                kind: 'createToken',
                token: { name: 'Rabbit', manaCost: '0', types: ['Creature', 'Rabbit'], basePower: 1, baseToughness: 1 },
                amount: you.creaturesInPlay().filter('sameNameAsSelf').count(),
              } satisfies Effect,
            ],
          },
        ],
      },
    };
    expect(matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, card)).toBe(true);
  });
});
