// Verifies `sequenceExileReturn-effect-structural.ts` against all 3 real
// pool occurrences of `kind:'program'` + `Sequence('Exile','Battlefield')`,
// plus a scope decline.
import { describe, expect, it } from 'vitest';
import { crystalFragmentsSummonAlexander } from '../cards/crystal-fragments-summon-alexander/definition';
import { dionBahamutsDominant } from '../cards/dion-bahamut-s-dominant-bahamut-warden-of-light/definition';
import { ahriman } from '../cards/ahriman/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import {
  recognizeSequenceExileReturnEffectStructural,
  type StructuralRecognizerInput,
} from './sequenceExileReturn-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const faceData = face === 'front' ? card.front : card.back!;
  return { name: def.name, typeLine: faceData.typeLine, oracleText: faceData.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('sequenceExileReturn-effect-structural — "Exile X, then return it to the battlefield" (a real Sequence(\'Exile\',\'Battlefield\') program)', () => {
  it('accepts Crystal Fragments\' own front face ("Exile this Equipment...")', () => {
    const result = recognizeSequenceExileReturnEffectStructural(structuralInput('Crystal Fragments // Summon: Alexander', crystalFragmentsSummonAlexander, 'front'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]!.fact).toMatchObject({ to: 'Exile', from: 'Battlefield', subject: 'self' });
    expect(result.facts[1]!.fact).toMatchObject({ event: 'entersBattlefield', to: 'Battlefield', from: 'Exile', subject: 'self', target: 'self' });
  });

  it('accepts Dion\'s own front face ("Exile Dion...")', () => {
    const result = recognizeSequenceExileReturnEffectStructural(structuralInput('Dion, Bahamut\'s Dominant // Bahamut, Warden of Light', dionBahamutsDominant, 'front'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Dion\'s own back face chapter III ("Exile Bahamut...")', () => {
    const result = recognizeSequenceExileReturnEffectStructural(structuralInput('Dion, Bahamut\'s Dominant // Bahamut, Warden of Light', dionBahamutsDominant.backFace!, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('declines a real card with no program effect at all (Ahriman)', () => {
    const result = recognizeSequenceExileReturnEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'program'") });
  });
});
