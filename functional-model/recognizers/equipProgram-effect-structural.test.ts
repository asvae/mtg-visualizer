// Verifies `equipProgram-effect-structural.ts` against both real pool
// occurrences of a `kind:'equip'` `EachAction` inside a `kind:'program'`
// Effect, plus real declines.
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../card';
import { ahriman } from '../cards/ahriman/definition';
import { beatrixLoyalGeneral } from '../cards/beatrix-loyal-general/definition';
import { gilgameshMasterAtArms } from '../cards/gilgamesh-master-at-arms/definition';
import { stolenUniform } from '../cards/stolen-uniform/definition';
import { ultima } from '../cards/ultima/definition';
import { weaponsVendor } from '../cards/weapons-vendor/definition';
import { zackFair } from '../cards/zack-fair/definition';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeEquipProgramEffectStructural, type StructuralRecognizerInput } from './equipProgram-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const faceData = face === 'front' ? card.front : card.back!;
  return { name: def.name, typeLine: faceData.typeLine, oracleText: faceData.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('equipProgram-effect-structural — a kind:"equip" EachAction reached through a program-AST Query/Filter/Each/SelectUpTo/ApplyToBound walk', () => {
  it('accepts Beatrix, Loyal General\'s own broadcast shape ("attach any number of Equipment you control to target creature you control") — 2026-09-16 SOURCE/SINK split fix: creature sink narrows to "target creature you control," equipment sink narrows to "any number of Equipment you control"', () => {
    const result = recognizeEquipProgramEffectStructural(structuralInput('Beatrix, Loyal General', beatrixLoyalGeneral));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(3);
    // Oracle text (line 1): "At the beginning of combat on your turn, you
    // may attach any number of Equipment you control to target creature
    // you control." — [41,122)=whole clause (source), [95,122)="target
    // creature you control" (creature sink), [56,91)="any number of
    // Equipment you control" (equipment sink) — verified by direct
    // string-slice.
    expect(result.facts[0]).toMatchObject({
      role: 'source',
      fact: { event: 'equip', controller: 'you', target: { types: { has: ['Creature'] } }, annotations: [{ target: 'oracle', line: 1, start: 41, end: 122 }] },
      provenance: { origin: 'parser', rule: 'equipProgram-effect-structural' },
    });
    expect(result.facts[1]).toMatchObject({ role: 'sink', fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, annotations: [{ target: 'oracle', line: 1, start: 95, end: 122 }] } });
    expect(result.facts[2]).toMatchObject({ role: 'sink', fact: { to: 'Battlefield', controller: 'you', types: { has: ['Equipment'] }, annotations: [{ target: 'oracle', line: 1, start: 56, end: 91 }] } });
  });

  it('accepts Gilgamesh, Master-at-Arms\' own single-to-single shape ("attach one of them to a Samurai you control") — twice (onEnter + onAttack share the identical real clause); 2026-09-16 SOURCE/SINK split fix: creature sink narrows to "a Samurai you control," equipment sink narrows to "one of them"', () => {
    const result = recognizeEquipProgramEffectStructural(structuralInput('Gilgamesh, Master-at-Arms', gilgameshMasterAtArms));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(6);
    // Oracle text (line 0, tail): "...you may attach one of them to a
    // Samurai you control." — [289,340)=whole clause (source), [319,340)=
    // "a Samurai you control" (creature sink), [304,315)="one of them"
    // (equipment sink) — verified by direct string-slice.
    expect(result.facts[0]).toMatchObject({
      role: 'source',
      fact: { event: 'equip', controller: 'you', target: { types: { has: ['Creature', 'Samurai'] } }, annotations: [{ target: 'oracle', line: 0, start: 289, end: 340 }] },
    });
    expect(result.facts[1]).toMatchObject({ role: 'sink', fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature', 'Samurai'] }, annotations: [{ target: 'oracle', line: 0, start: 319, end: 340 }] } });
    expect(result.facts[2]).toMatchObject({ role: 'sink', fact: { to: 'Battlefield', controller: 'you', types: { has: ['Artifact'] }, annotations: [{ target: 'oracle', line: 0, start: 304, end: 315 }] } });
  });

  it('accepts Weapons Vendor\'s own literal, independently-targeted shape ("attach target Equipment you control to target creature you control") — 2026-09-16 SOURCE/SINK split fix: creature sink narrows to "target creature you control," equipment sink narrows to "target Equipment you control"', () => {
    const result = recognizeEquipProgramEffectStructural(structuralInput('Weapons Vendor', weaponsVendor));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(3);
    // Oracle text (line 1): "...When you do, attach target Equipment you
    // control to target creature you control." — [100,166)=whole clause
    // (source), [139,166)="target creature you control" (creature sink),
    // [107,135)="target Equipment you control" (equipment sink) —
    // verified by direct string-slice.
    expect(result.facts[0]).toMatchObject({
      role: 'source',
      fact: { event: 'equip', controller: 'you', target: { types: { has: ['Creature'] } }, annotations: [{ target: 'oracle', line: 1, start: 100, end: 166 }] },
      provenance: { origin: 'parser', rule: 'equipProgram-effect-structural' },
    });
    expect(result.facts[1]).toMatchObject({ role: 'sink', fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, annotations: [{ target: 'oracle', line: 1, start: 139, end: 166 }] } });
    expect(result.facts[2]).toMatchObject({ role: 'sink', fact: { to: 'Battlefield', controller: 'you', types: { has: ['Equipment'] }, annotations: [{ target: 'oracle', line: 1, start: 107, end: 135 }] } });
  });

  it('accepts Zack Fair\'s own real "attached to THIS card" shape ("attach an Equipment that was attached to Zack Fair to that creature") — 2026-09-16 SOURCE/SINK split fix: creature sink narrows to "that creature," equipment sink narrows to "an Equipment that was attached to Zack Fair"', () => {
    const result = recognizeEquipProgramEffectStructural(structuralInput('Zack Fair', zackFair));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(3);
    // Oracle text (line 1): "...Put Zack Fair's counters on that creature
    // and attach an Equipment that was attached to Zack Fair to that
    // creature." — [140,207)=whole clause (source), [194,207)="that
    // creature" (creature sink), [147,190)="an Equipment that was
    // attached to Zack Fair" (equipment sink) — verified by direct
    // string-slice.
    expect(result.facts[0]).toMatchObject({
      role: 'source',
      fact: { event: 'equip', controller: 'you', target: { types: { has: ['Creature'] } }, annotations: [{ target: 'oracle', line: 1, start: 140, end: 207 }] },
      provenance: { origin: 'parser', rule: 'equipProgram-effect-structural' },
    });
    expect(result.facts[1]).toMatchObject({ role: 'sink', fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, annotations: [{ target: 'oracle', line: 1, start: 194, end: 207 }] } });
    expect(result.facts[2]).toMatchObject({ role: 'sink', fact: { to: 'Battlefield', controller: 'you', types: { has: ['Equipment'] }, annotations: [{ target: 'oracle', line: 1, start: 147, end: 190 }] } });
  });

  it('declines Ultima (a real kind:"program" card with a destroy, not equip, EachAction)', () => {
    const result = recognizeEquipProgramEffectStructural(structuralInput('Ultima', ultima));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no recognized equip EachAction occurrence') });
  });

  it('declines Stolen Uniform (a real chained gainControl+equip program — a genuinely different, more complex shape, see module doc comment)', () => {
    const result = recognizeEquipProgramEffectStructural(structuralInput('Stolen Uniform', stolenUniform));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no confirmed structural->text template') });
  });

  it('declines a real card with no program effect at all (Ahriman)', () => {
    const result = recognizeEquipProgramEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'program'") });
  });
});
