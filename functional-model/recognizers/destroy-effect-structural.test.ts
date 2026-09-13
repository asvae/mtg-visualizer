// Verifies Recognizer C (`destroy-effect-structural.ts`) against real FIN
// cards' own already-typed `CardDefinition`s (imported directly, not read
// off a fixture JSON — this recognizer's whole point is reading THIS APP'S
// OWN structure, so its test fixtures are the real `definition.ts` exports),
// paired with real oracle text off `data/fin/fin_scryfall.json` (same real
// source Recognizers A/B's own `recognizers.test.ts` reads from) purely to
// anchor the derived fact's annotation. Kept in its OWN test file rather
// than folded into `recognizers.test.ts` — this recognizer's input shape
// (`StructuralRecognizerInput`, a real `CardDefinition` slice, not just
// `typeLine`/`oracleText`) is genuinely different from Recognizers A/B's,
// so a shared fixture-building helper would blur more than it'd share.
import { describe, expect, it } from 'vitest';
import { battleMenu } from '../cards/battle-menu/definition';
import { deadlyEmbrace } from '../cards/deadly-embrace/definition';
import { dionBahamutsDominant } from '../cards/dion-bahamut-s-dominant-bahamut-warden-of-light/definition';
import { fateOfTheSunCryst } from '../cards/fate-of-the-sun-cryst/definition';
import { lunaticPandora } from '../cards/lunatic-pandora/definition';
import { qutrubForayer } from '../cards/qutrub-forayer/definition';
import { sephirothsIntervention } from '../cards/sephiroth-s-intervention/definition';
import { sidequestHuntTheMark } from '../cards/sidequest-hunt-the-mark-yiazmat-ultimate-mark/definition';
import { summonBahamut } from '../cards/summon-bahamut/definition';
import { summonPrimalOdin } from '../cards/summon-primal-odin/definition';
import { ultimaWeapon } from '../cards/ultima-weapon/definition';
import type { CardDefinition } from '../card';
// `.mjs`, not `.ts` — see `load-fin-cards.mjs`'s own header for why (same
// convention `recognizers.test.ts` already accepts for this same import).
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeDestroyEffectStructural, type StructuralRecognizerInput } from './destroy-effect-structural';

const finCards = loadFinCards();

/** Builds this recognizer's own `StructuralRecognizerInput` for one face:
 * the real printed text off Scryfall (`loadFinCards`, same source Recognizers
 * A/B's own tests use) PLUS the real `effects`/`triggers`/`abilities`
 * straight off the given `CardDefinition` half (the front object itself, or
 * its own `backFace`) — never a hand-typed stand-in for either half. */
