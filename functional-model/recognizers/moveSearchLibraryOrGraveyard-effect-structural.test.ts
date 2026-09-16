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
  it('accepts Delivery Moogle — 4 facts (2 source, 2 sink); 2026-09-16 SOURCE/SINK split fix: sources keep the WHOLE clause (widened 2026-09-16, see module doc comment), sinks narrow to just the object phrase "an artifact card with mana value 2 or less"', () => {
    const result = recognizeMoveSearchLibraryOrGraveyardEffectStructural(structuralInput('Delivery Moogle', deliveryMoogle));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const annotation = { target: 'oracle', line: 1, start: 27, end: 148 };
    const sinkAnnotation = { target: 'oracle', line: 1, start: 68, end: 110 };
    expect(result.facts).toEqual([
      {
        role: 'source',
        // `triggeredBy: 'onEnter'` (2026-09-16, "widen populate" pass) —
        // Delivery Moogle's own real ETB trigger.
        fact: { from: 'Library', to: 'Hand', controller: 'you', types: { has: ['Artifact'] }, cmc: { max: 2 }, annotations: [annotation], triggeredBy: 'onEnter' },
        provenance: { origin: 'parser', rule: 'moveSearchLibraryOrGraveyard-effect-structural' },
      },
      {
        role: 'source',
        fact: { from: 'Graveyard', to: 'Hand', controller: 'you', types: { has: ['Artifact'] }, cmc: { max: 2 }, annotations: [annotation], triggeredBy: 'onEnter' },
        provenance: { origin: 'parser', rule: 'moveSearchLibraryOrGraveyard-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Library', controller: 'you', types: { has: ['Artifact'] }, cmc: { max: 2 }, annotations: [sinkAnnotation] },
        provenance: { origin: 'parser', rule: 'moveSearchLibraryOrGraveyard-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Graveyard', controller: 'you', types: { has: ['Artifact'] }, cmc: { max: 2 }, annotations: [sinkAnnotation] },
        provenance: { origin: 'parser', rule: 'moveSearchLibraryOrGraveyard-effect-structural' },
      },
    ]);
    // The clause is anchored through "...put it into your hand" — the
    // trailing "If you search your library this way, shuffle." sentence is
    // deliberately NOT part of it (see progress.json's own annotatedNonFactSpans).
    const card = finCards.get('Delivery Moogle')!;
    const line = card.front.oracleText.split('\n')[1]!;
    expect(line.slice(27, 148)).toBe(
      'search your library and/or graveyard for an artifact card with mana value 2 or less, reveal it, and put it into your hand',
    );
    expect(line.slice(68, 110)).toBe('an artifact card with mana value 2 or less');
  });

  it('declines a real card with no Library-and-Graveyard search move effect at all (Ahriman)', () => {
    const result = recognizeMoveSearchLibraryOrGraveyardEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no untargeted, owner:'you', to:'Hand', from:['Library','Graveyard']") });
  });
});
