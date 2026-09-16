import { describe, expect, it } from 'vitest';
import { whiteAuracite } from '../cards/white-auracite/definition';
import { sidequestCatchAFish } from '../cards/sidequest-catch-a-fish-cooking-campsite/definition';
import { capitalCity } from '../cards/capital-city/definition';
import { ringOfTheLucii } from '../cards/ring-of-the-lucii/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeManaAbilitiesSimpleStructural, type ManaAbilitiesRecognizerInput } from './manaAbilitiesSimple-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): ManaAbilitiesRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const half = face === 'back' ? card.back! : card.front;
  const def2 = face === 'back' ? def.backFace! : def;
  return { name: def2.name, typeLine: half.typeLine, oracleText: half.oracleText, manaAbilities: def2.manaAbilities };
}

describe('manaAbilitiesSimple-structural', () => {
  it('accepts White Auracite (single color, "Add {W}")', () => {
    const result = recognizeManaAbilitiesSimpleStructural(structuralInput('White Auracite', whiteAuracite));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'addMana', controller: 'you', colors: { has: ['W'] }, annotations: [{ target: 'oracle', line: 1, start: 5, end: 12 }] },
        provenance: { origin: 'parser', rule: 'manaAbilitiesSimple-structural' },
      },
    ]);
  });

  it('accepts Sidequest: Catch a Fish // Cooking Campsite\'s back face (Cooking Campsite, single color)', () => {
    const result = recognizeManaAbilitiesSimpleStructural(structuralInput('Sidequest: Catch a Fish // Cooking Campsite', sidequestCatchAFish, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Capital City (2 manaAbilities entries, only the plain {C} one qualifies)', () => {
    const result = recognizeManaAbilitiesSimpleStructural(structuralInput('Capital City', capitalCity));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'addMana', colors: { has: ['C'] } });
  });

  it('accepts Ring of the Lucii (colorless, amount:2 — "Add {C}{C}")', () => {
    const result = recognizeManaAbilitiesSimpleStructural(structuralInput('Ring of the Lucii', ringOfTheLucii));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'addMana', colors: { has: ['C'] } });
  });

  it('declines a card with no manaAbilities on this face', () => {
    const result = recognizeManaAbilitiesSimpleStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '', manaAbilities: undefined });
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no manaAbilities entry') });
  });
});
