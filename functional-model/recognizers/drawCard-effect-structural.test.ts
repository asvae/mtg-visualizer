// Verifies Recognizer D (`drawCard-effect-structural.ts`) against real FIN
// cards' own already-typed `CardDefinition`s (imported directly, not read
// off a fixture JSON — this recognizer's whole point is reading THIS APP'S
// OWN structure, so its test fixtures are the real `definition.ts` exports),
// paired with real oracle text off `data/fin/fin_scryfall.json` (same real
// source Recognizers A/B/C's own test files read from) purely to anchor the
// derived fact's annotation. Kept in its OWN test file rather than folded
// into `recognizers.test.ts`/`destroy-effect-structural.test.ts` — same
// reasoning `destroy-effect-structural.test.ts`'s own header gives: a
// distinct `StructuralRecognizerInput` fixture-building helper per
// recognizer file, not shared, keeps each recognizer's own real-card
// evidence legible on its own.
import { describe, expect, it } from 'vitest';
import { adventurersAirship } from '../cards/adventurer-s-airship/definition';
import { ahriman } from '../cards/ahriman/definition';
import { circleOfPower } from '../cards/circle-of-power/definition';
import { coliseumBehemoth } from '../cards/coliseum-behemoth/definition';
import { combatTutorial } from '../cards/combat-tutorial/definition';
import { deadlyEmbrace } from '../cards/deadly-embrace/definition';
import { dreamsOfLaguna } from '../cards/dreams-of-laguna/definition';
import { emetSelchUnsundered } from '../cards/emet-selch-unsundered-hades-sorcerer-of-eld/definition';
import { jechtReluctantGuardian } from '../cards/jecht-reluctant-guardian-braska-s-final-aeon/definition';
import { joshuaPhoenixsDominant } from '../cards/joshua-phoenix-s-dominant-phoenix-warden-of-fire/definition';
import { kefkaCourtMage } from '../cards/kefka-court-mage-kefka-ruler-of-ruin/definition';
import { matoyaArchonElder } from '../cards/matoya-archon-elder/definition';
import { qiqirnMerchant } from '../cards/qiqirn-merchant/definition';
import { rookTurret } from '../cards/rook-turret/definition';
import { sephirothFabledSoldier } from '../cards/sephiroth-fabled-soldier-sephiroth-one-winged-angel/definition';
import { stiltzkinMoogleMerchant } from '../cards/stiltzkin-moogle-merchant/definition';
import { summonBahamut } from '../cards/summon-bahamut/definition';
import { thiefsKnife } from '../cards/thief-s-knife/definition';
import { travelTheOverworld } from '../cards/travel-the-overworld/definition';
import { venatHeartOfHydaelyn } from '../cards/venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal/definition';
import type { CardDefinition } from '../card';
// `.mjs`, not `.ts` — see `load-fin-cards.mjs`'s own header for why (same
// convention `recognizers.test.ts`/`destroy-effect-structural.test.ts`
// already accept for this same import).
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeDrawCardEffectStructural, type StructuralRecognizerInput } from './drawCard-effect-structural';

const finCards = loadFinCards();

/** Builds this recognizer's own `StructuralRecognizerInput` for one face:
 * the real printed text off Scryfall (`loadFinCards`, same source Recognizers
 * A/B/C's own tests use) PLUS the real `effects`/`triggers`/`abilities`
 * straight off the given `CardDefinition` half (the front object itself, or
 * its own `backFace`) — never a hand-typed stand-in for either half. */
