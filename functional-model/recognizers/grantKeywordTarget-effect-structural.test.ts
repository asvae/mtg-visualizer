// Verifies `grantKeywordTarget-effect-structural.ts` against a spread of
// real pool matches plus 2 real anaphoric declines — see that recognizer's
// own module doc comment for the full pool-wide check.
import { describe, expect, it } from 'vitest';
import { blitzballShot } from '../cards/blitzball-shot/definition';
import { restorationMagic } from '../cards/restoration-magic/definition';
import { summonPrimalGaruda } from '../cards/summon-primal-garuda/definition';
import { magicDamper } from '../cards/magic-damper/definition';
import { seiferAlmasy } from '../cards/seifer-almasy/definition';
import { jillShivasDominant } from '../cards/jill-shiva-s-dominant-shiva-warden-of-ice/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeGrantKeywordTargetEffectStructural, type StructuralRecognizerInput } from './grantKeywordTarget-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('grantKeywordTarget-effect-structural', () => {
  it('accepts Blitzball Shot (no owner, combined pump+keyword sentence)', () => {
    const result = recognizeGrantKeywordTargetEffectStructural(structuralInput('Blitzball Shot', blitzballShot));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]).toMatchObject({ role: 'source', fact: { event: 'grantKeyword', keyword: 'Trample', target: { types: { has: ['Creature'] } }, targeted: true, untilEndOfTurn: true } });
  });

  it('accepts Restoration Magic (validType:any, 2-keyword list, Cure/Cura duplicate-clause tolerance) — matches its own pre-existing hand-authored facts byte-for-byte', () => {
    const result = recognizeGrantKeywordTargetEffectStructural(structuralInput('Restoration Magic', restorationMagic));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const sources = result.facts.filter((f) => f.role === 'source');
    expect(sources).toEqual([
      {
        role: 'source',
        fact: { event: 'grantKeyword', keyword: 'Hexproof', target: {}, targeted: true, untilEndOfTurn: true, annotations: [{ target: 'oracle', line: 1, start: 38, end: 46 }] },
        provenance: { origin: 'parser', rule: 'grantKeywordTarget-effect-structural' },
      },
      {
        role: 'source',
        fact: { event: 'grantKeyword', keyword: 'Indestructible', target: {}, targeted: true, untilEndOfTurn: true, annotations: [{ target: 'oracle', line: 1, start: 51, end: 65 }] },
        provenance: { origin: 'parser', rule: 'grantKeywordTarget-effect-structural' },
      },
    ]);
    // ONE sink per group (2026-09-16, fin/20-47 pass), not one per keyword —
    // annotated with the WHOLE matched clause, once per REAL occurrence
    // (Cure's line AND Cura's own byte-identical duplicate line), closing a
    // real `verify-text-coverage.mjs` gap the bare per-keyword word spans
    // above never covered (the "target permanent gains" prefix, and Cura's
    // entire line, since annotations before this fix only ever pointed at
    // Cure's own occurrence).
    const sinks = result.facts.filter((f) => f.role === 'sink');
    expect(sinks).toEqual([
      {
        role: 'sink',
        fact: {
          to: 'Battlefield',
          annotations: [
            { target: 'oracle', line: 1, start: 15, end: 83 },
            { target: 'oracle', line: 2, start: 15, end: 83 },
          ],
        },
        provenance: { origin: 'parser', rule: 'grantKeywordTarget-effect-structural' },
      },
    ]);
    // Real regression-guard: slice-and-assert the literal widened
    // substrings — Cure's clause and Cura's own byte-identical duplicate.
    const oracle = finCards.get('Restoration Magic')!.front.oracleText;
    const lines = oracle.split('\n');
    expect(lines[1]!.slice(15, 83)).toBe('Target permanent gains hexproof and indestructible until end of turn');
    expect(lines[2]!.slice(15, 83)).toBe('Target permanent gains hexproof and indestructible until end of turn');
  });

  it('accepts Summon: Primal Garuda (owner:you, notSelf — "another target creature you control")', () => {
    const result = recognizeGrantKeywordTargetEffectStructural(structuralInput('Summon: Primal Garuda', summonPrimalGaruda));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]).toMatchObject({
      role: 'source',
      fact: { event: 'grantKeyword', keyword: 'Flying', controller: 'you', target: { types: { has: ['Creature'] }, excludeSelf: true }, targeted: true },
    });
  });

  it('accepts Magic Damper (owner:you, no notSelf)', () => {
    const result = recognizeGrantKeywordTargetEffectStructural(structuralInput('Magic Damper', magicDamper));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]).toMatchObject({ role: 'source', fact: { event: 'grantKeyword', keyword: 'Hexproof', controller: 'you', target: { types: { has: ['Creature'] } } } });
  });

  it('declines Seifer Almasy ("it gains double strike" — anaphoric, not literally "target")', () => {
    const result = recognizeGrantKeywordTargetEffectStructural(structuralInput('Seifer Almasy', seiferAlmasy));
    expect(result).toEqual({ matched: false, kind: 'mismatch', reason: expect.stringContaining('no candidate') });
  });

  it('accepts Jill, Shiva\'s Dominant // Shiva, Warden of Ice (back face) — Unblockable\'s own real "can\'t be blocked this turn" idiom, no untilEndOfTurn required; 2026-09-16 SOURCE/SINK split fix: source narrows to "can\'t be blocked this turn," sink narrows to "Target creature"', () => {
    const backDef = jillShivasDominant.backFace!;
    const result = recognizeGrantKeywordTargetEffectStructural(structuralInput("Jill, Shiva's Dominant // Shiva, Warden of Ice", backDef, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 1): "I, II — Mesmerize — Target creature can't be
    // blocked this turn." — [20,35)="Target creature" (sink), [36,62)=
    // "can't be blocked this turn" (source) — verified by direct
    // string-slice.
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'grantKeyword', keyword: 'Unblockable', target: { types: { has: ['Creature'] } }, targeted: true, annotations: [{ target: 'oracle', line: 1, start: 36, end: 62 }] },
        provenance: { origin: 'parser', rule: 'grantKeywordTarget-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', types: { has: ['Creature'] }, annotations: [{ target: 'oracle', line: 1, start: 20, end: 35 }] },
        provenance: { origin: 'parser', rule: 'grantKeywordTarget-effect-structural' },
      },
    ]);
  });
});
