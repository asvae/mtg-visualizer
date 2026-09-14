// Verifies `gainLife-effect-structural.ts` against real cards: Battle Menu
// (the motivating card, a single modal-mode "You gain 4 life."),
// Restoration Magic (two DIFFERENT literal amounts on the same face, each
// anchored to its own real line — no ambiguity), Al Bhed Salvagers (a real
// same-clause `loseLife`+`gainLife` pair — confirms the tight pattern only
// ever matches the "gain" half), and Omega, Heartless Evolution (a real
// `Computed<number>` decline).
import { describe, expect, it } from 'vitest';
import { battleMenu } from '../cards/battle-menu/definition';
import { restorationMagic } from '../cards/restoration-magic/definition';
import { alBhedSalvagers } from '../cards/al-bhed-salvagers/definition';
import { omegaHeartlessEvolution } from '../cards/omega-heartless-evolution/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeGainLifeEffectStructural, type StructuralRecognizerInput } from './gainLife-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('gainLife-effect-structural', () => {
  it('accepts Battle Menu — "You gain 4 life."', () => {
    const result = recognizeGainLifeEffectStructural(structuralInput('Battle Menu', battleMenu));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'lifegain', controller: 'you', annotations: [{ target: 'oracle', line: 4, start: 9, end: 24 }] },
        provenance: { origin: 'parser', rule: 'gainLife-effect-structural' },
      },
    ]);
  });

  it('accepts Restoration Magic — two different literal amounts, each on its own real line', () => {
    const result = recognizeGainLifeEffectStructural(structuralInput('Restoration Magic', restorationMagic));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
  });

  it('accepts Al Bhed Salvagers — a same-clause loseLife+gainLife pair; only the "gain" half matches', () => {
    const result = recognizeGainLifeEffectStructural(structuralInput('Al Bhed Salvagers', alBhedSalvagers));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
  });

  it('declines Omega, Heartless Evolution — Computed<number> amount', () => {
    const result = recognizeGainLifeEffectStructural(structuralInput('Omega, Heartless Evolution', omegaHeartlessEvolution));
    expect(result.matched).toBe(false);
  });
});
