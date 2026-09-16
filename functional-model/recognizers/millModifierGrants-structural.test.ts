// Verifies `millModifierGrants-structural.ts` against the real, whole-pool
// 1-card set: The Water Crystal's own "If an opponent would mill one or
// more cards, they mill that many cards plus four instead."
import { describe, expect, it } from 'vitest';
import { theWaterCrystal } from '../cards/the-water-crystal/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeMillModifierGrantsStructural, type MillModifierGrantsRecognizerInput } from './millModifierGrants-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): MillModifierGrantsRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, millModifierGrants: def.millModifierGrants };
}

describe('millModifierGrants-structural', () => {
  it('accepts The Water Crystal — "If an opponent would mill one or more cards, they mill that many cards plus four instead."', () => {
    const input = structuralInput('The Water Crystal', theWaterCrystal);
    const result = recognizeMillModifierGrantsStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'millIncrease', controller: 'opp', annotations: [expect.objectContaining({ target: 'oracle' })] },
        provenance: { origin: 'parser', rule: 'millModifierGrants-structural' },
      },
    ]);
    const ann = result.facts[0]!.fact.annotations![0]!;
    const line = input.oracleText.split('\n')[ann.line]!;
    expect(line.slice(ann.start, ann.end)).toBe('If an opponent would mill one or more cards, they mill that many cards plus four instead.');
  });

  it('declines a card with no millModifierGrants entry at all', () => {
    const result = recognizeMillModifierGrantsStructural(structuralInput('Ahriman', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no millModifierGrants entry') });
  });
});
