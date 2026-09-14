// Verifies `landfall-trigger-structural.ts` against real cards: the
// confirmed clean-match bucket (byte-identical CR 702.49 ability-word
// preamble) and a real non-match (a card with no Landfall clause at all).
import { describe, expect, it } from 'vitest';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeLandfallTriggerStructural } from './landfall-trigger-structural';
import type { RecognizerInput } from './types';

const finCards = loadFinCards();

function faceInput(scryfallName: string, face: 'front' | 'back' = 'front'): RecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  return { name: card.name, typeLine: f.typeLine, oracleText: f.oracleText };
}

describe('landfall-trigger-structural', () => {
  it('accepts Ambrosia Whiteheart — "Landfall — Whenever a land you control enters, ..."', () => {
    const result = recognizeLandfallTriggerStructural(faceInput('Ambrosia Whiteheart'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: { event: 'landfall', controller: 'you', annotations: [{ target: 'oracle', line: 2, start: 0, end: expect.any(Number) }] },
        provenance: { origin: 'parser', rule: 'landfall-trigger-structural' },
      },
    ]);
  });

  it('accepts Sabotender — same real ability-word preamble, different downstream effect', () => {
    const result = recognizeLandfallTriggerStructural(faceInput('Sabotender'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it("accepts Sazh's Chocobo", () => {
    const result = recognizeLandfallTriggerStructural(faceInput("Sazh's Chocobo"));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('declines Adelbert Steiner — no Landfall clause at all', () => {
    const result = recognizeLandfallTriggerStructural(faceInput('Adelbert Steiner'));
    expect(result.matched).toBe(false);
  });

  it('declines Rinoa Heartilly — real text has no "Landfall" ability word (a different, unrelated attack trigger)', () => {
    const result = recognizeLandfallTriggerStructural(faceInput('Rinoa Heartilly'));
    expect(result.matched).toBe(false);
  });
});
