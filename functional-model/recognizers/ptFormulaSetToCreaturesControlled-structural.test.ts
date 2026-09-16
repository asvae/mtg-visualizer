import { describe, expect, it } from 'vitest';
import { snowVilliers } from '../cards/snow-villiers/definition';
import { ahriman } from '../cards/ahriman/definition';
import { exdeathVoidWarlock } from '../cards/exdeath-void-warlock-neo-exdeath-dimension-s-end/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import {
  recognizePtFormulaSetToCreaturesControlledStructural,
  type PtFormulaSetToCreaturesControlledRecognizerInput,
} from './ptFormulaSetToCreaturesControlled-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): PtFormulaSetToCreaturesControlledRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, ptFormula: def.ptFormula };
}

function backFaceStructuralInput(scryfallName: string, def: CardDefinition): PtFormulaSetToCreaturesControlledRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const back = def.backFace;
  if (!back) throw new Error(`fixture setup bug: "${def.name}" has no backFace`);
  return { name: back.name, typeLine: card.back.typeLine, oracleText: card.back.oracleText, ptFormula: back.ptFormula };
}

describe('ptFormulaSetToCreaturesControlled-structural', () => {
  it('accepts Snow Villiers — matches its own pre-existing hand-authored facts byte-for-byte', () => {
    const result = recognizePtFormulaSetToCreaturesControlledStructural(structuralInput('Snow Villiers', snowVilliers));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'pump', target: 'self', annotations: [{ target: 'oracle', line: 1, start: 16, end: 69 }] },
        provenance: { origin: 'parser', rule: 'ptFormulaSetToCreaturesControlled-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, annotations: [{ target: 'oracle', line: 1, start: 34, end: 69 }] },
        provenance: { origin: 'parser', rule: 'ptFormulaSetToCreaturesControlled-structural' },
      },
    ]);
  });

  it('declines a card with no ptFormula.kind:"setToCreaturesControlled" (Ahriman)', () => {
    const result = recognizePtFormulaSetToCreaturesControlledStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no ptFormula.kind') });
  });

  it("accepts Neo Exdeath, Dimension's End — \"power is equal to the number of permanent cards in your graveyard\" (setToGraveyardPermanentCount, closed 2026-09-16)", () => {
    const result = recognizePtFormulaSetToCreaturesControlledStructural(
      backFaceStructuralInput("Exdeath, Void Warlock // Neo Exdeath, Dimension's End", exdeathVoidWarlock),
    );
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'pump', target: 'self' });
    expect(result.facts[1]!.fact).toMatchObject({ to: 'Graveyard', controller: 'you', types: { hasAny: ['Creature', 'Artifact', 'Enchantment', 'Land'] } });
  });
});
