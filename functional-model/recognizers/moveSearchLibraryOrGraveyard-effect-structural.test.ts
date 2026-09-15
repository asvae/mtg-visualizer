// Verifies `moveSearchLibraryOrGraveyard-effect-structural.ts` against
// Delivery Moogle (the one real pool occurrence) and a scope decline.
import { describe, expect, it } from 'vitest';
import { deliveryMoogle } from '../cards/delivery-moogle/definition';
import { ahriman } from '../cards/ahriman/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import {
  recognizeMoveSearchLibraryOrGraveyardEffectStructural,
  type StructuralRecognizerInput,
} from './moveSearchLibraryOrGraveyard-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('moveSearchLibraryOrGraveyard-effect-structural — "search your library and/or graveyard for a[n] <type> card with mana value N or less"', () => {
  it('accepts Delivery Moogle — matches its own pre-existing hand-authored facts byte-for-byte (4 facts: 2 source, 2 sink)', () => {
    const result = recognizeMoveSearchLibraryOrGraveyardEffectStructural(structuralInput('Delivery Moogle', deliveryMoogle));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { from: 'Library', to: 'Hand', controller: 'you', types: { has: ['Artifact'] }, cmc: { max: 2 }, annotations: [{ target: 'oracle', line: 1, start: 34, end: 46 }] },
        provenance: { origin: 'parser', rule: 'moveSearchLibraryOrGraveyard-effect-structural' },
      },
      {
        role: 'source',
        fact: { from: 'Graveyard', to: 'Hand', controller: 'you', types: { has: ['Artifact'] }, cmc: { max: 2 }, annotations: [{ target: 'oracle', line: 1, start: 54, end: 63 }] },
        provenance: { origin: 'parser', rule: 'moveSearchLibraryOrGraveyard-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Library', controller: 'you', types: { has: ['Artifact'] }, cmc: { max: 2 }, annotations: [{ target: 'oracle', line: 1, start: 34, end: 46 }] },
        provenance: { origin: 'parser', rule: 'moveSearchLibraryOrGraveyard-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Graveyard', controller: 'you', types: { has: ['Artifact'] }, cmc: { max: 2 }, annotations: [{ target: 'oracle', line: 1, start: 54, end: 63 }] },
        provenance: { origin: 'parser', rule: 'moveSearchLibraryOrGraveyard-effect-structural' },
      },
    ]);
  });

  it('declines a real card with no Library-and-Graveyard search move effect at all (Ahriman)', () => {
    const result = recognizeMoveSearchLibraryOrGraveyardEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no untargeted, owner:'you', to:'Hand', from:['Library','Graveyard']") });
  });
});
