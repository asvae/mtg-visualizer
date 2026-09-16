// Verifies `flashback-alternateCost-structural.ts` against real cards:
// Auron's Inspiration (the motivating card, straightforward reminder text)
// and Laughing Mad (the one real card whose own printed reminder text
// inserts "and any additional costs" mid-clause — confirms the recognizer's
// own required substring is still found verbatim despite that insertion).
import { describe, expect, it } from 'vitest';
import { auronSInspiration } from '../cards/auron-s-inspiration/definition';
import { laughingMad } from '../cards/laughing-mad/definition';
import { adelbertSteiner } from '../cards/adelbert-steiner/definition';
import { fromFatherToSon } from '../cards/from-father-to-son/definition';
import { memoriesReturning } from '../cards/memories-returning/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeFlashbackAlternateCostStructural, type FlashbackRecognizerInput } from './flashback-alternateCost-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): FlashbackRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, alternateCosts: def.alternateCosts };
}

describe('flashback-alternateCost-structural', () => {
  it("accepts Auron's Inspiration — plain Flashback reminder text", () => {
    const result = recognizeFlashbackAlternateCostStructural(structuralInput("Auron's Inspiration", auronSInspiration));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'cast', from: 'Graveyard', target: 'self', annotations: [{ target: 'oracle', line: 1, start: expect.any(Number), end: expect.any(Number) }] },
        provenance: { origin: 'parser', rule: 'flashback-alternateCost-structural' },
      },
      {
        role: 'source',
        fact: { to: 'Exile', controller: 'you', subject: 'self', annotations: [{ target: 'oracle', line: 1, start: expect.any(Number), end: expect.any(Number) }] },
        provenance: { origin: 'parser', rule: 'flashback-alternateCost-structural' },
      },
    ]);
  });

  it('accepts Laughing Mad — "and any additional costs" insertion does not break the required substring match', () => {
    const result = recognizeFlashbackAlternateCostStructural(structuralInput('Laughing Mad', laughingMad));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('declines Adelbert Steiner — no alternateCosts at all', () => {
    const result = recognizeFlashbackAlternateCostStructural(structuralInput('Adelbert Steiner', adelbertSteiner));
    expect(result.matched).toBe(false);
  });

  it('accepts Memories, Returning — bare "Flashback {7}{U}{U}" heading with NO reminder-text parenthetical at all (2026-09-16 bare-heading fallback), both facts anchored to just the heading span', () => {
    const result = recognizeFlashbackAlternateCostStructural(structuralInput('Memories Returning', memoriesReturning));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'cast', from: 'Graveyard', target: 'self', annotations: [{ target: 'oracle', line: 1, start: 0, end: 19 }] },
        provenance: { origin: 'parser', rule: 'flashback-alternateCost-structural' },
      },
      {
        role: 'source',
        fact: { to: 'Exile', controller: 'you', subject: 'self', annotations: [{ target: 'oracle', line: 1, start: 0, end: 19 }] },
        provenance: { origin: 'parser', rule: 'flashback-alternateCost-structural' },
      },
    ]);
  });

  it("widens From Father to Son's own cast fact to include the printed \"Flashback <cost>\" heading (2026-09-16 fin/20-47 pass — the one real user whose heading is long enough to matter for text-coverage.mjs)", () => {
    const input = structuralInput('From Father to Son', fromFatherToSon);
    const result = recognizeFlashbackAlternateCostStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const castFact = result.facts[0]!;
    expect(castFact.fact).toMatchObject({ event: 'cast', from: 'Graveyard', target: 'self' });
    const ann = (castFact.fact as { annotations: { line: number; start: number; end: number }[] }).annotations[0]!;
    const line1 = input.oracleText.split('\n')[ann.line]!;
    expect(line1.slice(ann.start, ann.end)).toBe('Flashback {4}{W}{W}{W} (You may cast this card from your graveyard for its flashback cost');
  });
});
