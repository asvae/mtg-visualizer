import { describe, expect, it } from 'vitest';
import { theWindCrystal } from '../cards/the-wind-crystal/definition';
import { theWaterCrystal } from '../cards/the-water-crystal/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeSpellCostReductionGrantsStructural, type SpellCostReductionGrantsRecognizerInput } from './spellCostReductionGrants-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): SpellCostReductionGrantsRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, spellCostReductionGrants: def.spellCostReductionGrants };
}

describe('spellCostReductionGrants-structural', () => {
  it('accepts The Wind Crystal ("White spells you cast cost {1} less to cast")', () => {
    const result = recognizeSpellCostReductionGrantsStructural(structuralInput('The Wind Crystal', theWindCrystal));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'costReduction', controller: 'you', colors: { has: ['W'] }, annotations: [{ target: 'oracle', line: 0, start: 0, end: 43 }] },
        provenance: { origin: 'parser', rule: 'spellCostReductionGrants-structural' },
      },
    ]);
  });

  it('accepts The Water Crystal ("Blue spells you cast cost {1} less to cast")', () => {
    const result = recognizeSpellCostReductionGrantsStructural(structuralInput('The Water Crystal', theWaterCrystal));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('declines a card with no spellCostReductionGrants entry at all', () => {
    const result = recognizeSpellCostReductionGrantsStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '' });
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no spellCostReductionGrants entry') });
  });
});
