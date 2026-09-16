import { describe, expect, it } from 'vitest';
import { fateOfTheSunCryst } from '../cards/fate-of-the-sun-cryst/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeCostReductionTappedTargetStructural, type CostReductionRecognizerInput } from './costReductionTappedTarget-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): CostReductionRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, costReduction: def.costReduction };
}

describe('costReductionTappedTarget-structural', () => {
  it('accepts Fate of the Sun-Cryst', () => {
    const result = recognizeCostReductionTappedTargetStructural(structuralInput('Fate of the Sun-Cryst', fateOfTheSunCryst));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: { to: 'Battlefield', types: { has: ['Creature'] }, tapped: true, annotations: [{ target: 'oracle', line: 0, start: 0, end: 65 }] },
        provenance: { origin: 'parser', rule: 'costReductionTappedTarget-structural' },
      },
    ]);
  });

  it('annotation covers the whole cost-condition clause, not just "a tapped creature" (2026-09-16 widening — verify-text-coverage.mjs gap)', () => {
    const card = finCards.get('Fate of the Sun-Cryst');
    if (!card) throw new Error('fixture setup bug');
    const result = recognizeCostReductionTappedTargetStructural(structuralInput('Fate of the Sun-Cryst', fateOfTheSunCryst));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const ann = result.facts[0]!.fact.annotations![0]!;
    const line = card.front.oracleText.split('\n')[ann.line as number]!;
    expect(line.slice(ann.start as number, ann.end as number)).toBe(
      'This spell costs {2} less to cast if it targets a tapped creature',
    );
  });

  it('declines a card with no costReduction.condition === "tappedCreatureTarget"', () => {
    const result = recognizeCostReductionTappedTargetStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '' });
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('tappedCreatureTarget') });
  });
});
