// Unit tests for the `graveyard-fodder` matcher catalog entry —
// see `lifegain.test.ts`'s own header for the "mocked fixtures, not real
// cards" convention this mirrors.
import { describe, expect, it } from 'vitest';
import type { CardDefinition, Effect } from '../../card';
import { matchQuery } from '../match-query';
import { query } from './graveyard-fodder';

describe('graveyard-fodder matcher catalog entry (mocked CardDefinition fixtures)', () => {
  it('matches an unrestricted "destroy target creature" effect (guaranteed Creature -> Graveyard arrival)', () => {
    const card: CardDefinition = {
      name: 'Mock Removal Spell',
      manaCost: '{1}{B}',
      typeLine: 'Instant',
      effects: [{ kind: 'destroy', validType: 'creature', qty: 1 } satisfies Effect],
    };
    expect(matchQuery(query, card).matched).toBe(true);
  });

  it('matches a self-sacrifice effect (701.16 always genuinely dies — no indestructible/regeneration escape the way `destroy` has)', () => {
    const card: CardDefinition = {
      name: 'Mock Sacrifice-a-Creature Spell',
      manaCost: '{B}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'sacrifice', owner: 'you', validType: 'creature' } satisfies Effect],
    };
    expect(matchQuery(query, card).matched).toBe(true);
  });

  it('does NOT match an unrestricted "destroy target permanent" (no guaranteed Creature type — could legally hit a land/artifact instead)', () => {
    const card: CardDefinition = {
      name: 'Mock Generic Removal Spell',
      manaCost: '{2}{B}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'destroy', validType: 'permanent', qty: 1 } satisfies Effect],
    };
    expect(matchQuery(query, card).matched).toBe(false);
  });

  it('does NOT match a vanilla, non-creature-destroying card at all (a bare lifegain spell)', () => {
    const card: CardDefinition = {
      name: 'Mock Lifegain Spell',
      manaCost: '{1}{W}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'gainLife', amount: 2 } satisfies Effect],
    };
    expect(matchQuery(query, card).matched).toBe(false);
  });
});
