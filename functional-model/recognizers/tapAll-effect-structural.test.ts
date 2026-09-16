// Verifies `tapAll-effect-structural.ts` against the real match/declines
// its own module doc comment names.
import { describe, expect, it } from 'vitest';
import { jillShivasDominant } from '../cards/jill-shiva-s-dominant-shiva-warden-of-ice/definition';
import type { CardDefinition, Effect } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeTapAllEffectStructural, type StructuralRecognizerInput } from './tapAll-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('tapAll-effect-structural', () => {
  it('accepts Jill, Shiva\'s Dominant // Shiva, Warden of Ice (back face) — "Tap all lands your opponents control." — 2026-09-16 SOURCE/SINK split fix: source narrows to "Tap," sink narrows to "all lands your opponents control"', () => {
    const backDef = jillShivasDominant.backFace!;
    const result = recognizeTapAllEffectStructural(structuralInput("Jill, Shiva's Dominant // Shiva, Warden of Ice", backDef, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 2): "III — Cold Snap — Tap all lands your
    // opponents control. Exile Shiva, then return it to the battlefield
    // (front face up)." — [18,21)="Tap" (source), [22,54)="all lands your
    // opponents control" (sink) — verified by direct string-slice.
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'tap', controller: 'opp', target: { types: { has: ['Land'] } }, targeted: false, annotations: [{ target: 'oracle', line: 2, start: 18, end: 21 }], triggeredBy: 'chapterIII' },
        provenance: { origin: 'parser', rule: 'tapAll-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', controller: 'opp', types: { has: ['Land'] }, annotations: [{ target: 'oracle', line: 2, start: 22, end: 54 }] },
        provenance: { origin: 'parser', rule: 'tapAll-effect-structural' },
      },
    ]);
  });

  it("declines owner:'you'/other predicate — no confirmed real English template", () => {
    const def: CardDefinition = { name: 'Test Card', effects: [{ kind: 'tapAll', predicate: 'lands', owner: 'you' } satisfies Effect] };
    const result = recognizeTapAllEffectStructural(structuralInput("Jill, Shiva's Dominant // Shiva, Warden of Ice", def, 'back'));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('confirmed real English template') });
  });

  it('declines a card with no tapAll effect at all on this face', () => {
    const result = recognizeTapAllEffectStructural(structuralInput("Jill, Shiva's Dominant // Shiva, Warden of Ice", { name: 'Ahriman' } as CardDefinition, 'back'));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'tapAll'") });
  });
});
