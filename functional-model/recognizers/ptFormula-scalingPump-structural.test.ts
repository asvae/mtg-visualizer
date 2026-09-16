// Verifies `ptFormula-scalingPump-structural.ts` against the one real card
// with `ptFormula.kind:'addPerEquipmentControlled'` (Adelbert Steiner) and
// the one real card with the OTHER `ptFormula` variant (Snow Villiers,
// `setToCreaturesControlled` — a genuinely different template, correctly
// out of scope for this recognizer).
import { describe, expect, it } from 'vitest';
import { adelbertSteiner } from '../cards/adelbert-steiner/definition';
import { gaelicat } from '../cards/gaelicat/definition';
import { gigantoad } from '../cards/gigantoad/definition';
import { magitekInfantry } from '../cards/magitek-infantry/definition';
import { scorpionSentinel } from '../cards/scorpion-sentinel/definition';
import { snowVilliers } from '../cards/snow-villiers/definition';
import { xandeDarkMage } from '../cards/xande-dark-mage/definition';
import { zellDincht } from '../cards/zell-dincht/definition';
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
  it('accepts Adelbert Steiner — "Adelbert Steiner gets +1/+1 for each Equipment you control." — SOURCE/SINK spans split (2026-09-16 fix)', () => {
    const result = recognizePtFormulaScalingPumpStructural(structuralInput('Adelbert Steiner', adelbertSteiner));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'pump', target: 'self', annotations: [{ target: 'oracle', line: 1, start: 0, end: 27 }] },
        provenance: { origin: 'parser', rule: 'ptFormula-scalingPump-structural' },
      },
      {
        role: 'sink',
        fact: {
          to: 'Battlefield',
          controller: 'you',
          types: { has: ['Equipment'] },
          annotations: [{ target: 'oracle', line: 1, start: 32, end: 58 }],
        },
        provenance: { origin: 'parser', rule: 'ptFormula-scalingPump-structural' },
      },
    ]);
  });

  it('declines Snow Villiers — ptFormula.kind:"setToCreaturesControlled", a different real template', () => {
    const result = recognizePtFormulaScalingPumpStructural(structuralInput('Snow Villiers', snowVilliers));
    expect(result.matched).toBe(false);
  });

  it('accepts Xande, Dark Mage — "gets +1/+1 for each noncreature, nonland card in your graveyard" (addPerGraveyardCount) — SOURCE/SINK spans split (2026-09-16 fix)', () => {
    const result = recognizePtFormulaScalingPumpStructural(structuralInput('Xande, Dark Mage', xandeDarkMage));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'pump', target: 'self', annotations: [{ target: 'oracle', line: 1, start: 0, end: 16 }] });
    expect(result.facts[1]!.fact).toMatchObject({
      to: 'Graveyard',
      controller: 'you',
      types: { not: ['Creature', 'Land'] },
      annotations: [{ target: 'oracle', line: 1, start: 21, end: 69 }],
    });
  });

  it('accepts Zell Dincht — "gets +1/+0 for each land you control" (addPerLandControlled) — SOURCE/SINK spans split (2026-09-16 fix)', () => {
    const result = recognizePtFormulaScalingPumpStructural(structuralInput('Zell Dincht', zellDincht));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'pump', target: 'self', annotations: [{ target: 'oracle', line: 1, start: 0, end: 22 }] });
    expect(result.facts[1]!.fact).toMatchObject({
      to: 'Battlefield',
      controller: 'you',
      types: { has: ['Land'] },
      annotations: [{ target: 'oracle', line: 1, start: 27, end: 48 }],
    });
  });

  it('accepts Gaelicat — "As long as you control two or more artifacts, this creature gets +2/+0." (thresholdBonus, min>=2, reversed word order) — SOURCE/SINK spans split (2026-09-16 fix)', () => {
    const result = recognizePtFormulaScalingPumpStructural(structuralInput('Gaelicat', gaelicat));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'pump', target: 'self', annotations: [{ target: 'oracle', line: 1, start: 46, end: 70 }] });
    expect(result.facts[1]!.fact).toMatchObject({
      to: 'Battlefield',
      controller: 'you',
      types: { has: ['Artifact'] },
      amount: { min: 2 },
      annotations: [{ target: 'oracle', line: 1, start: 11, end: 44 }],
    });
  });

  it('accepts Gigantoad — "As long as you control seven or more lands, this creature gets +2/+2." (thresholdBonus, min>=2, reversed word order) — SOURCE/SINK spans split (2026-09-16 fix)', () => {
    const result = recognizePtFormulaScalingPumpStructural(structuralInput('Gigantoad', gigantoad));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'pump', target: 'self', annotations: [{ target: 'oracle', line: 0, start: 44, end: 68 }] });
    expect(result.facts[1]!.fact).toMatchObject({
      to: 'Battlefield',
      controller: 'you',
      types: { has: ['Land'] },
      amount: { min: 7 },
      annotations: [{ target: 'oracle', line: 0, start: 11, end: 42 }],
    });
  });

  it('accepts Scorpion Sentinel — "As long as you control seven or more lands, this creature gets +3/+0." (thresholdBonus, min>=2, reversed word order) — SOURCE/SINK spans split (2026-09-16 fix)', () => {
    const result = recognizePtFormulaScalingPumpStructural(structuralInput('Scorpion Sentinel', scorpionSentinel));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'pump', target: 'self', annotations: [{ target: 'oracle', line: 0, start: 44, end: 68 }] });
    expect(result.facts[1]!.fact).toMatchObject({
      to: 'Battlefield',
      controller: 'you',
      types: { has: ['Land'] },
      amount: { min: 7 },
      annotations: [{ target: 'oracle', line: 0, start: 11, end: 42 }],
    });
  });

  it('accepts Magitek Infantry — "This creature gets +1/+0 as long as you control another artifact." (thresholdBonus, excludeSelf/min===1) — SOURCE/SINK spans split (2026-09-16 fix)', () => {
    const result = recognizePtFormulaScalingPumpStructural(structuralInput('Magitek Infantry', magitekInfantry));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'pump', target: 'self', annotations: [{ target: 'oracle', line: 0, start: 0, end: 24 }] });
    expect(result.facts[1]!.fact).toMatchObject({
      to: 'Battlefield',
      controller: 'you',
      types: { has: ['Artifact'] },
      amount: { min: 1 },
      excludeSelf: true,
      annotations: [{ target: 'oracle', line: 0, start: 36, end: 64 }],
    });
  });
});
