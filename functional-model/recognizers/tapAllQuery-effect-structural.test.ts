// Verifies `tapAllQuery-effect-structural.ts` against Summon: Alexander's
// own chapter III (the one real pool occurrence) and a scope decline.
import { describe, expect, it } from 'vitest';
import { crystalFragmentsSummonAlexander } from '../cards/crystal-fragments-summon-alexander/definition';
import { ahriman } from '../cards/ahriman/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeTapAllQueryEffectStructural, type StructuralRecognizerInput } from './tapAllQuery-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const faceData = face === 'front' ? card.front : card.back!;
  return { name: def.name, typeLine: faceData.typeLine, oracleText: faceData.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('tapAllQuery-effect-structural — "Tap all creatures your opponents control" (a real Each({kind:\'query\',owner:\'opponents\'}, tap()) program)', () => {
  it("accepts Summon: Alexander's own chapter III", () => {
    const result = recognizeTapAllQueryEffectStructural(structuralInput('Crystal Fragments // Summon: Alexander', crystalFragmentsSummonAlexander.backFace!, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]!.role).toBe('source');
    expect(result.facts[1]!.role).toBe('sink');
  });

  it('declines a real card with no program effect at all (Ahriman)', () => {
    const result = recognizeTapAllQueryEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'program'") });
  });
});
