// Verifies `discardSelfCost-structural.ts` against 2 of the real 8-card
// pool matches its own module doc comment names.
import { describe, expect, it } from 'vitest';
import { cloudboundMoogle } from '../cards/cloudbound-moogle/definition';
import { hillGigas } from '../cards/hill-gigas/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeDiscardSelfCostStructural, type StructuralRecognizerInput } from './discardSelfCost-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('discardSelfCost-structural — abilities[].cost matching costRequiresDiscardSelf', () => {
  it('accepts Cloudbound Moogle — matches its own pre-existing hand-authored fact byte-for-byte', () => {
    const result = recognizeDiscardSelfCostStructural(structuralInput('Cloudbound Moogle', cloudboundMoogle));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: { event: 'discard', target: 'self', annotations: [{ target: 'oracle', line: 2, start: 24, end: 41 }] },
        provenance: { origin: 'parser', rule: 'discardSelfCost-structural' },
      },
    ]);
  });

  it('accepts Hill Gigas — Mountaincycling, migrated onto the same structured `abilities` shape as Cloudbound Moogle (2026-09-15)', () => {
    const result = recognizeDiscardSelfCostStructural(structuralInput('Hill Gigas', hillGigas));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'discard', target: 'self' });
  });
});
