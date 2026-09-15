// Verifies `tapSelfCost-structural.ts` against Coeurl's own real,
// motivating case, plus a scope decline.
import { describe, expect, it } from 'vitest';
import { coeurl } from '../cards/coeurl/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeTapSelfCostStructural, type TapSelfCostRecognizerInput } from './tapSelfCost-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): TapSelfCostRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, activationCost: def.activationCost, abilities: def.abilities };
}

describe('tapSelfCost-structural — a {T} in activationCost/abilities[].cost always taps the source permanent (602.1)', () => {
  it("accepts Coeurl — matches this card's own pre-existing hand-authored fact byte-for-byte", () => {
    const result = recognizeTapSelfCostStructural(structuralInput('Coeurl', coeurl));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'tap', subject: 'self', target: 'self', annotations: [{ target: 'oracle', line: 0, start: 8, end: 11 }] },
        provenance: { origin: 'parser', rule: 'tapSelfCost-structural' },
      },
    ]);
  });

  it('declines a card with no {T}-bearing activationCost/abilities[].cost at all', () => {
    const result = recognizeTapSelfCostStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '' });
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no activationCost/abilities[].cost') });
  });
});
