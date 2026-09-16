// Verifies `destroyProgram-effect-structural.ts` against both real pool
// occurrences of a `kind:'destroy'` `EachAction` inside a `kind:'program'`
// Effect, plus real declines.
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../card';
import { ahriman } from '../cards/ahriman/definition';
import { beatrixLoyalGeneral } from '../cards/beatrix-loyal-general/definition';
import { coliseumBehemoth } from '../cards/coliseum-behemoth/definition';
import { ultima } from '../cards/ultima/definition';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeDestroyProgramEffectStructural, type StructuralRecognizerInput } from './destroyProgram-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const faceData = face === 'front' ? card.front : card.back!;
  return { name: def.name, typeLine: faceData.typeLine, oracleText: faceData.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('destroyProgram-effect-structural — a kind:"destroy" EachAction reached through a program-AST Query/Filter/Each/SelectUpTo/ApplyToBound walk', () => {
  it('accepts Ultima\'s own board-wide broadcast ("Destroy all artifacts and creatures.") — 2026-09-16 SOURCE/SINK split fix: sink narrows to "all artifacts and creatures," not the whole "Destroy all artifacts and creatures" clause; no companion `dies` fact anymore (removed 2026-09-16, later same day — see module doc comment)', () => {
    const result = recognizeDestroyProgramEffectStructural(structuralInput('Ultima', ultima));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    // Oracle text (line 0): "Destroy all artifacts and creatures. End the
    // turn. (...)" — [0,35)="Destroy all artifacts and creatures" (source),
    // [8,35)="all artifacts and creatures" (sink) — verified by direct
    // string-slice.
    expect(result.facts[0]).toMatchObject({
      role: 'source',
      fact: { event: 'destroy', target: { types: { hasAny: ['Artifact', 'Creature'] } }, targeted: false, annotations: [{ target: 'oracle', line: 0, start: 0, end: 35 }] },
      provenance: { origin: 'parser', rule: 'destroyProgram-effect-structural' },
    });
    expect(result.facts[1]).toMatchObject({ role: 'sink', fact: { to: 'Battlefield', types: { hasAny: ['Artifact', 'Creature'] }, annotations: [{ target: 'oracle', line: 0, start: 8, end: 35 }] } });
  });

  it('accepts Coliseum Behemoth\'s own single-target pick ("Destroy target artifact or enchantment.") — 2026-09-16 SOURCE/SINK split fix: sink narrows to "target artifact or enchantment," not the whole "Destroy target artifact or enchantment" clause', () => {
    const result = recognizeDestroyProgramEffectStructural(structuralInput('Coliseum Behemoth', coliseumBehemoth));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    // Oracle text (line 2): "• Destroy target artifact or enchantment." —
    // [2,40)="Destroy target artifact or enchantment" (source),
    // [10,40)="target artifact or enchantment" (sink) — verified by direct
    // string-slice.
    expect(result.facts[0]).toMatchObject({
      role: 'source',
      fact: { event: 'destroy', target: { types: { hasAny: ['Artifact', 'Enchantment'] } }, targeted: true, annotations: [{ target: 'oracle', line: 2, start: 2, end: 40 }] },
    });
    expect(result.facts[1]).toMatchObject({ role: 'sink', fact: { to: 'Battlefield', types: { hasAny: ['Artifact', 'Enchantment'] }, annotations: [{ target: 'oracle', line: 2, start: 10, end: 40 }] } });
  });

  it('declines Beatrix, Loyal General (a real kind:"program" card with an equip, not destroy, EachAction)', () => {
    const result = recognizeDestroyProgramEffectStructural(structuralInput('Beatrix, Loyal General', beatrixLoyalGeneral));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no recognized destroy EachAction occurrence') });
  });

  it('declines a real card with no program effect at all (Ahriman)', () => {
    const result = recognizeDestroyProgramEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'program'") });
  });
});
