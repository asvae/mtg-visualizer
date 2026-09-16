// Verifies `pumpProgram-effect-structural.ts` against its one real pool
// occurrence (a `kind:'pump'` `EachAction` reached through a `Branch`-
// guarded program-AST), plus real declines.
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../card';
import { ahriman } from '../cards/ahriman/definition';
import { beatrixLoyalGeneral } from '../cards/beatrix-loyal-general/definition';
import { slashOfLight } from '../cards/slash-of-light/definition';
import { youreNotAlone } from '../cards/you-re-not-alone/definition';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizePumpProgramEffectStructural, type StructuralRecognizerInput } from './pumpProgram-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const faceData = face === 'front' ? card.front : card.back!;
  return { name: def.name, typeLine: faceData.typeLine, oracleText: faceData.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('pumpProgram-effect-structural — a Branch-guarded kind:"pump" EachAction pair reached through a program-AST walk', () => {
  it('accepts You\'re Not Alone\'s own real base+conditional-bonus pump', () => {
    const result = recognizePumpProgramEffectStructural(structuralInput("You're Not Alone", youreNotAlone));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(4);
    // Real oracle text (line 0): "Target creature gets +2/+2 until end of
    // turn. If you control three or more creatures, it gets +4/+4 until
    // end of turn instead." — 2026-09-16 SOURCE/SINK split fix: each
    // SOURCE narrows to just "gets ±P/±T" ([16,26)/[89,99)), each SINK
    // keeps its own WHOLE clause ([0,44)/[46,125)) — verified by direct
    // string-slice.
    expect(result.facts[0]).toMatchObject({
      role: 'source',
      fact: { event: 'pump', target: { types: { has: ['Creature'] } }, targeted: true, untilEndOfTurn: true, annotations: [{ target: 'oracle', line: 0, start: 16, end: 26 }] },
      provenance: { origin: 'parser', rule: 'pumpProgram-effect-structural' },
    });
    expect(result.facts[1]).toMatchObject({
      role: 'source',
      fact: { event: 'pump', target: { types: { has: ['Creature'] } }, targeted: true, untilEndOfTurn: true, annotations: [{ target: 'oracle', line: 0, start: 89, end: 99 }] },
    });
    expect(result.facts[2]).toMatchObject({ role: 'sink', fact: { to: 'Battlefield', types: { has: ['Creature'] }, annotations: [{ target: 'oracle', line: 0, start: 0, end: 44 }] } });
    expect(result.facts[2]!.fact).not.toHaveProperty('controller');
    expect(result.facts[2]!.fact).not.toHaveProperty('amount');
    expect(result.facts[3]).toMatchObject({
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, amount: { min: 3 }, annotations: [{ target: 'oracle', line: 0, start: 46, end: 125 }] },
    });
    const input = structuralInput("You're Not Alone", youreNotAlone);
    expect(input.oracleText.slice(16, 26)).toBe('gets +2/+2');
    expect(input.oracleText.slice(89, 99)).toBe('gets +4/+4');
    expect(input.oracleText.slice(0, 44)).toBe('Target creature gets +2/+2 until end of turn');
    expect(input.oracleText.slice(46, 125)).toBe('If you control three or more creatures, it gets +4/+4 until end of turn instead');
  });

  it('declines Slash of Light (a real kind:"program" card with a dealDamage, not pump, EachAction)', () => {
    const result = recognizePumpProgramEffectStructural(structuralInput('Slash of Light', slashOfLight));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no recognized pump EachAction occurrence') });
  });

  it('declines Beatrix, Loyal General (a real kind:"program" card with an equip, not pump, EachAction)', () => {
    const result = recognizePumpProgramEffectStructural(structuralInput('Beatrix, Loyal General', beatrixLoyalGeneral));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no recognized pump EachAction occurrence') });
  });

  it('declines a real card with no program effect at all (Ahriman)', () => {
    const result = recognizePumpProgramEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'program'") });
  });
});
