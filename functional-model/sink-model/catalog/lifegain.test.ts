// Real corpus verification for the `lifegain` sink catalog entry — the
// STRUCTURAL GATE `sink-catalog-status.ts` reads (via this file's own
// sibling `lifegain.corpus.json`) to decide gray/purple/blue. Per this
// project's own confirmed convention (`.claude/agent-memory/engine/notes.md`
// / project memory "Predicate corpus uses mocks"), every fixture below is a
// MOCKED `CardDefinition` — never a real pool card — because the gate cares
// about the STRUCTURAL SHAPE `matchSink` recognizes, not which real card
// happens to have it.
import { describe, expect, it } from 'vitest';
import type { CardDefinition, Effect } from '../../card';
import { matchSink } from '../match-sink';
import { query } from './lifegain';

describe('lifegain sink catalog entry — corpus (mocked CardDefinition fixtures)', () => {
  it('matches a plain effect-level gainLife (a real, direct "you gain N life" spell/permanent effect)', () => {
    const card: CardDefinition = {
      name: 'Mock Lifegain Spell',
      manaCost: '{1}{W}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'gainLife', amount: 3 } satisfies Effect],
    };
    expect(matchSink(query, card).matched).toBe(true);
  });

  it('matches a TRIGGERED gainLife (a real "when this enters, you gain life" permanent — trigger effects are walked too, not just top-level effects)', () => {
    const card: CardDefinition = {
      name: 'Mock Lifegain Creature',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Bird',
      pt: [1, 1],
      triggers: [{ name: 'onEnter', on: 'enter', effects: [{ kind: 'gainLife', amount: 1 } satisfies Effect] }],
    };
    expect(matchSink(query, card).matched).toBe(true);
  });

  it('does NOT match a vanilla creature with no effects at all (baseline "enters the battlefield" occurrence is zone-shaped, not lifegain)', () => {
    const card: CardDefinition = {
      name: 'Mock Vanilla Creature',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Human',
      pt: [2, 2],
    };
    expect(matchSink(query, card).matched).toBe(false);
  });

  it('does NOT match a card whose only effect is an unrelated kind (drawCard) — real discrimination, not a vacuous match', () => {
    const card: CardDefinition = {
      name: 'Mock Card Draw Spell',
      manaCost: '{1}{U}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'drawCard' } satisfies Effect],
    };
    expect(matchSink(query, card).matched).toBe(false);
  });
});
