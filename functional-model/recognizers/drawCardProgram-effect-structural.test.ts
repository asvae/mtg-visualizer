// Verifies `drawCardProgram-effect-structural.ts` against its one real pool
// occurrence (a bare `DrawCard` `ProgramNode`, Branch-guarded by a
// categorical `HasSubtypeCondition`, reached through a program-AST walk),
// plus real declines.
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../card';
import { ahriman } from '../cards/ahriman/definition';
import { beatrixLoyalGeneral } from '../cards/beatrix-loyal-general/definition';
import { youreNotAlone } from '../cards/you-re-not-alone/definition';
import { venatHeartOfHydaelyn } from '../cards/venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal/definition';
import { edgarKingOfFigaro } from '../cards/edgar-king-of-figaro/definition';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeDrawCardProgramEffectStructural, type StructuralRecognizerInput } from './drawCardProgram-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const faceData = face === 'front' ? card.front : card.back!;
  return { name: def.name, typeLine: faceData.typeLine, oracleText: faceData.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('drawCardProgram-effect-structural — a Branch-guarded bare DrawCard ProgramNode reached through a program-AST walk', () => {
  it('accepts Hydaelyn, the Mothercrystal (Venat\'s own back face) — Blessing of Light\'s real "If that creature is legendary, draw a card"', () => {
    const result = recognizeDrawCardProgramEffectStructural(structuralInput('Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal', venatHeartOfHydaelyn.backFace!, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'drawCard', controller: 'you', annotations: [{ target: 'oracle', line: 1, start: 168, end: 210 }] },
        provenance: { origin: 'parser', rule: 'drawCardProgram-effect-structural' },
      },
    ]);
    const input = structuralInput('Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal', venatHeartOfHydaelyn.backFace!, 'back');
    const lines = input.oracleText.split('\n');
    expect(lines[1]!.slice(168, 210)).toBe('If that creature is legendary, draw a card');
  });

  it('accepts Edgar, King of Figaro — Aggregate-count "draw a card for each artifact you control"', () => {
    const result = recognizeDrawCardProgramEffectStructural(structuralInput('Edgar, King of Figaro', edgarKingOfFigaro));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'drawCard', controller: 'you', annotations: [{ target: 'oracle', line: 0, start: 19, end: 60 }] },
        provenance: { origin: 'parser', rule: 'drawCardProgram-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', controller: 'you', types: { has: ['Artifact'] }, annotations: [{ target: 'oracle', line: 0, start: 40, end: 60 }] },
        provenance: { origin: 'parser', rule: 'drawCardProgram-effect-structural' },
      },
    ]);
  });

  it('declines You\'re Not Alone (a real kind:"program" card with pump/branch, but no DrawCard node at all)', () => {
    const result = recognizeDrawCardProgramEffectStructural(structuralInput("You're Not Alone", youreNotAlone));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no recognized bare DrawCard ProgramNode occurrence') });
  });

  it('declines Beatrix, Loyal General (a real kind:"program" card with an equip, no DrawCard node)', () => {
    const result = recognizeDrawCardProgramEffectStructural(structuralInput('Beatrix, Loyal General', beatrixLoyalGeneral));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no recognized bare DrawCard ProgramNode occurrence') });
  });

  it('declines a real card with no program effect at all (Ahriman)', () => {
    const result = recognizeDrawCardProgramEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'program'") });
  });
});
