// Verifies `scryOrSurveilTrigger-structural.ts` against the sole real FIN
// card this recognizer's own module doc comment says was checked pool-wide.
import { describe, expect, it } from 'vitest';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeScryOrSurveilTriggerStructural } from './scryOrSurveilTrigger-structural';
import type { RecognizerInput } from './types';

const finCards = loadFinCards();

function faceOf(cardName: string): RecognizerInput {
  const card = finCards.get(cardName);
  if (!card?.front) throw new Error(`fixture setup bug: "${cardName}" not found`);
  return { name: cardName, typeLine: card.front.typeLine, oracleText: card.front.oracleText };
}

describe('scryOrSurveilTrigger-structural — "Whenever you scry or surveil" precondition', () => {
  it('accepts Matoya, Archon Elder — two sinks, one per word', () => {
    const input = faceOf('Matoya, Archon Elder');
    const result = recognizeScryOrSurveilTriggerStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: { event: 'scry', controller: 'you', annotations: [expect.objectContaining({ target: 'oracle' })] },
        provenance: { origin: 'parser', rule: 'scryOrSurveilTrigger-structural' },
      },
      {
        role: 'sink',
        fact: { event: 'surveil', controller: 'you', annotations: [expect.objectContaining({ target: 'oracle' })] },
        provenance: { origin: 'parser', rule: 'scryOrSurveilTrigger-structural' },
      },
    ]);
    const scryAnn = result.facts[0]!.fact.annotations![0] as { line: number; start: number; end: number };
    const surveilAnn = result.facts[1]!.fact.annotations![0] as { line: number; start: number; end: number };
    expect(input.oracleText.split('\n')[scryAnn.line]!.slice(scryAnn.start, scryAnn.end)).toBe('scry');
    expect(input.oracleText.split('\n')[surveilAnn.line]!.slice(surveilAnn.start, surveilAnn.end)).toBe('surveil');
  });

  it('declines a card with no scry-or-surveil trigger at all', () => {
    const result = recognizeScryOrSurveilTriggerStructural({ name: 'Fake Creature', typeLine: 'Creature — Human', oracleText: 'Vigilance' });
    expect(result.matched).toBe(false);
  });
});
