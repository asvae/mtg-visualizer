// Real corpus verification for the `battlefield-presence-hare-apparent`
// sink catalog entry — see `lifegain.test.ts`'s own header for the "mocked
// fixtures, not real cards" convention this mirrors (the structural gate
// cares about the SHAPE `matchSink`/`matchesBattlefieldPresenceConsumer`
// recognize, not which real card happens to have it — except CONSUMER case
// 1 below, which deliberately mirrors the real Hare Apparent shape
// byte-for-byte since this entry's own `query`/`amount` walk is
// name-literal, not generic). See `battlefield-presence-hare-apparent.ts`'s
// own header for the full "third filter variant" writeup.
import { describe, expect, it } from 'vitest';
import type { CardDefinition, Effect } from '../../card';
import { you } from '../../combinator';
import { matchesBattlefieldPresenceConsumer, matchSink } from '../match-sink';
import { entry, query } from './battlefield-presence-hare-apparent';

describe('battlefield-presence-hare-apparent sink catalog entry — corpus (mocked CardDefinition fixtures)', () => {
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
