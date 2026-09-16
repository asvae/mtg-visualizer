// Verifies `entersTriggerTypeFilter-sink-structural.ts` against every real
// FIN card this recognizer's own module doc comment says was checked
// pool-wide.
import { describe, expect, it } from 'vitest';
import { rookTurret } from '../cards/rook-turret/definition';
import { loporritScout } from '../cards/loporrit-scout/definition';
import { woodlandWeavemaster } from '../cards/woodland-weavemaster/definition';
import { golbezCrystalCollector } from '../cards/golbez-crystal-collector/definition';
import { tidusBlitzballStar } from '../cards/tidus-blitzball-star/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeEntersTriggerTypeFilterSinkStructural, type EntersTriggerTypeFilterRecognizerInput } from './entersTriggerTypeFilter-sink-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): EntersTriggerTypeFilterRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, triggers: def.triggers };
}

describe('entersTriggerTypeFilter-sink-structural', () => {
  it('accepts Rook Turret — onArtifactEnters, no "Other", real text uses "another" (excludeSelf NOT set — derived from the trigger name, not the word)', () => {
    const result = recognizeEntersTriggerTypeFilterSinkStructural(structuralInput('Rook Turret', rookTurret));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: {
          event: 'entersBattlefield',
          controller: 'you',
          types: { has: ['Artifact'] },
          annotations: [{ target: 'oracle', line: expect.any(Number), start: expect.any(Number), end: expect.any(Number) }],
        },
        provenance: { origin: 'parser', rule: 'entersTriggerTypeFilter-sink-structural' },
      },
    ]);
  });

  it('accepts Loporrit Scout — onOtherCreatureEnters, real text uses "another" (excludeSelf: true)', () => {
    const result = recognizeEntersTriggerTypeFilterSinkStructural(structuralInput('Loporrit Scout', loporritScout));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'entersBattlefield', controller: 'you', types: { has: ['Creature'] }, excludeSelf: true });
  });

  it('accepts Woodland Weavemaster — onOtherElfEnters, real text uses "another Elf" (excludeSelf: true) — a cross-set reference card with NO real oracle text checked in anywhere under data/*/*_scryfall.json (same bucket Elvish Archdruid/Thranduil are in, per SYNERGY_DESIGN.md), so this uses its own pre-existing hand-authored sourceText verbatim rather than the finCards loader', () => {
    const result = recognizeEntersTriggerTypeFilterSinkStructural({
      name: woodlandWeavemaster.name,
      typeLine: woodlandWeavemaster.typeLine!,
      oracleText: 'Whenever another Elf you control enters, this creature gets +1/+1 until end of turn.',
      triggers: woodlandWeavemaster.triggers,
    });
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'entersBattlefield', controller: 'you', types: { has: ['Elf'] }, excludeSelf: true });
  });

  it('accepts Golbez, Crystal Collector — onArtifactEnters, real text uses "an" (not itself an Artifact, excludeSelf moot either way)', () => {
    const result = recognizeEntersTriggerTypeFilterSinkStructural(structuralInput('Golbez, Crystal Collector', golbezCrystalCollector));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'entersBattlefield', controller: 'you', types: { has: ['Artifact'] } });
  });

  it('accepts Tidus, Blitzball Star — onArtifactEnters, real text uses "an"', () => {
    const result = recognizeEntersTriggerTypeFilterSinkStructural(structuralInput('Tidus, Blitzball Star', tidusBlitzballStar));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'entersBattlefield', controller: 'you', types: { has: ['Artifact'] } });
  });

  it('declines a card with no on(Other)?(Artifact|Creature|Elf)Enters-named trigger at all', () => {
    const result = recognizeEntersTriggerTypeFilterSinkStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '', triggers: [{ name: 'onEnter', effects: [] }] });
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no on(Other)?') });
  });
});
