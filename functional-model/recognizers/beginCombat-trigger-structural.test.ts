// Verifies `beginCombat-trigger-structural.ts` against the real pool-wide
// check its own module doc comment describes: accepts every real "At the
// beginning of combat on your turn," occurrence (front faces, a back face,
// and two cases preceded by the card's own ability word), declines a real
// card with no such clause at all.
import { describe, expect, it } from 'vitest';
import { recognizeBeginCombatTriggerStructural } from './beginCombat-trigger-structural';
import { loadFinCards } from './load-fin-cards.mjs';
import type { RecognizerInput } from './types';

const finCards = loadFinCards();

function faceOf(cardName: string): RecognizerInput {
  const card = finCards.get(cardName);
  if (!card?.front) throw new Error(`fixture setup bug: "${cardName}" not found`);
  return { name: cardName, typeLine: card.front.typeLine, oracleText: card.front.oracleText };
}

describe('beginCombat-trigger-structural — "At the beginning of combat on your turn," precondition', () => {
  const accept = ['Weapons Vendor', 'Jenova, Ancient Calamity', 'Beatrix, Loyal General', 'Rosa, Resolute White Mage'];

  it.each(accept)('accepts real card: %s', (name) => {
    const input = faceOf(name);
    const result = recognizeBeginCombatTriggerStructural(input);
    expect(result.matched, `expected a match for "${name}", got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: { event: 'beginCombat', controller: 'you', annotations: [expect.objectContaining({ target: 'oracle' })] },
        provenance: { origin: 'parser', rule: 'beginCombat-trigger-structural' },
      },
    ]);
  });

  it('accepts a clause preceded by the card\'s own ability word ("Starscourge — At the beginning of combat...")', () => {
    const result = recognizeBeginCombatTriggerStructural(faceOf('Ardyn, the Usurper'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts a clause preceded by a named Saga-style ability word ("The Minstrel\'s Ballad — At the beginning of combat...")', () => {
    const result = recognizeBeginCombatTriggerStructural(faceOf('The Wandering Minstrel'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts the BACK face only (Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal — the clause is on the transformed back face)', () => {
    const card = finCards.get('Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal');
    if (!card?.back) throw new Error('fixture setup bug: Venat back face not found');
    const backInput: RecognizerInput = { name: 'Hydaelyn, the Mothercrystal', typeLine: card.back.typeLine, oracleText: card.back.oracleText, isBackFace: true };
    const result = recognizeBeginCombatTriggerStructural(backInput);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);

    const frontInput = faceOf('Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal');
    const frontResult = recognizeBeginCombatTriggerStructural(frontInput);
    expect(frontResult.matched).toBe(false);
  });

  it('declines a real card with no "beginning of combat" clause at all', () => {
    const result = recognizeBeginCombatTriggerStructural(faceOf('Ashe, Princess of Dalmasca'));
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.reason).toContain('no "At the beginning of combat on your turn," clause found');
  });
});
