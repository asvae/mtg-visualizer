// Verifies `exileSelfCost-structural.ts` against its 3 real whole-pool
// matches ("Exile this artifact", a self-exile as part of the activation
// cost), plus a real scope decline.
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../card';
import { ether } from '../cards/ether/definition';
import { elixir } from '../cards/elixir/definition';
import { phoenixDown } from '../cards/phoenix-down/definition';
import { ahriman } from '../cards/ahriman/definition';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeExileSelfCostStructural, type ExileSelfCostRecognizerInput } from './exileSelfCost-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): ExileSelfCostRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, activationCost: def.activationCost, abilities: def.abilities };
}

describe('exileSelfCost-structural — "Exile this <type>" as part of an activation cost', () => {
  it('accepts Ether ("Exile this artifact")', () => {
    const result = recognizeExileSelfCostStructural(structuralInput('Ether', ether));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'exile', subject: 'self', target: 'self', annotations: [{ target: 'oracle', line: 0, start: 5, end: 24 }] },
        provenance: { origin: 'parser', rule: 'exileSelfCost-structural' },
      },
    ]);
  });

  it('accepts Elixir ("Exile this artifact") — no pre-existing fact at all, a real gap this recognizer closes', () => {
    const result = recognizeExileSelfCostStructural(structuralInput('Elixir', elixir));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'exile', subject: 'self', target: 'self', annotations: [{ target: 'oracle', line: 1, start: 10, end: 29 }] },
        provenance: { origin: 'parser', rule: 'exileSelfCost-structural' },
      },
    ]);
  });

  it('accepts Phoenix Down ("Exile this artifact")', () => {
    const result = recognizeExileSelfCostStructural(structuralInput('Phoenix Down', phoenixDown));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'exile', subject: 'self', target: 'self', annotations: [{ target: 'oracle', line: 0, start: 13, end: 32 }] },
        provenance: { origin: 'parser', rule: 'exileSelfCost-structural' },
      },
    ]);
  });

  it('declines a real card with no self-exile cost at all (Ahriman)', () => {
    const result = recognizeExileSelfCostStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no activationCost/abilities[].cost matching') });
  });
});
