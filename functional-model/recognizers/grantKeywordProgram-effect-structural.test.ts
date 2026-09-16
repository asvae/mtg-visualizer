// Verifies `grantKeywordProgram-effect-structural.ts` against its one real
// pool occurrence (a `kind:'grantKeyword'` `EachAction` reached through a
// `SelectUpTo`/`ApplyToBound` program-AST), plus real declines.
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../card';
import { ahriman } from '../cards/ahriman/definition';
import { beatrixLoyalGeneral } from '../cards/beatrix-loyal-general/definition';
import { venatHeartOfHydaelyn } from '../cards/venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal/definition';
import { zackFair } from '../cards/zack-fair/definition';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeGrantKeywordProgramEffectStructural, type StructuralRecognizerInput } from './grantKeywordProgram-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const faceData = face === 'front' ? card.front : card.back!;
  return { name: def.name, typeLine: faceData.typeLine, oracleText: faceData.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('grantKeywordProgram-effect-structural — a bound kind:"grantKeyword" EachAction reached through a program-AST walk', () => {
  it('accepts Hydaelyn, the Mothercrystal (Venat\'s own back face) — Blessing of Light\'s real "Until your next turn, it gains indestructible" (anaphoric "it", no separate sink)', () => {
    const result = recognizeGrantKeywordProgramEffectStructural(structuralInput('Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal', venatHeartOfHydaelyn.backFace!, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'grantKeyword',
          keyword: 'Indestructible',
          controller: 'you',
          target: { types: { has: ['Creature'] }, excludeSelf: true },
          targeted: true,
          annotations: [{ target: 'oracle', line: 1, start: 121, end: 166 }],
        },
        provenance: { origin: 'parser', rule: 'grantKeywordProgram-effect-structural' },
      },
    ]);
    const input = structuralInput('Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal', venatHeartOfHydaelyn.backFace!, 'back');
    const lines = input.oracleText.split('\n');
    expect(lines[1]!.slice(121, 166)).toBe('Until your next turn, it gains indestructible');
  });

  it('accepts Zack Fair — "Target creature you control gains indestructible until end of turn" (fresh noun phrase, real tracked untilEndOfTurn, own separate sink)', () => {
    const result = recognizeGrantKeywordProgramEffectStructural(structuralInput('Zack Fair', zackFair));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'grantKeyword',
          keyword: 'Indestructible',
          controller: 'you',
          target: { types: { has: ['Creature'] } },
          targeted: true,
          untilEndOfTurn: true,
          annotations: [{ target: 'oracle', line: 1, start: 54, end: 92 }],
        },
        provenance: { origin: 'parser', rule: 'grantKeywordProgram-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, annotations: [{ target: 'oracle', line: 1, start: 26, end: 53 }] },
        provenance: { origin: 'parser', rule: 'grantKeywordProgram-effect-structural' },
      },
    ]);
    const input = structuralInput('Zack Fair', zackFair);
    const lines = input.oracleText.split('\n');
    expect(lines[1]!.slice(26, 53)).toBe('Target creature you control');
    expect(lines[1]!.slice(54, 92)).toBe('gains indestructible until end of turn');
  });

  it('declines Beatrix, Loyal General (a real kind:"program" card with an equip, not grantKeyword, EachAction)', () => {
    const result = recognizeGrantKeywordProgramEffectStructural(structuralInput('Beatrix, Loyal General', beatrixLoyalGeneral));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no recognized grantKeyword EachAction occurrence') });
  });

  it('declines a real card with no program effect at all (Ahriman)', () => {
    const result = recognizeGrantKeywordProgramEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'program'") });
  });
});
