import { describe, expect, it } from 'vitest';
import { edgarKingOfFigaro } from '../cards/edgar-king-of-figaro/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeWinCoinFlipStructural, type WinCoinFlipRecognizerInput } from './winCoinFlip-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): WinCoinFlipRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, keywords: def.keywords };
}

describe('winCoinFlip-structural', () => {
  it('accepts Edgar, King of Figaro ("Two-Headed Coin — ... you win those flips")', () => {
    const result = recognizeWinCoinFlipStructural(structuralInput('Edgar, King of Figaro', edgarKingOfFigaro));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'winCoinFlip', controller: 'you', annotations: [{ target: 'oracle', line: 1, start: 0, end: 120 }] },
        provenance: { origin: 'parser', rule: 'winCoinFlip-structural' },
      },
    ]);
  });

  it("declines a card with no 'TwoHeadedCoin' keyword", () => {
    const result = recognizeWinCoinFlipStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '', keywords: ['Flying'] });
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no 'TwoHeadedCoin' entry") });
  });
});
