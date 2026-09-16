import { describe, expect, it } from 'vitest';
import { fromFatherToSon } from '../cards/from-father-to-son/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import {
  recognizeMoveConditionalDestinationByCastFromEffectStructural,
  type StructuralRecognizerInput,
} from './moveConditionalDestinationByCastFrom-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('moveConditionalDestinationByCastFrom-effect-structural', () => {
  it('accepts From Father to Son (Hand normally, Battlefield if cast from a graveyard)', () => {
    const result = recognizeMoveConditionalDestinationByCastFromEffectStructural(structuralInput('From Father to Son', fromFatherToSon));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { from: 'Library', to: 'Hand', controller: 'you', types: { has: ['Vehicle'] }, annotations: [{ target: 'oracle', line: 0, start: 0, end: 76 }] },
        provenance: { origin: 'parser', rule: 'moveConditionalDestinationByCastFrom-effect-structural' },
      },
      {
        role: 'source',
        fact: {
          from: 'Library',
          to: 'Battlefield',
          controller: 'you',
          types: { has: ['Vehicle'] },
          annotations: [{ target: 'oracle', line: 0, start: 96, end: 161 }],
        },
        provenance: { origin: 'parser', rule: 'moveConditionalDestinationByCastFrom-effect-structural' },
      },
      {
        role: 'sink',
        // 2026-09-16 SOURCE/SINK split fix: sink narrows to just "a
        // Vehicle card" [24,38) (the object phrase), not the whole
        // "Search your library for a Vehicle card, reveal it, and put it
        // into your hand" clause the normal-zone SOURCE keeps.
        fact: { to: 'Library', controller: 'you', types: { has: ['Vehicle'] }, annotations: [{ target: 'oracle', line: 0, start: 24, end: 38 }] },
        provenance: { origin: 'parser', rule: 'moveConditionalDestinationByCastFrom-effect-structural' },
      },
    ]);
    // Real regression-guard: the widened spans are now whole real clauses,
    // not bare "put it/that card ... " tails — slice-and-assert the LITERAL
    // substring, not just the offsets.
    const oracle = finCards.get('From Father to Son')!.front.oracleText;
    expect(oracle.slice(0, 76)).toBe('Search your library for a Vehicle card, reveal it, and put it into your hand');
    expect(oracle.slice(96, 161)).toBe('cast from a graveyard, put that card onto the battlefield instead');
    expect(oracle.slice(24, 38)).toBe('a Vehicle card');
  });

  it('declines a card with no qualifying move effect on this face', () => {
    const result = recognizeMoveConditionalDestinationByCastFromEffectStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '', effects: [] });
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'move'") });
  });
});