function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('Recognizer C — destroy effect, read structurally off Effect[] (not oracle text)', () => {
  it('accepts Summon: Bahamut — chapterI + chapterII both point at the SAME real clause; this recognizer no longer dedups that itself (moved to apply-recognizers.mjs\'s own runner-level pass — see that script\'s own `mergeRecognizedFactsByIdentity`), so both are returned, literally identical', () => {
    const result = recognizeDestroyEffectStructural(structuralInput('Summon: Bahamut', summonBahamut));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    const expectedFact = {
      role: 'source',
      fact: { event: 'destroy', target: { types: { not: ['Land'] } }, targeted: true, value: 1, annotations: [{ target: 'oracle', line: 1, start: 8, end: 50 }] },
      provenance: { origin: 'parser', rule: 'destroy-effect-structural' },
    };
    expect(result.facts[0]).toEqual(expectedFact);
    expect(result.facts[1]).toEqual(expectedFact);
    // Real byproduct check, same discipline Recognizers A/B's own tests use:
    // the claimed span really does read the real destroy clause verbatim.
    const input = structuralInput('Summon: Bahamut', summonBahamut);
    const lines = input.oracleText.split('\n');
    expect(lines[1]!.slice(8, 50)).toBe('Destroy up to one target nonland permanent');
  });

  it('accepts Fate of the Sun-Cryst — plain nonland-permanent destroy, no Saga/modal wrapping', () => {
    const result = recognizeDestroyEffectStructural(structuralInput('Fate of the Sun-Cryst', fateOfTheSunCryst));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'destroy', target: { types: { not: ['Land'] } }, targeted: true, value: 1, annotations: [{ target: 'oracle', line: 1, start: 0, end: 32 }] },
        provenance: { origin: 'parser', rule: 'destroy-effect-structural' },
      },
    ]);
  });

  it('accepts Battle Menu — inside a `modal` mode, with a real minPower threshold ("with power 4 or greater")', () => {
    const result = recognizeDestroyEffectStructural(structuralInput('Battle Menu', battleMenu));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'destroy', target: { types: { has: ['Creature'] }, power: { min: 4 } }, targeted: true, value: 1, annotations: [{ target: 'oracle', line: 3, start: 10, end: 57 }] },
        provenance: { origin: 'parser', rule: 'destroy-effect-structural' },
      },
    ]);
  });

  it('accepts Lunatic Pandora — an activated (`abilities[]`) sacrifice-cost destroy, not a cast/trigger effect', () => {
    const result = recognizeDestroyEffectStructural(structuralInput('Lunatic Pandora', lunaticPandora));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'destroy', target: { types: { not: ['Land'] } }, targeted: true, value: 1 });
  });

  it('accepts Sephiroth\'s Intervention — plain "Destroy target creature." with no threshold/quantifier', () => {
    const result = recognizeDestroyEffectStructural(structuralInput("Sephiroth's Intervention", sephirothsIntervention));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'destroy', target: { types: { has: ['Creature'] } }, targeted: true, value: 1 });
  });

  it('accepts Sidequest: Hunt the Mark — a genuinely MISSING fact today (its real synergy.json has no event:"destroy" at all), optional qty:1 creature destroy inside a named trigger', () => {
    const result = recognizeDestroyEffectStructural(structuralInput('Sidequest: Hunt the Mark // Yiazmat, Ultimate Mark', sidequestHuntTheMark, 'front'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'destroy', target: { types: { has: ['Creature'] } }, targeted: true, value: 1 });
  });

  it('accepts Bahamut, Warden of Light (Dion\'s back face) — unrestricted "Destroy target permanent," no type filter at all (matches real hand-authored data, which omits `target` entirely here)', () => {
    const backDef = dionBahamutsDominant.backFace!;
    const result = recognizeDestroyEffectStructural(structuralInput("Dion, Bahamut's Dominant // Bahamut, Warden of Light", backDef, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toEqual({ event: 'destroy', targeted: true, value: 1, annotations: [{ target: 'oracle', line: 2, start: 18, end: 42 }] });
  });

  it('declines Qutrub Forayer — real oracle text has a trailing qualifier ("that was dealt damage this turn") the structured Effect has no field for at all; matches today\'s existing hand-authored data (no event:"destroy" fact there either)', () => {
    const result = recognizeDestroyEffectStructural(structuralInput('Qutrub Forayer', qutrubForayer));
    expect(result.matched).toBe(false);
  });

  it('declines Deadly Embrace — `owner: "opponents"` has no confirmed destroy-ACT Fact shape in the real pool; matches today\'s existing hand-authored data (no event:"destroy" fact there either)', () => {
    const result = recognizeDestroyEffectStructural(structuralInput('Deadly Embrace', deadlyEmbrace));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('owner-restricted') });
  });

  it('declines Ultima Weapon — same owner-restriction reason, a triggered (not cast) destroy', () => {
    const result = recognizeDestroyEffectStructural(structuralInput('Ultima Weapon', ultimaWeapon));
    expect(result.matched).toBe(false);
  });

  it('declines Summon: Primal Odin\'s chapter I (Gungnir) — same owner-restriction reason, inside a Saga\'s named trigger', () => {
    const result = recognizeDestroyEffectStructural(structuralInput('Summon: Primal Odin', summonPrimalOdin));
    expect(result.matched).toBe(false);
  });

  it('declines a card with no destroy effect at all on this face', () => {
    const result = recognizeDestroyEffectStructural(structuralInput('Ahriman', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no kind:"destroy"') });
  });
});
