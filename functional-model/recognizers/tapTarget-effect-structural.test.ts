// Verifies `tapTarget-effect-structural.ts` against the real matches/
// declines its own module doc comment names.
import { describe, expect, it } from 'vitest';
import { coeurl } from '../cards/coeurl/definition';
import { summonShiva } from '../cards/summon-shiva/definition';
import { crossroadsVillage } from '../cards/crossroads-village/definition';
import { ringOfTheLucii } from '../cards/ring-of-the-lucii/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeTapTargetEffectStructural, type StructuralRecognizerInput } from './tapTarget-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('tapTarget-effect-structural — real "Tap target <type>" template', () => {
  it("accepts Coeurl — no owner, excludeEnchantment:true, matches this card's own pre-existing hand-authored fact byte-for-byte", () => {
    const result = recognizeTapTargetEffectStructural(structuralInput('Coeurl', coeurl));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const annotation = { target: 'oracle' as const, line: 0, start: 13, end: 47 };
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'tap', target: { types: { has: ['Creature'], not: ['Enchantment'] } }, targeted: true, annotations: [annotation] },
        provenance: { origin: 'parser', rule: 'tapTarget-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', types: { has: ['Creature'], not: ['Enchantment'] }, annotations: [annotation] },
        provenance: { origin: 'parser', rule: 'tapTarget-effect-structural' },
      },
    ]);
  });

  it('accepts Summon: Shiva — owner:\'opponents\', "target creature an opponent controls," 2 identical chapter effects', () => {
    const result = recognizeTapTargetEffectStructural(structuralInput('Summon: Shiva', summonShiva));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(4);
    for (const f of result.facts) {
      if (f.role === 'source') expect(f.fact).toMatchObject({ event: 'tap', target: { types: { has: ['Creature'] } } });
      else expect(f.fact).toMatchObject({ to: 'Battlefield', types: { has: ['Creature'] } });
    }
  });

  it('declines Crossroads Village — the real ETB-tapped-self workaround (owner:\'you\'), not a genuine targeted tap; no "tap target land" phrase exists anywhere in its own real text', () => {
    const result = recognizeTapTargetEffectStructural(structuralInput('Crossroads Village', crossroadsVillage));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no confirmed structural->text template') });
  });

  it('declines Ring of the Lucii — validType:\'creature-or-artifact\' has no confirmed template; real text is the broader "target nonland permanent"', () => {
    const result = recognizeTapTargetEffectStructural(structuralInput('Ring of the Lucii', ringOfTheLucii));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no confirmed structural->text template') });
  });

  it('declines a card with no tapTarget effect at all on this face', () => {
    const result = recognizeTapTargetEffectStructural(structuralInput('Ahriman', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'tapTarget'") });
  });
});
