// Verifies `sacrificeSelfCost-structural.ts` against its 6 real whole-pool
// matches ("Sacrifice <own name>"/"Sacrifice this <type>", a self-sacrifice
// as part of the activation cost), plus a real scope decline (the disjoint
// "Sacrifice a/an <Type>" shape `sacrificeCostNamedType-structural.ts`
// already covers).
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../card';
import { blazingBomb } from '../cards/blazing-bomb/definition';
import { instantRamen } from '../cards/instant-ramen/definition';
import { zackFair } from '../cards/zack-fair/definition';
import { lunaticPandora } from '../cards/lunatic-pandora/definition';
import { qiqirnMerchant } from '../cards/qiqirn-merchant/definition';
import { worldMap } from '../cards/world-map/definition';
import { quinaQuGourmet } from '../cards/quina-qu-gourmet/definition';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeSacrificeSelfCostStructural, type SacrificeSelfCostRecognizerInput } from './sacrificeSelfCost-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): SacrificeSelfCostRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, activationCost: def.activationCost, abilities: def.abilities };
}

describe('sacrificeSelfCost-structural — "Sacrifice <own name>"/"Sacrifice this <type>" as part of an activation cost', () => {
  it('accepts Blazing Bomb (activationCost uses the own printed name, real oracle text uses "this creature" — both forms real, independently anchored)', () => {
    const result = recognizeSacrificeSelfCostStructural(structuralInput('Blazing Bomb', blazingBomb));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'sacrifice', subject: 'self', target: 'self', annotations: [{ target: 'oracle', line: 1, start: 15, end: 38 }] },
        provenance: { origin: 'parser', rule: 'sacrificeSelfCost-structural' },
      },
    ]);
  });

  it('accepts Instant Ramen ("Sacrifice this artifact", cost text matches oracle text verbatim)', () => {
    const result = recognizeSacrificeSelfCostStructural(structuralInput('Instant Ramen', instantRamen));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'sacrifice', subject: 'self', target: 'self', annotations: [{ target: 'oracle', line: 2, start: 10, end: 33 }] },
        provenance: { origin: 'parser', rule: 'sacrificeSelfCost-structural' },
      },
    ]);
  });

  it('accepts Zack Fair ("Sacrifice Zack Fair", own name)', () => {
    const result = recognizeSacrificeSelfCostStructural(structuralInput('Zack Fair', zackFair));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'sacrifice', subject: 'self', target: 'self', annotations: [{ target: 'oracle', line: 1, start: 5, end: 24 }] },
        provenance: { origin: 'parser', rule: 'sacrificeSelfCost-structural' },
      },
    ]);
  });

  it('accepts Lunatic Pandora ("Sacrifice Lunatic Pandora", own name, abilities[].cost)', () => {
    const result = recognizeSacrificeSelfCostStructural(structuralInput('Lunatic Pandora', lunaticPandora));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'sacrifice', subject: 'self', target: 'self', annotations: [{ target: 'oracle', line: 1, start: 10, end: 35 }] },
        provenance: { origin: 'parser', rule: 'sacrificeSelfCost-structural' },
      },
    ]);
  });

  it('accepts Qiqirn Merchant (abilities[].cost uses the own printed name, real oracle text uses "this creature")', () => {
    const result = recognizeSacrificeSelfCostStructural(structuralInput('Qiqirn Merchant', qiqirnMerchant));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'sacrifice', subject: 'self', target: 'self', annotations: [{ target: 'oracle', line: 1, start: 10, end: 33 }] },
        provenance: { origin: 'parser', rule: 'sacrificeSelfCost-structural' },
      },
    ]);
  });

  it('accepts World Map — 2 real abilities sharing the identical "Sacrifice this artifact" clause, each claims its own unclaimed occurrence', () => {
    const result = recognizeSacrificeSelfCostStructural(structuralInput('World Map', worldMap));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'sacrifice', subject: 'self', target: 'self', annotations: [{ target: 'oracle', line: 0, start: 10, end: 33 }] },
        provenance: { origin: 'parser', rule: 'sacrificeSelfCost-structural' },
      },
      {
        role: 'source',
        fact: { event: 'sacrifice', subject: 'self', target: 'self', annotations: [{ target: 'oracle', line: 1, start: 10, end: 33 }] },
        provenance: { origin: 'parser', rule: 'sacrificeSelfCost-structural' },
      },
    ]);
  });

  it('declines Quina, Qu Gourmet (the disjoint "Sacrifice a Frog" shape — sacrificeCostNamedType-structural.ts\'s own scope, not this one)', () => {
    const result = recognizeSacrificeSelfCostStructural(structuralInput('Quina, Qu Gourmet', quinaQuGourmet));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no activationCost/abilities[].cost matching') });
  });
});
