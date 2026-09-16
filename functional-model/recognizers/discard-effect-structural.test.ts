// Verifies `discard-effect-structural.ts` against the real matches/declines
// its own module doc comment names.
import { describe, expect, it } from 'vitest';
import { adventurersAirship } from '../cards/adventurer-s-airship/definition';
import { giottKingOfTheDwarves } from '../cards/giott-king-of-the-dwarves/definition';
import { lockeCole } from '../cards/locke-cole/definition';
import { qiqirnMerchant } from '../cards/qiqirn-merchant/definition';
import { joshuaPhoenixsDominant } from '../cards/joshua-phoenix-s-dominant-phoenix-warden-of-fire/definition';
import { nibelheimAflame } from '../cards/nibelheim-aflame/definition';
import { hecteyes } from '../cards/hecteyes/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeDiscardEffectStructural, type StructuralRecognizerInput } from './discard-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('discard-effect-structural — real "discard(s) a/two card(s)" template', () => {
  it('accepts Adventurer\'s Airship — owner:\'you\', qty:1, "draw a card, then discard a card"', () => {
    const result = recognizeDiscardEffectStructural(structuralInput("Adventurer's Airship", adventurersAirship));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'discard', controller: 'you', annotations: [{ target: 'oracle', line: 1, start: 49, end: 63 }], triggeredBy: 'onAttacks' },
        provenance: { origin: 'parser', rule: 'discard-effect-structural' },
      },
    ]);
  });

  it('accepts Giott, King of the Dwarves — "you may discard a card. If you do, draw a card" (no "may"/"if you do" required)', () => {
    const result = recognizeDiscardEffectStructural(structuralInput('Giott, King of the Dwarves', giottKingOfTheDwarves));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'discard', controller: 'you' });
  });

  it('accepts Locke Cole — "draw a card, then discard a card."', () => {
    const result = recognizeDiscardEffectStructural(structuralInput('Locke Cole', lockeCole));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Qiqirn Merchant — "Draw a card, then discard a card." (cost-adjacent, colon-activated ability)', () => {
    const result = recognizeDiscardEffectStructural(structuralInput('Qiqirn Merchant', qiqirnMerchant));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('declines Joshua, Phoenix\'s Dominant // Phoenix, Warden of Fire — real text is "discard up to two cards," a variable discard fixed-count-approximated as qty:2 (recognizer-exception marker in its own definition.ts)', () => {
    const result = recognizeDiscardEffectStructural(structuralInput("Joshua, Phoenix's Dominant // Phoenix, Warden of Fire", joshuaPhoenixsDominant));
    expect(result).toEqual({ matched: false, kind: 'mismatch', reason: expect.stringContaining('not found') });
  });

  it('declines Nibelheim Aflame — non-literal (Computed<number>) qty', () => {
    const result = recognizeDiscardEffectStructural(structuralInput('Nibelheim Aflame', nibelheimAflame));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no confirmed structural') });
  });

  it("declines Hecteyes — owner:'opponents', no confirmed Fact-shape for a non-'you' owner", () => {
    const result = recognizeDiscardEffectStructural(structuralInput('Hecteyes', hecteyes));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no confirmed structural') });
  });

  it('declines a card with no discard effect at all on this face', () => {
    const result = recognizeDiscardEffectStructural(structuralInput('Ahriman', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'discard'") });
  });
});
