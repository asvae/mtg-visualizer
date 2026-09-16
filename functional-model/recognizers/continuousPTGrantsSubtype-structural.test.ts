// Verifies `continuousPTGrantsSubtype-structural.ts` against its 3 real
// cards: elvish-archdruid ("Other Elf creatures you control get +1/+1"),
// thranduil-sindarin-liege ("Other Elves you control get +1/+1" — a
// different real phrasing for the identical grant shape), and serah-farron-
// crystallized-serah's own back face ("Legendary creatures you control get
// +2/+2" — no "Other" prefix). Elvish Archdruid and Thranduil, Sindarin
// Liege are both cross-set reference cards with no real oracle text checked
// in anywhere under `data/*/*_scryfall.json` (confirmed via
// `apply-recognizers.mjs`'s own "skip, no oracle text found" path) — same
// real, permanent testing gap `addMana-effect-structural.test.ts`'s own
// module doc comment already documents for Elvish Archdruid specifically;
// only Serah Farron (a real, in-set FIN card) is exercised here.
import { describe, expect, it } from 'vitest';
import { serahFarron } from '../cards/serah-farron-crystallized-serah/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import {
  recognizeContinuousPTGrantsSubtypeStructural,
  type ContinuousPTGrantsSubtypeRecognizerInput,
} from './continuousPTGrantsSubtype-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): ContinuousPTGrantsSubtypeRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, continuousPTGrants: def.continuousPTGrants };
}

function backFaceStructuralInput(scryfallName: string, def: CardDefinition): ContinuousPTGrantsSubtypeRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const back = def.backFace;
  if (!back) throw new Error(`fixture setup bug: "${def.name}" has no backFace`);
  return { name: back.name, typeLine: card.back.typeLine, oracleText: card.back.oracleText, continuousPTGrants: back.continuousPTGrants };
}

describe('continuousPTGrantsSubtype-structural', () => {
  it('accepts Crystallized Serah ("Legendary creatures you control get +2/+2" — no "Other" prefix)', () => {
    const result = recognizeContinuousPTGrantsSubtypeStructural(backFaceStructuralInput('Serah Farron // Crystallized Serah', serahFarron));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'pump', controller: 'you', target: { types: { has: ['Legendary'] } } });
  });

  // Elvish Archdruid/Thranduil, Sindarin Liege have no real oracle text
  // checked in anywhere (see module doc comment above) — these two direct,
  // manually-constructed inputs (using each card's own real printed text,
  // just not sourced from `data/*/*_scryfall.json`) still verify the
  // regex logic itself against BOTH real English phrasings this recognizer
  // has to combine into one pattern.
  it('accepts a manually-built "Other Elf creatures you control get +1/+1" input (Elvish Archdruid\'s own real text)', () => {
    const result = recognizeContinuousPTGrantsSubtypeStructural({
      name: 'Elvish Archdruid',
      typeLine: 'Creature — Elf Druid',
      oracleText: 'Other Elf creatures you control get +1/+1.\n{T}: Add {G} for each Elf you control.',
      continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: false, subtype: 'Elf' }],
    });
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'pump', controller: 'you', target: { types: { has: ['Elf'] } } });
  });

  it('accepts a manually-built "Other Elves you control get +1/+1" input (Thranduil\'s own real, differently-worded text)', () => {
    const result = recognizeContinuousPTGrantsSubtypeStructural({
      name: 'Thranduil, Sindarin Liege',
      typeLine: 'Legendary Creature — Elf Noble',
      oracleText: 'Other Elves you control get +1/+1.\nWhenever a land you control enters, create a 1/1 green Elf creature token.',
      continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: false, subtype: 'Elf' }],
    });
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'pump', controller: 'you', target: { types: { has: ['Elf'] } } });
  });
});
