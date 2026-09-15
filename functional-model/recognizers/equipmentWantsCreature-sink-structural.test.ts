// Verifies `equipmentWantsCreature-sink-structural.ts` against Crystal
// Fragments' own front face (no flavor-name prefix), a flavor-name-prefixed
// real card, the one real confirmed non-`{N}` decline, and a non-Equipment
// decline.
import { describe, expect, it } from 'vitest';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeEquipmentWantsCreatureSinkStructural } from './equipmentWantsCreature-sink-structural';
import type { RecognizerInput } from './types';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, face: 'front' | 'back' = 'front'): RecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const faceData = face === 'front' ? card.front : card.back!;
  return { name: card.name, typeLine: faceData.typeLine, oracleText: faceData.oracleText };
}

describe('equipmentWantsCreature-sink-structural — every real Equipment wants a creature present to equip onto (301.5c)', () => {
  it('accepts Crystal Fragments\' own front face ("Equip {1}", no flavor-name prefix)', () => {
    const result = recognizeEquipmentWantsCreatureSinkStructural(structuralInput('Crystal Fragments // Summon: Alexander', 'front'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, annotations: [{ target: 'oracle', line: 2, start: 0, end: 9 }] },
        provenance: { origin: 'parser', rule: 'equipmentWantsCreature-sink-structural' },
      },
    ]);
  });

  it("accepts Dragoon's Lance (flavor-name-prefixed \"Gae Bolg — Equip {4}\")", () => {
    const result = recognizeEquipmentWantsCreatureSinkStructural(structuralInput("Dragoon's Lance"));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it("declines Dark Knight's Greatsword (a real, confirmed non-mana Equip cost — 702.6e)", () => {
    const result = recognizeEquipmentWantsCreatureSinkStructural(structuralInput("Dark Knight's Greatsword"));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no literal "Equip {N}" cost') });
  });

  it('declines a non-Equipment permanent (Coeurl)', () => {
    const result = recognizeEquipmentWantsCreatureSinkStructural(structuralInput('Coeurl'));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no "Equipment" subtype') });
  });
});