function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('Recognizer D — drawCard effect, read structurally off Effect[] (not oracle text)', () => {
  it('accepts Summon: Bahamut — chapter III, a literal amount:2, exact annotation verified', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Summon: Bahamut', summonBahamut));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'drawCard', controller: 'you', value: 1, annotations: [{ target: 'oracle', line: 2, start: 6, end: 20 }] },
        provenance: { origin: 'parser', rule: 'drawCard-effect-structural' },
      },
    ]);
    // Real byproduct check, same discipline the other structural recognizer's
    // own tests use: the claimed span really does read the real clause
    // verbatim.
    const input = structuralInput('Summon: Bahamut', summonBahamut);
    const lines = input.oracleText.split('\n');
    expect(lines[2]!.slice(6, 20)).toBe('Draw two cards');
  });

  it('accepts Dreams of Laguna — a literal amount:1 (implicit singular "a card", not "one card")', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Dreams of Laguna', dreamsOfLaguna));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'drawCard', controller: 'you', value: 1 });
  });

  it('accepts Ahriman — an omitted `amount` field entirely (resolves to 1 at resolution, same as a literal amount:1)', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'drawCard', controller: 'you', value: 1 });
  });

  it('accepts Adventurer\'s Airship — a comma clause boundary ("draw a card, then discard a card")', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput("Adventurer's Airship", adventurersAirship));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Circle of Power — an " and " clause boundary ("You draw two cards and you lose 2 life"), a real second effect on the same card, not an uncaptured qualifier', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Circle of Power', circleOfPower));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'drawCard', controller: 'you', value: 1 });
  });

  it('accepts Travel the Overworld — a literal amount:4 ("Draw four cards.")', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Travel the Overworld', travelTheOverworld));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Coliseum Behemoth — inside a `modal` mode ("• Draw a card." at end of string)', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Coliseum Behemoth', coliseumBehemoth));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toEqual({ event: 'drawCard', controller: 'you', value: 1, annotations: [{ target: 'oracle', line: 3, start: 2, end: 13 }] });
  });

  it('accepts Thief\'s Knife — a comma boundary INSIDE a quoted granted-ability string ("...draw a card," and is a Rogue...")', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput("Thief's Knife", thiefsKnife));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Emet-Selch, Unsundered — two triggers (onEnter/onAttacks) sharing ONE real clause; this recognizer no longer dedups that itself (moved to apply-recognizers.mjs\'s own runner-level pass), so both are returned, literally identical', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Emet-Selch, Unsundered // Hades, Sorcerer of Eld', emetSelchUnsundered));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]).toEqual(result.facts[1]);
  });

  it('accepts Matoya, Archon Elder — two triggers (onScry/onSurveil) sharing ONE real clause; this recognizer no longer dedups that itself (moved to apply-recognizers.mjs\'s own runner-level pass), so both are returned, literally identical', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Matoya, Archon Elder', matoyaArchonElder));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]).toEqual(result.facts[1]);
  });

  it('accepts Braska\'s Final Aeon (Jecht\'s back face) — chapterI/chapterII sharing ONE real clause ("Each opponent discards a card and you draw a card"); this recognizer no longer dedups that itself (moved to apply-recognizers.mjs\'s own runner-level pass), so both are returned, literally identical', () => {
    const backDef = jechtReluctantGuardian.backFace!;
    const result = recognizeDrawCardEffectStructural(structuralInput("Jecht, Reluctant Guardian // Braska's Final Aeon", backDef, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]).toEqual(result.facts[1]);
  });

  it('accepts Qiqirn Merchant — TWO genuinely different real draw abilities (cantrip\'s bare draw, bigDraw\'s literal 3) on the SAME face, this recognizer never merges these itself (different annotations) — apply-recognizers.mjs\'s own runner-level pass is what now merges them, not this recognizer', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Qiqirn Merchant', qiqirnMerchant));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'drawCard', controller: 'you', value: 1, annotations: [{ target: 'oracle', line: 0, start: 10, end: 21 }] },
        provenance: { origin: 'parser', rule: 'drawCard-effect-structural' },
      },
      {
        role: 'source',
        fact: { event: 'drawCard', controller: 'you', value: 1, annotations: [{ target: 'oracle', line: 1, start: 35, end: 51 }] },
        provenance: { origin: 'parser', rule: 'drawCard-effect-structural' },
      },
    ]);
  });

  it('accepts Sephiroth, Fabled SOLDIER (front face) — an undefined amount, its OWN back face (One-Winged Angel) independently declines (Computed sacCount)', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Sephiroth, Fabled SOLDIER // Sephiroth, One-Winged Angel', sephirothFabledSoldier));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'drawCard', controller: 'you', value: 1 });
  });

  it('declines Rook Turret — real "you MAY draw a card" (the draw itself is optional; `drawCard` Effect has no `optional` field to represent that, unlike `destroy`)', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Rook Turret', rookTurret));
    expect(result.matched).toBe(false);
  });

  it('declines Joshua, Phoenix\'s Dominant (front face) — a literal amount:2 that\'s an engine-side APPROXIMATION of a real variable draw ("draw THAT MANY cards", not "draw two cards")', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput("Joshua, Phoenix's Dominant // Phoenix, Warden of Fire", joshuaPhoenixsDominant));
    expect(result.matched).toBe(false);
  });

  it('declines Kefka, Court Mage (front face) — same approximation shape, real oracle "you draw a card FOR EACH CARD TYPE among cards discarded this way" (variable, not the literal "two")', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Kefka, Court Mage // Kefka, Ruler of Ruin', kefkaCourtMage));
    expect(result.matched).toBe(false);
  });

  it('declines Kefka, Ruler of Ruin (back face) — a real `Computed<number>` amount (`ctx.triggerInput?.lifeLostAmount`)', () => {
    const backDef = kefkaCourtMage.backFace!;
    const result = recognizeDrawCardEffectStructural(structuralInput('Kefka, Court Mage // Kefka, Ruler of Ruin', backDef, 'back'));
    expect(result.matched).toBe(false);
  });

  it('declines Combat Tutorial — a literal amount:2, but real oracle reads "TARGET PLAYER DRAWS two cards" (third person, never literally "Draw two cards")', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Combat Tutorial', combatTutorial));
    expect(result.matched).toBe(false);
  });

  it('declines Deadly Embrace — a real `Computed<number>` amount (a live graveyard-creature count)', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Deadly Embrace', deadlyEmbrace));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no confirmed structural') });
  });

  it("declines Sephiroth, One-Winged Angel (Sephiroth Fabled SOLDIER's own back face) — real \"sacrifice any number... draw THAT MANY cards\", a Computed sacCount", () => {
    const backDef = sephirothFabledSoldier.backFace!;
    const result = recognizeDrawCardEffectStructural(structuralInput('Sephiroth, Fabled SOLDIER // Sephiroth, One-Winged Angel', backDef, 'back'));
    expect(result.matched).toBe(false);
  });

  it("declines Hydaelyn, the Mothercrystal (Venat's own back face) — its own conditional draw lives INSIDE a `custom` effect's closure, never a separate kind:'drawCard' Effect at all", () => {
    const backDef = venatHeartOfHydaelyn.backFace!;
    const result = recognizeDrawCardEffectStructural(structuralInput('Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal', backDef, 'back'));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no kind:"drawCard"') });
  });

  it('declines Stiltzkin, Moogle Merchant — a real card with a hand-authored event:"drawCard" fact but NO structural kind:"drawCard" Effect at all', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Stiltzkin, Moogle Merchant', stiltzkinMoogleMerchant));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no kind:"drawCard"') });
  });

  it('declines a card with no drawCard effect at all on this face', () => {
    const result = recognizeDrawCardEffectStructural(structuralInput('Ahriman', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no kind:"drawCard"') });
  });
});
