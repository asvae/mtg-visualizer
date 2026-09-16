// Verifies `surveil-effect-structural.ts` against a spread of real pool
// matches — see that recognizer's own module doc comment for the full
// pool-wide check.
import { describe, expect, it } from 'vitest';
import { dreamsOfLaguna } from '../cards/dreams-of-laguna/definition';
import { ilMhegPixie } from '../cards/il-mheg-pixie/definition';
import { golbezCrystalCollector } from '../cards/golbez-crystal-collector/definition';
import { summonGfCerberus } from '../cards/summon-g-f-cerberus/definition';
import { ahriman } from '../cards/ahriman/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeSurveilEffectStructural, type StructuralRecognizerInput } from './surveil-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('surveil-effect-structural', () => {
  it('accepts Dreams of Laguna ("Surveil 1, then draw a card.") — matches its own pre-existing hand-authored fact byte-for-byte', () => {
    const result = recognizeSurveilEffectStructural(structuralInput('Dreams of Laguna', dreamsOfLaguna));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'surveil', controller: 'you', annotations: [{ target: 'oracle', line: 0, start: 0, end: 9 }] },
        provenance: { origin: 'parser', rule: 'surveil-effect-structural' },
      },
    ]);
  });

  it('accepts Il Mheg Pixie (mid-sentence lowercase "surveil 1") — matches its own pre-existing hand-authored fact byte-for-byte', () => {
    const result = recognizeSurveilEffectStructural(structuralInput('Il Mheg Pixie', ilMhegPixie));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'surveil', controller: 'you', annotations: [{ target: 'oracle', line: 1, start: 32, end: 41 }], triggeredBy: 'onAttack' },
        provenance: { origin: 'parser', rule: 'surveil-effect-structural' },
      },
    ]);
  });

  it('accepts Golbez, Crystal Collector (previously a total gap, no fact at all)', () => {
    const result = recognizeSurveilEffectStructural(structuralInput('Golbez, Crystal Collector', golbezCrystalCollector));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]).toMatchObject({ role: 'source', fact: { event: 'surveil', controller: 'you' } });
  });

  it('accepts Summon: G.F. Cerberus ("I — Surveil 1." — Saga chapter, capitalized after the em dash)', () => {
    const result = recognizeSurveilEffectStructural(structuralInput('Summon: G.F. Cerberus', summonGfCerberus));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]).toMatchObject({ role: 'source', fact: { event: 'surveil', controller: 'you' } });
  });

  it("declines a real card with no kind:'surveil' effect at all (Ahriman)", () => {
    const result = recognizeSurveilEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'surveil'") });
  });
});
