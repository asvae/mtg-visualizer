import { describe, expect, it } from 'vitest';
import { theWindCrystal } from '../cards/the-wind-crystal/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeLifegainDoubleKeywordStructural, type LifegainDoubleKeywordRecognizerInput } from './lifegainDoubleKeyword-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): LifegainDoubleKeywordRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, keywords: def.keywords };
}

describe('lifegainDoubleKeyword-structural', () => {
  it('accepts The Wind Crystal ("If you would gain life, you gain twice that much life instead")', () => {
    const result = recognizeLifegainDoubleKeywordStructural(structuralInput('The Wind Crystal', theWindCrystal));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'lifegainDouble', controller: 'you', annotations: [{ target: 'oracle', line: 1, start: 0, end: 61 }] },
        provenance: { origin: 'parser', rule: 'lifegainDoubleKeyword-structural' },
      },
    ]);
  });

  it("declines a card with no 'LifegainDouble' keyword", () => {
    const result = recognizeLifegainDoubleKeywordStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '', keywords: ['Flying'] });
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no 'LifegainDouble' entry") });
  });
});
