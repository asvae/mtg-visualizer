// Verifies `putCounterProgram-effect-structural.ts` against its one real
// pool occurrence (a `kind:'putCounter'` `EachAction` reached through a
// `SelectUpTo`/`ApplyToBound` program-AST), plus real declines.
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../card';
import { ahriman } from '../cards/ahriman/definition';
import { beatrixLoyalGeneral } from '../cards/beatrix-loyal-general/definition';
import { venatHeartOfHydaelyn } from '../cards/venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal/definition';
import { zackFair } from '../cards/zack-fair/definition';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizePutCounterProgramEffectStructural, type StructuralRecognizerInput } from './putCounterProgram-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const faceData = face === 'front' ? card.front : card.back!;
  return { name: def.name, typeLine: faceData.typeLine, oracleText: faceData.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('putCounterProgram-effect-structural — a bound kind:"putCounter" EachAction reached through a program-AST walk', () => {
  it('accepts Hydaelyn, the Mothercrystal (Venat\'s own back face) — Blessing of Light\'s real "put a +1/+1 counter on another target creature you control"', () => {
    const result = recognizePutCounterProgramEffectStructural(structuralInput('Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal', venatHeartOfHydaelyn.backFace!, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'putCounter',
          counterType: '+1/+1',
          controller: 'you',
          target: { types: { has: ['Creature'] }, excludeSelf: true },
          targeted: true,
          annotations: [{ target: 'oracle', line: 1, start: 61, end: 119 }],
        },
        provenance: { origin: 'parser', rule: 'putCounterProgram-effect-structural' },
      },
      {
        role: 'sink',
        fact: {
          to: 'Battlefield',
          controller: 'you',
          types: { has: ['Creature'] },
          excludeSelf: true,
          annotations: [{ target: 'oracle', line: 1, start: 84, end: 119 }],
        },
        provenance: { origin: 'parser', rule: 'putCounterProgram-effect-structural' },
      },
    ]);
    const input = structuralInput('Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal', venatHeartOfHydaelyn.backFace!, 'back');
    const lines = input.oracleText.split('\n');
    expect(lines[1]!.slice(61, 119)).toBe('put a +1/+1 counter on another target creature you control');
    expect(lines[1]!.slice(84, 119)).toBe('another target creature you control');
  });

  it('accepts Zack Fair — "Put Zack Fair\'s counters on that creature" (a real counter-TRANSFER magnitude, own separate magnitude sink)', () => {
    const result = recognizePutCounterProgramEffectStructural(structuralInput('Zack Fair', zackFair));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'putCounter',
          counterType: '+1/+1',
          controller: 'you',
          target: { types: { has: ['Creature'] } },
          targeted: true,
          annotations: [{ target: 'oracle', line: 1, start: 94, end: 135 }],
        },
        provenance: { origin: 'parser', rule: 'putCounterProgram-effect-structural' },
      },
      {
        role: 'sink',
        fact: { event: 'putCounter', counterType: '+1/+1', target: 'self', annotations: [{ target: 'oracle', line: 1, start: 98, end: 118 }] },
        provenance: { origin: 'parser', rule: 'putCounterProgram-effect-structural' },
      },
    ]);
    const input = structuralInput('Zack Fair', zackFair);
    const lines = input.oracleText.split('\n');
    expect(lines[1]!.slice(94, 135)).toBe("Put Zack Fair's counters on that creature");
    expect(lines[1]!.slice(98, 118)).toBe("Zack Fair's counters");
  });

  it('declines Beatrix, Loyal General (a real kind:"program" card with an equip, not putCounter, EachAction)', () => {
    const result = recognizePutCounterProgramEffectStructural(structuralInput('Beatrix, Loyal General', beatrixLoyalGeneral));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no recognized putCounter EachAction occurrence') });
  });

  it('declines a real card with no program effect at all (Ahriman)', () => {
    const result = recognizePutCounterProgramEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'program'") });
  });

  it('declines Venat\'s own FRONT face (no kind:"program" Effect there at all — its own effects are kind:"drawCard"/kind:"custom")', () => {
    const result = recognizePutCounterProgramEffectStructural(structuralInput('Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal', venatHeartOfHydaelyn));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'program'") });
  });
});
