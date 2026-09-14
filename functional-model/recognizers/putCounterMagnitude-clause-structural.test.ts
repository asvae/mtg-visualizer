// Verifies `putCounterMagnitude-clause-structural.ts` against the one real
// FIN card this recognizer's own module doc comment confirms carries this
// exact clause shape (Aerith Gainsborough — checked pool-wide, see that
// comment for the full whole-pool grep of every "where X is the number of
// ..." clause and why none of the other 7 real cards using that broader
// template are even a near-miss for this narrower one).
import { describe, expect, it } from 'vitest';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizePutCounterMagnitudeClauseStructural } from './putCounterMagnitude-clause-structural';
import type { RecognizerInput } from './types';

const finCards = loadFinCards();

function faceOf(cardName: string, face: 'front' | 'back' = 'front'): RecognizerInput {
  const card = finCards.get(cardName);
  const f = face === 'back' ? card?.back : card?.front;
  if (!f) throw new Error(`fixture setup bug: "${cardName}" (${face}) not found`);
  const ownName = cardName.includes(' // ') ? cardName.split(' // ')[face === 'back' ? 1 : 0]!.trim() : cardName;
  return { name: ownName, typeLine: f.typeLine, oracleText: f.oracleText };
}

describe('putCounterMagnitude-clause-structural — "where X is the number of <counterType> counters on <self>"', () => {
  it('accepts Aerith Gainsborough', () => {
    const input = faceOf('Aerith Gainsborough');
    const result = recognizePutCounterMagnitudeClauseStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: { event: 'putCounter', counterType: '+1/+1', target: 'self', annotations: [{ target: 'oracle', line: expect.any(Number), start: expect.any(Number), end: expect.any(Number) }] },
        provenance: { origin: 'parser', rule: 'putCounterMagnitude-clause-structural' },
      },
    ]);
    const { line, start, end } = result.facts[0]!.fact.annotations![0] as { line: number; start: number; end: number };
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe('where X is the number of +1/+1 counters on Aerith Gainsborough');
  });

  it('declines a card with no matching clause at all', () => {
    const result = recognizePutCounterMagnitudeClauseStructural({ name: 'Fake Creature', typeLine: 'Creature — Human', oracleText: 'Vigilance' });
    expect(result.matched).toBe(false);
  });

  it('declines every OTHER real "where X is the number of ..." clause in the pool — none counts "<counterType> counters on <self>"', () => {
    const others: [string, 'front' | 'back'][] = [
      ['The Final Days', 'front'],
      ['Summon: Titan', 'front'],
      ['Cloud of Darkness', 'front'],
      ['The Emperor of Palamecia // The Lord Master of Hell', 'back'],
      ['Omega, Heartless Evolution', 'front'],
      ['The Wandering Minstrel', 'front'],
      ['Judgment Bolt', 'front'],
    ];
    for (const [name, face] of others) {
      const input = faceOf(name, face);
      const result = recognizePutCounterMagnitudeClauseStructural(input);
      expect(result.matched, `expected "${name}" (${face}) to decline, but it matched`).toBe(false);
    }
  });
});
