// Verifies `preventDamageAll-effect-structural.ts` against Summon:
// Alexander's own chapters I/II (the one real pool occurrence, two
// structurally-identical triggers collapsing to one fact) and a scope
// decline.
import { describe, expect, it } from 'vitest';
import { crystalFragmentsSummonAlexander } from '../cards/crystal-fragments-summon-alexander/definition';
import { ahriman } from '../cards/ahriman/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizePreventDamageAllEffectStructural, type StructuralRecognizerInput } from './preventDamageAll-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const faceData = face === 'front' ? card.front : card.back!;
  return { name: def.name, typeLine: faceData.typeLine, oracleText: faceData.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe("preventDamageAll-effect-structural — Summon: Alexander's own chapters I/II shared shield", () => {
  it("accepts Summon: Alexander's own back face (2 identical chapter triggers -> 2 raw facts, same byte-identical annotation)", () => {
    const result = recognizePreventDamageAllEffectStructural(structuralInput('Crystal Fragments // Summon: Alexander', crystalFragmentsSummonAlexander.backFace!, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    // `Fact.triggeredBy` (2026-09-16, "widen populate" pass) — a real
    // multi-trigger-same-line case (same "repeats, not a typo" pattern as
    // `dealDamage-effect-structural.test.ts`'s own Phoenix, Warden of Fire
    // case): chapterI and chapterII are two separate real triggers sharing
    // byte-identical printed text, so the two facts now genuinely diverge
    // only in `triggeredBy`.
    for (const f of result.facts) {
      expect(f).toMatchObject({
        role: 'source',
        fact: {
          event: 'preventDamage',
          controller: 'you',
          target: { types: { has: ['Creature'] } },
          untilEndOfTurn: true,
          annotations: [{ target: 'oracle', line: 1, start: 8, end: 81 }],
        },
        provenance: { origin: 'parser', rule: 'preventDamageAll-effect-structural' },
      });
    }
    expect(result.facts.map((f) => f.fact.triggeredBy).sort()).toEqual(['chapterI', 'chapterII']);
  });

  it('declines a real card with no grantKeywordAll DamagePrevention effect at all (Ahriman)', () => {
    const result = recognizePreventDamageAllEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'grantKeywordAll'") });
  });
});
