// Verifies `ptFormula-scalingPump-structural.ts` against the one real card
// with `ptFormula.kind:'addPerEquipmentControlled'` (Adelbert Steiner) and
// the one real card with the OTHER `ptFormula` variant (Snow Villiers,
// `setToCreaturesControlled` — a genuinely different template, correctly
// out of scope for this recognizer).
import { describe, expect, it } from 'vitest';
import { adelbertSteiner } from '../cards/adelbert-steiner/definition';
import { snowVilliers } from '../cards/snow-villiers/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizePtFormulaScalingPumpStructural, type PtFormulaRecognizerInput } from './ptFormula-scalingPump-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): PtFormulaRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, ptFormula: def.ptFormula };
}

describe('ptFormula-scalingPump-structural', () => {
  it('accepts Adelbert Steiner — "Adelbert Steiner gets +1/+1 for each Equipment you control."', () => {
    const result = recognizePtFormulaScalingPumpStructural(structuralInput('Adelbert Steiner', adelbertSteiner));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'pump', target: 'self', annotations: [{ target: 'oracle', line: 1, start: expect.any(Number), end: expect.any(Number) }] },
        provenance: { origin: 'parser', rule: 'ptFormula-scalingPump-structural' },
      },
      {
        role: 'sink',
        fact: {
          to: 'Battlefield',
          controller: 'you',
          types: { has: ['Equipment'] },
          annotations: [{ target: 'oracle', line: 1, start: expect.any(Number), end: expect.any(Number) }],
        },
        provenance: { origin: 'parser', rule: 'ptFormula-scalingPump-structural' },
      },
    ]);
  });

  it('declines Snow Villiers — ptFormula.kind:"setToCreaturesControlled", a different real template', () => {
    const result = recognizePtFormulaScalingPumpStructural(structuralInput('Snow Villiers', snowVilliers));
    expect(result.matched).toBe(false);
  });
});
