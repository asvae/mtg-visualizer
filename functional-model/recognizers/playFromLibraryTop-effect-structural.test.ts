// Verifies `playFromLibraryTop-effect-structural.ts` against the real
// match/declines its own module doc comment names.
import { describe, expect, it } from 'vitest';
import { theLunarWhale } from '../cards/the-lunar-whale/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizePlayFromLibraryTopEffectStructural, type StructuralRecognizerInput } from './playFromLibraryTop-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('playFromLibraryTop-effect-structural', () => {
  it('accepts The Lunar Whale — "you may play the top card of your library"', () => {
    const result = recognizePlayFromLibraryTopEffectStructural(structuralInput('The Lunar Whale', theLunarWhale));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'play', from: 'Library', controller: 'you', annotations: [{ target: 'oracle', line: 2, start: 47, end: 88 }] },
        provenance: { origin: 'parser', rule: 'playFromLibraryTop-effect-structural' },
      },
    ]);
  });

  it('declines a card with no playFromLibraryTop effect at all on this face', () => {
    const result = recognizePlayFromLibraryTopEffectStructural(structuralInput('The Lunar Whale', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'playFromLibraryTop'") });
  });
});
