// Verifies `sacrificeCostNamedType-structural.ts` against both real pool
// matches ("Sacrifice a/an <Type>") plus a self-sacrifice decline and an
// "another <Type>" decline — see that recognizer's own module doc comment
// for the full pool-wide check.
import { describe, expect, it } from 'vitest';
import { sidequestCatchAFish } from '../cards/sidequest-catch-a-fish-cooking-campsite/definition';
import { quinaQuGourmet } from '../cards/quina-qu-gourmet/definition';
import { zackFair } from '../cards/zack-fair/definition';
import { ahriman } from '../cards/ahriman/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeSacrificeCostNamedTypeStructural, type SacrificeCostNamedTypeRecognizerInput } from './sacrificeCostNamedType-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): SacrificeCostNamedTypeRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const half = face === 'back' ? card.back! : card.front;
  const def2 = face === 'back' ? def.backFace! : def;
  return { name: def2.name, typeLine: half.typeLine, oracleText: half.oracleText, activationCost: def2.activationCost };
}

describe('sacrificeCostNamedType-structural', () => {
  it("accepts Sidequest: Catch a Fish // Cooking Campsite's own back face (lowercase card-type word, mapped) — 2026-09-16 SOURCE/SINK split fix: source narrows to \"Sacrifice,\" sink narrows to \"an artifact\"", () => {
    const result = recognizeSacrificeCostNamedTypeStructural(structuralInput('Sidequest: Catch a Fish // Cooking Campsite', sidequestCatchAFish, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 1): "{3}, {T}, Sacrifice an artifact: Put a +1/+1
    // counter on each creature you control. Activate only as a sorcery."
    // — [10,19)="Sacrifice" (source), [20,31)="an artifact" (sink) —
    // verified by direct string-slice.
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'sacrifice', controller: 'you', target: { types: { has: ['Artifact'] } }, annotations: [{ target: 'oracle', line: 1, start: 10, end: 19 }] },
        provenance: { origin: 'parser', rule: 'sacrificeCostNamedType-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', controller: 'you', types: { has: ['Artifact'] }, annotations: [{ target: 'oracle', line: 1, start: 20, end: 31 }] },
        provenance: { origin: 'parser', rule: 'sacrificeCostNamedType-structural' },
      },
    ]);
  });

  it('accepts Quina, Qu Gourmet (already-capitalized creature-type word, used as-is) — 2026-09-16 SOURCE/SINK split fix: source narrows to "Sacrifice," sink narrows to "a Frog"', () => {
    const result = recognizeSacrificeCostNamedTypeStructural(structuralInput('Quina, Qu Gourmet', quinaQuGourmet));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 1): "{2}, Sacrifice a Frog: Put a +1/+1 counter on
    // Quina." — [5,14)="Sacrifice" (source), [15,21)="a Frog" (sink) —
    // verified by direct string-slice.
    expect(result.facts[0]).toMatchObject({
      role: 'source',
      fact: { event: 'sacrifice', target: { types: { has: ['Frog'] } }, annotations: [{ target: 'oracle', line: 1, start: 5, end: 14 }] },
    });
    expect(result.facts[1]).toMatchObject({
      role: 'sink',
      fact: { to: 'Battlefield', types: { has: ['Frog'] }, annotations: [{ target: 'oracle', line: 1, start: 15, end: 21 }] },
    });
  });

  it('declines Zack Fair (self-sacrifice, "Sacrifice Zack Fair" — no "a/an" article)', () => {
    const result = recognizeSacrificeCostNamedTypeStructural(structuralInput('Zack Fair', zackFair));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no "Sacrifice a/an') });
  });

  it('declines Ahriman ("Sacrifice another creature or artifact" — "another" never matches \\b(a|an)\\b)', () => {
    const result = recognizeSacrificeCostNamedTypeStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no "Sacrifice a/an') });
  });
});
