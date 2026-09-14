// Verifies `lifegain-trigger-structural.ts` against all 3 real FIN cards
// this recognizer's own module doc comment says were checked pool-wide.
import { describe, expect, it } from 'vitest';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeLifegainTriggerStructural } from './lifegain-trigger-structural';
import type { RecognizerInput } from './types';

const finCards = loadFinCards();

function faceOf(cardName: string): RecognizerInput {
  const card = finCards.get(cardName);
  if (!card?.front) throw new Error(`fixture setup bug: "${cardName}" not found`);
  return { name: cardName, typeLine: card.front.typeLine, oracleText: card.front.oracleText };
}

describe('lifegain-trigger-structural — "Whenever you gain life" precondition', () => {
  const accept = ['Excalibur II', 'Minwu, White Mage', 'Aerith Gainsborough'];

  it.each(accept)('accepts real card: %s', (name) => {
    const input = faceOf(name);
    const result = recognizeLifegainTriggerStructural(input);
    expect(result.matched, `expected a match for "${name}", got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: { event: 'lifegain', controller: 'you', annotations: [expect.objectContaining({ target: 'oracle' })] },
        provenance: { origin: 'parser', rule: 'lifegain-trigger-structural' },
      },
    ]);
    const { line, start, end } = result.facts[0]!.fact.annotations![0] as { line: number; start: number; end: number };
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe('Whenever you gain life');
  });

  it('declines a card with no lifegain trigger at all', () => {
    const result = recognizeLifegainTriggerStructural({ name: 'Fake Creature', typeLine: 'Creature — Human', oracleText: 'Vigilance' });
    expect(result.matched).toBe(false);
  });
});
