// Verifies `flashback-alternateCost-structural.ts` against real cards:
// Auron's Inspiration (the motivating card, straightforward reminder text)
// and Laughing Mad (the one real card whose own printed reminder text
// inserts "and any additional costs" mid-clause — confirms the recognizer's
// own required substring is still found verbatim despite that insertion).
import { describe, expect, it } from 'vitest';
import { auronSInspiration } from '../cards/auron-s-inspiration/definition';
import { laughingMad } from '../cards/laughing-mad/definition';
import { adelbertSteiner } from '../cards/adelbert-steiner/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeFlashbackAlternateCostStructural, type FlashbackRecognizerInput } from './flashback-alternateCost-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): FlashbackRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, alternateCosts: def.alternateCosts };
}

describe('flashback-alternateCost-structural', () => {
  it("accepts Auron's Inspiration — plain Flashback reminder text", () => {
    const result = recognizeFlashbackAlternateCostStructural(structuralInput("Auron's Inspiration", auronSInspiration));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'cast', from: 'Graveyard', target: 'self', annotations: [{ target: 'oracle', line: 1, start: expect.any(Number), end: expect.any(Number) }] },
        provenance: { origin: 'parser', rule: 'flashback-alternateCost-structural' },
      },
      {
        role: 'source',
        fact: { to: 'Exile', controller: 'you', subject: 'self', annotations: [{ target: 'oracle', line: 1, start: expect.any(Number), end: expect.any(Number) }] },
        provenance: { origin: 'parser', rule: 'flashback-alternateCost-structural' },
      },
    ]);
  });

  it('accepts Laughing Mad — "and any additional costs" insertion does not break the required substring match', () => {
    const result = recognizeFlashbackAlternateCostStructural(structuralInput('Laughing Mad', laughingMad));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('declines Adelbert Steiner — no alternateCosts at all', () => {
    const result = recognizeFlashbackAlternateCostStructural(structuralInput('Adelbert Steiner', adelbertSteiner));
    expect(result.matched).toBe(false);
  });
});
