// Unit tests for the `lifegain` matcher catalog entry — the
// STRUCTURAL GATE `matcher-catalog-status.ts` reads (via this file's own
// sibling `lifegain.corpus.json`) to decide gray/purple/blue. Per this
// project's own confirmed convention (`.claude/agent-memory/engine/notes.md`
// / project memory "Predicate corpus uses mocks"), every fixture below is a
// MOCKED `CardDefinition` — never a real pool card — because the gate cares
// about the STRUCTURAL SHAPE `matchQuery` recognizes, not which real card
// happens to have it.
//
// **2026-09-18, later the same day: consumer-side cases added.** Gates
// `entry.consumerTriggerNames` (`matchesConsumerTriggerNames`) alongside the
// pre-existing producer-side `query`/`matchQuery` cases above — a genuinely
// different recognition mode (does a candidate's OWN `Trigger.name` react to
// lifegain, vs. does it cause lifegain), never oracle/printed text. Mocked
// fixtures carry only structured `CardDefinition` fields (a `triggers[].name`
// string), same as every other fixture in this file.
import { describe, expect, it } from 'vitest';
import type { CardDefinition, Effect } from '../../card';
import { matchesConsumerTriggerNames, matchQuery } from '../match-query';
import { entry, query } from './lifegain';

describe('lifegain matcher catalog entry (mocked CardDefinition fixtures)', () => {
  it('matches a plain effect-level gainLife (a real, direct "you gain N life" spell/permanent effect)', () => {
    const card: CardDefinition = {
      name: 'Mock Lifegain Spell',
      manaCost: '{1}{W}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'gainLife', amount: 3 } satisfies Effect],
    };
    expect(matchQuery(query, card).matched).toBe(true);
  });

  it('matches a TRIGGERED gainLife (a real "when this enters, you gain life" permanent — trigger effects are walked too, not just top-level effects)', () => {
    const card: CardDefinition = {
      name: 'Mock Lifegain Creature',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Bird',
      pt: [1, 1],
      triggers: [{ name: 'onEnter', on: 'enter', effects: [{ kind: 'gainLife', amount: 1 } satisfies Effect] }],
    };
    expect(matchQuery(query, card).matched).toBe(true);
  });

  it('does NOT match a vanilla creature with no effects at all (baseline "enters the battlefield" occurrence is zone-shaped, not lifegain)', () => {
    const card: CardDefinition = {
      name: 'Mock Vanilla Creature',
      manaCost: '{2}{W}',
      typeLine: 'Creature — Human',
      pt: [2, 2],
    };
    expect(matchQuery(query, card).matched).toBe(false);
  });

  it('does NOT match a card whose only effect is an unrelated kind (drawCard) — real discrimination, not a vacuous match', () => {
    const card: CardDefinition = {
      name: 'Mock Card Draw Spell',
      manaCost: '{1}{U}',
      typeLine: 'Sorcery',
      effects: [{ kind: 'drawCard' } satisfies Effect],
    };
    expect(matchQuery(query, card).matched).toBe(false);
  });

  it('CONSUMER mode: matches a card whose own named trigger is "onLifeGained" (the real Ajani\'s Pridemate shape) even though it has no gainLife effect of its own — the producer query alone declines it', () => {
    const card: CardDefinition = {
      name: 'Mock Lifegain Reactor',
      manaCost: '{1}{W}',
      typeLine: 'Creature — Cat Soldier',
      pt: [2, 2],
      triggers: [{ name: 'onLifeGained', effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect] }],
    };
    expect(matchQuery(query, card).matched).toBe(false);
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

  it('CONSUMER mode: matches a card whose own named trigger is "onLifeGain" (the real Exemplar of Light, FDN #11, shape — a real spelling variant of the same convention, not a typo to collapse into one canonical name)', () => {
    const card: CardDefinition = {
      name: 'Mock Lifegain Reactor 2',
      manaCost: '{2}{W}{W}',
      typeLine: 'Creature — Angel',
      pt: [3, 3],
      triggers: [{ name: 'onLifeGain', effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect] }],
    };
    expect(matchQuery(query, card).matched).toBe(false);
    expect(matchesConsumerTriggerNames(entry.consumerTriggerNames, card)).toBe(true);
  });

  it('CONSUMER mode: matches via the BACK face of a transforming DFC (the same face-plurality convention deriveOccurrences itself already honors)', () => {
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
        triggers: [{ name: 'onLifeGained', effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect] }],
      },
    };
    expect(matchesConsumerTriggerNames(entry.consumerTriggerNames, card)).toBe(true);
  });
});
