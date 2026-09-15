// Verifies `moveSearchLibrary-effect-structural.ts` against the real 3-card
// family its own module doc comment names — one real match (Cloud, Midgar
// Mercenary), two real, specifically-named declines (Sazh Katzroy, World
// Map) — same fixture convention `destroy-effect-structural.test.ts` already
// established (`loadFinCards` for real oracle text, real `definition.ts`
// exports for the structured half).
import { describe, expect, it } from 'vitest';
import { cloudMidgarMercenary } from '../cards/cloud-midgar-mercenary/definition';
import { sazhKatzroy } from '../cards/sazh-katzroy/definition';
import { worldMap } from '../cards/world-map/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeMoveSearchLibraryEffectStructural, type StructuralRecognizerInput } from './moveSearchLibrary-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('moveSearchLibrary-effect-structural — untargeted "search your library for a[n] <type> card" template', () => {
  it("accepts Cloud, Midgar Mercenary — subtype:'Equipment' builds the precise real word (\"an Equipment card\"), matching this card's own pre-existing hand-authored source+sink fact byte-for-byte", () => {
    const result = recognizeMoveSearchLibraryEffectStructural(structuralInput('Cloud, Midgar Mercenary', cloudMidgarMercenary));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const annotation = { target: 'oracle' as const, line: 0, start: 19, end: 60 };
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { from: 'Library', to: 'Hand', controller: 'you', types: { has: ['Equipment'] }, annotations: [annotation] },
        provenance: { origin: 'parser', rule: 'moveSearchLibrary-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Library', controller: 'you', types: { has: ['Equipment'] }, annotations: [annotation] },
        provenance: { origin: 'parser', rule: 'moveSearchLibrary-effect-structural' },
      },
    ]);
    const input = structuralInput('Cloud, Midgar Mercenary', cloudMidgarMercenary);
    expect(input.oracleText.split('\n')[0]!.slice(19, 60)).toBe('search your library for an Equipment card');
  });

  it('declines Sazh Katzroy — real text is "a Bird or basic land card," a compound OR-restriction this recognizer\'s own single-word template has no confirmed shape for (validType:\'any\', no subtype)', () => {
    const result = recognizeMoveSearchLibraryEffectStructural(structuralInput('Sazh Katzroy', sazhKatzroy));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no confirmed single-word type template') });
  });

  it('declines World Map — both abilities\' real text needs a "basic land" restriction this engine has no supertype concept for at all; the first ability\'s own decline takes the whole face down (same all-or-nothing discipline as move-effect-structural.ts)', () => {
    const result = recognizeMoveSearchLibraryEffectStructural(structuralInput('World Map', worldMap));
    expect(result).toEqual({ matched: false, kind: 'mismatch', reason: expect.stringContaining('not found on any real') });
  });

  it('declines a card with no untargeted search-library move effect at all', () => {
    const result = recognizeMoveSearchLibraryEffectStructural(structuralInput('Ahriman', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no untargeted, owner:'you', from:'Library'-to:'Hand'") });
  });
});
