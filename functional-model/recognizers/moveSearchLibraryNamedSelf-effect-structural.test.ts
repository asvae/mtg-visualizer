import { describe, expect, it } from 'vitest';
import { magitekInfantry } from '../cards/magitek-infantry/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import {
  recognizeMoveSearchLibraryNamedSelfEffectStructural,
  type StructuralRecognizerInput,
} from './moveSearchLibraryNamedSelf-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('moveSearchLibraryNamedSelf-effect-structural', () => {
  it('accepts Magitek Infantry ("Search your library for a card named Magitek Infantry, put it onto the battlefield tapped")', () => {
    const result = recognizeMoveSearchLibraryNamedSelfEffectStructural(structuralInput('Magitek Infantry', magitekInfantry));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          from: 'Library',
          to: 'Battlefield',
          controller: 'you',
          subject: 'self',
          name: { eq: 'Magitek Infantry' },
          tapped: true,
          annotations: [{ target: 'oracle', line: 1, start: 8, end: 97 }],
        },
        provenance: { origin: 'parser', rule: 'moveSearchLibraryNamedSelf-effect-structural' },
      },
      {
        role: 'sink',
        // 2026-09-16 SOURCE/SINK split fix: sink narrows to just "a card
        // named Magitek Infantry" [32,61) (the object phrase), not the
        // whole "Search your library for a card named Magitek Infantry,
        // put it onto the battlefield tapped" clause SOURCE keeps.
        fact: { to: 'Library', controller: 'you', name: { eq: 'Magitek Infantry' }, annotations: [{ target: 'oracle', line: 1, start: 32, end: 61 }] },
        provenance: { origin: 'parser', rule: 'moveSearchLibraryNamedSelf-effect-structural' },
      },
    ]);
    const input = structuralInput('Magitek Infantry', magitekInfantry);
    expect(input.oracleText.split('\n')[1]!.slice(32, 61)).toBe('a card named Magitek Infantry');
  });

  it('declines a card with no qualifying named-self search move on this face', () => {
    const result = recognizeMoveSearchLibraryNamedSelfEffectStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '', effects: [] });
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'move'") });
  });
});
