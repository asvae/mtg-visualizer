// Verifies `attacks-trigger-structural.ts` against the real pool-wide check
// its own module doc comment describes: accepts the plain self-attack
// shape, declines every genuinely different real shape found in the pool.
import { describe, expect, it } from 'vitest';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeAttacksTriggerStructural } from './attacks-trigger-structural';
import type { RecognizerInput } from './types';

const finCards = loadFinCards();

function faceOf(cardName: string): RecognizerInput {
  const card = finCards.get(cardName);
  if (!card?.front) throw new Error(`fixture setup bug: "${cardName}" not found`);
  return { name: cardName, typeLine: card.front.typeLine, oracleText: card.front.oracleText };
}

describe('attacks-trigger-structural — "When/Whenever <self> attacks" precondition', () => {
  const accept = ['Ashe, Princess of Dalmasca', 'Il Mheg Pixie', 'Barret Wallace', 'Tidus, Blitzball Star'];

  it.each(accept)('accepts real card: %s', (name) => {
    const input = faceOf(name);
    const result = recognizeAttacksTriggerStructural(input);
    expect(result.matched, `expected a match for "${name}", got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: { event: 'attacks', target: 'self', value: 1, annotations: [expect.objectContaining({ target: 'oracle' })] },
        provenance: { origin: 'parser', rule: 'attacks-trigger-structural' },
      },
    ]);
  });

  it('accepts the "short comma name" form, same convention dies-trigger-structural already established (Cecil, Redeemed Paladin refers to itself as "Cecil")', () => {
    const card = finCards.get('Cecil, Dark Knight // Cecil, Redeemed Paladin');
    if (!card?.back) throw new Error('fixture setup bug: Cecil back face not found');
    const input: RecognizerInput = { name: 'Cecil, Redeemed Paladin', typeLine: card.back.typeLine, oracleText: card.back.oracleText, isBackFace: true };
    const result = recognizeAttacksTriggerStructural(input);
    expect(result.matched, `expected a match, got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('declines a compound "enters or attacks" clause (a genuinely broader precondition, not a plain self-attack)', () => {
    const result = recognizeAttacksTriggerStructural(faceOf('Gilgamesh, Master-at-Arms'));
    expect(result.matched).toBe(false);
  });

  it('declines "Whenever equipped creature attacks" (subject is the equipped creature, not self)', () => {
    const result = recognizeAttacksTriggerStructural(faceOf('Genji Glove'));
    expect(result.matched).toBe(false);
  });

  it('declines "Whenever a creature you control attacks alone" (subject is not self, and the real precondition is broader)', () => {
    const result = recognizeAttacksTriggerStructural(faceOf('Seifer Almasy'));
    expect(result.matched).toBe(false);
  });

  it('declines "Whenever a Vehicle crewed by ... attacks" (a differently-scoped subject, not self)', () => {
    const result = recognizeAttacksTriggerStructural(faceOf('Balthier and Fran'));
    expect(result.matched).toBe(false);
  });

  it('declines "Whenever this Vehicle attacks" (Vehicle is deliberately not in the self-subject alternation — see this file\'s own module doc comment)', () => {
    const result = recognizeAttacksTriggerStructural(faceOf("Adventurer's Airship"));
    expect(result.matched).toBe(false);
  });

  it('declines a non-Creature typeLine outright, even with matching text', () => {
    const result = recognizeAttacksTriggerStructural({ name: 'Fake Card', typeLine: 'Artifact', oracleText: 'Whenever Fake Card attacks, draw a card.' });
    expect(result.matched).toBe(false);
  });

  it('declines a card with no attack trigger at all', () => {
    const result = recognizeAttacksTriggerStructural({ name: 'Fake Creature', typeLine: 'Creature — Human', oracleText: 'Vigilance' });
    expect(result.matched).toBe(false);
  });
});
