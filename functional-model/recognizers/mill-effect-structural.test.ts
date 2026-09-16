// Verifies `mill-effect-structural.ts` against the real, whole-pool 1-card
// set: The Water Crystal's own "Each opponent mills cards equal to the
// number of cards in your hand."
import { describe, expect, it } from 'vitest';
import { theWaterCrystal } from '../cards/the-water-crystal/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeMillEffectStructural, type StructuralRecognizerInput } from './mill-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('mill-effect-structural', () => {
  it('accepts The Water Crystal — "Each opponent mills cards equal to the number of cards in your hand", source+sink pair', () => {
    const input = structuralInput('The Water Crystal', theWaterCrystal);
    const result = recognizeMillEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    const source = result.facts.find((f) => f.role === 'source')!;
    const sink = result.facts.find((f) => f.role === 'sink')!;
    expect(source.fact).toMatchObject({ event: 'mill', from: 'Library', to: 'Graveyard', controller: 'opp' });
    expect(sink.fact).toMatchObject({ to: 'Hand', controller: 'you' });

    const sourceAnn = source.fact.annotations![0]!;
    const sourceLine = input.oracleText.split('\n')[sourceAnn.line]!;
    expect(sourceLine.slice(sourceAnn.start, sourceAnn.end)).toBe('Each opponent mills cards equal to the number of cards in your hand');

    const sinkAnn = sink.fact.annotations![0]!;
    const sinkLine = input.oracleText.split('\n')[sinkAnn.line]!;
    expect(sinkLine.slice(sinkAnn.start, sinkAnn.end)).toBe('the number of cards in your hand');
  });

  it('declines a card with no mill Effect at all on this face', () => {
    const result = recognizeMillEffectStructural(structuralInput('Ahriman', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'mill'") });
  });
});
