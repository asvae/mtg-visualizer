// Verifies `putCounterAll-effect-structural.ts` against all 3 real
// `kind:'putCounterAll'` occurrences in the pool — see that recognizer's
// own module doc comment for the full pool-wide check.
import { describe, expect, it } from 'vitest';
import { minwuWhiteMage } from '../cards/minwu-white-mage/definition';
import { sidequestCatchAFish } from '../cards/sidequest-catch-a-fish-cooking-campsite/definition';
import { summonKnightsOfRound } from '../cards/summon-knights-of-round/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizePutCounterAllEffectStructural, type StructuralRecognizerInput } from './putCounterAll-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const half = face === 'back' ? card.back! : card.front;
  const def2 = face === 'back' ? def.backFace! : def;
  return { name: def2.name, typeLine: half.typeLine, oracleText: half.oracleText, effects: def2.effects, triggers: def2.triggers, abilities: def2.abilities };
}

describe('putCounterAll-effect-structural', () => {
  it('accepts Minwu, White Mage (subtype Cleric) — 2026-09-16 SOURCE/SINK split fix: source narrows to "put a +1/+1 counter on," sink narrows to "each Cleric you control"', () => {
    const result = recognizePutCounterAllEffectStructural(structuralInput('Minwu, White Mage', minwuWhiteMage));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 1): "Whenever you gain life, put a +1/+1 counter
    // on each Cleric you control." — [24,46)="put a +1/+1 counter on"
    // (source), [47,70)="each Cleric you control" (sink) — verified by
    // direct string-slice.
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'putCounter',
          counterType: '+1/+1',
          controller: 'you',
          target: { types: { has: ['Creature', 'Cleric'] } },
          targeted: false,
          annotations: [{ target: 'oracle', line: 1, start: 24, end: 46 }],
          // `Fact.triggeredBy` (2026-09-16, "widen populate" pass) — Minwu's
          // own real "Whenever you gain life..." trigger.
          triggeredBy: 'onLifeGained',
        },
        provenance: { origin: 'parser', rule: 'putCounterAll-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature', 'Cleric'] }, annotations: [{ target: 'oracle', line: 1, start: 47, end: 70 }] },
        provenance: { origin: 'parser', rule: 'putCounterAll-effect-structural' },
      },
    ]);
  });

  it("accepts Sidequest: Catch a Fish // Cooking Campsite's own back face (no subtype/notSelf) — 2026-09-16 SOURCE/SINK split fix: source narrows to \"Put a +1/+1 counter on,\" sink narrows to \"each creature you control\"", () => {
    const result = recognizePutCounterAllEffectStructural(structuralInput('Sidequest: Catch a Fish // Cooking Campsite', sidequestCatchAFish, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 1): "{3}, {T}, Sacrifice an artifact: Put a +1/+1
    // counter on each creature you control. Activate only as a sorcery."
    // — [33,55)="Put a +1/+1 counter on" (source), [56,81)="each creature
    // you control" (sink) — verified by direct string-slice.
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'putCounter',
          counterType: '+1/+1',
          controller: 'you',
          target: { types: { has: ['Creature'] } },
          targeted: false,
          annotations: [{ target: 'oracle', line: 1, start: 33, end: 55 }],
        },
        provenance: { origin: 'parser', rule: 'putCounterAll-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, annotations: [{ target: 'oracle', line: 1, start: 56, end: 81 }] },
        provenance: { origin: 'parser', rule: 'putCounterAll-effect-structural' },
      },
    ]);
  });

  it('accepts Summon: Knights of Round chapter V (notSelf, "each of them" anaphoric subject, Indestructible) — 2026-09-16 SOURCE/SINK split fix: source narrows to "Put an indestructible counter on," sink narrows to "each of them"', () => {
    const result = recognizePutCounterAllEffectStructural(structuralInput('Summon: Knights of Round', summonKnightsOfRound));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 2): "V — Ultimate End — Other creatures you
    // control get +2/+2 until end of turn. Put an indestructible counter
    // on each of them." — [76,108)="Put an indestructible counter on"
    // (source), [109,121)="each of them" (sink) — verified by direct
    // string-slice.
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'putCounter',
          counterType: 'Indestructible',
          controller: 'you',
          target: { types: { has: ['Creature'] }, excludeSelf: true },
          targeted: false,
          annotations: [{ target: 'oracle', line: 2, start: 76, end: 108 }],
          // `Fact.triggeredBy` (2026-09-16, "widen populate" pass) — Summon:
          // Knights of Round's own real Saga chapter V trigger.
          triggeredBy: 'chapterV',
        },
        provenance: { origin: 'parser', rule: 'putCounterAll-effect-structural' },
      },
      {
        role: 'sink',
        fact: {
          to: 'Battlefield',
          controller: 'you',
          types: { has: ['Creature'] },
          excludeSelf: true,
          annotations: [{ target: 'oracle', line: 2, start: 109, end: 121 }],
        },
        provenance: { origin: 'parser', rule: 'putCounterAll-effect-structural' },
      },
    ]);
  });
});
