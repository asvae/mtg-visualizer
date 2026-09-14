// Verifies `dies-trigger-structural.ts` against real FIN cards' own printed
// text (`data/fin/fin_scryfall.json`, same real source `recognizers.test.ts`
// already reads from for Recognizers A/B) — every one of the 8 real
// `name:'onDies'`-shaped triggers this recognizer's own module doc comment
// says were checked, including the one real, deliberate decline
// (`al-bhed-salvagers`).
import { describe, expect, it } from 'vitest';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeDiesTriggerStructural } from './dies-trigger-structural';
import type { RecognizerInput } from './types';

const finCards = loadFinCards();

function faceOf(cardName: string, face: 'front' | 'back' = 'front'): RecognizerInput {
  const card = finCards.get(cardName);
  if (!card) throw new Error(`fixture setup bug: "${cardName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${cardName}" has no ${face} face`);
  const ownName = cardName.includes(' // ') ? cardName.split(' // ')[face === 'back' ? 1 : 0]!.trim() : cardName;
  return { name: ownName, typeLine: f.typeLine, oracleText: f.oracleText, isBackFace: face === 'back' };
}

function expectedFacts(annotations: { target: 'oracle'; line: number; start: number; end: number }[]) {
  return [
    {
      role: 'sink',
      fact: { event: 'dies', target: 'self', value: 1, annotations },
      provenance: { origin: 'parser', rule: 'dies-trigger-structural' },
    },
    {
      role: 'source',
      fact: {
        event: 'dies',
        from: 'Battlefield',
        to: 'Graveyard',
        controller: 'you',
        subject: 'self',
        target: 'self',
        value: 1,
        annotations,
      },
      provenance: { origin: 'parser', rule: 'dies-trigger-structural' },
    },
  ];
}

describe('dies-trigger-structural — "When/Whenever <self> dies" precondition + CR 700.4 consequence pair', () => {
  it('accepts Dwarven Castle Guard — "When this creature dies, ..."', () => {
    const input = faceOf('Dwarven Castle Guard');
    const result = recognizeDiesTriggerStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const { start, end, line } = result.facts[0]!.fact.annotations![0] as { start: number; end: number; line: number };
    expect(result.facts).toEqual(expectedFacts([{ target: 'oracle', line, start, end }]));
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe('When this creature dies');
  });

  it('accepts Undercity Dire Rat — "When this creature dies, ..." (reminder text elsewhere on the same line does not confuse the match)', () => {
    const result = recognizeDiesTriggerStructural(faceOf('Undercity Dire Rat'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Magic Pot — "When this creature dies, ..."', () => {
    const result = recognizeDiesTriggerStructural(faceOf('Magic Pot'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Ancient Adamantoise — "When this creature dies, exile it and create ten tapped Treasure tokens." (the trigger\'s own dying still genuinely goes battlefield->graveyard first, even though the effect then exiles it)', () => {
    const result = recognizeDiesTriggerStructural(faceOf('Ancient Adamantoise'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Aerith Gainsborough — "When Aerith Gainsborough dies, ..." (own printed name as subject, not "this creature")', () => {
    const result = recognizeDiesTriggerStructural(faceOf('Aerith Gainsborough'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Galian Beast (back face of Vincent Valentine // Galian Beast) — "When Galian Beast dies, ..." (own printed FACE name, not the front face\'s "Vincent Valentine")', () => {
    const result = recognizeDiesTriggerStructural(faceOf('Vincent Valentine // Galian Beast', 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('declines Vincent Valentine\'s own FRONT face — its real trigger is "Whenever a creature an opponent controls dies," an unrelated clause, not this permanent\'s own death', () => {
    const result = recognizeDiesTriggerStructural(faceOf('Vincent Valentine // Galian Beast', 'front'));
    expect(result.matched).toBe(false);
  });

  it('accepts Chaos (back face of Garland, Knight of Cornelia // Chaos, the Endless) — "When Chaos dies, ..."', () => {
    const result = recognizeDiesTriggerStructural(faceOf('Garland, Knight of Cornelia // Chaos, the Endless', 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('declines Al Bhed Salvagers — its own real clause is BROADER ("this creature or another creature or artifact you control dies"), "dies" is not immediately adjacent to "this creature"', () => {
    const result = recognizeDiesTriggerStructural(faceOf('Al Bhed Salvagers'));
    expect(result.matched, 'must not overclaim a self-only precondition for a broader real clause').toBe(false);
  });

  it('declines a non-permanent (no recognized permanent type word in typeLine)', () => {
    const result = recognizeDiesTriggerStructural({ name: 'Fake Instant', typeLine: 'Instant', oracleText: 'When this creature dies, draw a card.' });
    expect(result.matched).toBe(false);
  });

  it('declines a permanent with no "dies" clause at all', () => {
    const result = recognizeDiesTriggerStructural({ name: 'Fake Creature', typeLine: 'Creature — Human', oracleText: 'Vigilance' });
    expect(result.matched).toBe(false);
  });
});
