// Verifies `pumpAllCreaturesYouControl-effect-structural.ts` against every
// real `kind:'pumpAll', predicate:'creatures-you-control'` occurrence in
// the pool with literal power/toughness — see that recognizer's own module
// doc comment for the full pool-wide check.
import { describe, expect, it } from 'vitest';
import { summonChocoMog } from '../cards/summon-choco-mog/definition';
import { summonKnightsOfRound } from '../cards/summon-knights-of-round/definition';
import { esperOriginsSummonEsperMaduin } from '../cards/esper-origins-summon-esper-maduin/definition';
import { circleOfPower } from '../cards/circle-of-power/definition';
import { summonEsperRamuh } from '../cards/summon-esper-ramuh/definition';
import { sidequestRaiseAChocobo } from '../cards/sidequest-raise-a-chocobo-black-chocobo/definition';
import { rydiaSReturn } from '../cards/rydia-s-return/definition';
import { theWanderingMinstrel } from '../cards/the-wandering-minstrel/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizePumpAllCreaturesYouControlEffectStructural, type StructuralRecognizerInput } from './pumpAllCreaturesYouControl-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const half = face === 'back' ? card.back! : card.front;
  const def2 = face === 'back' ? def.backFace! : def;
  return { name: def2.name, typeLine: half.typeLine, oracleText: half.oracleText, effects: def2.effects, triggers: def2.triggers, abilities: def2.abilities };
}

describe("pumpAllCreaturesYouControl-effect-structural", () => {
  it('accepts Summon: Choco/Mog (notSelf, 4 identical chapters collapse to 1 group)', () => {
    const result = recognizePumpAllCreaturesYouControlEffectStructural(structuralInput('Summon: Choco/Mog', summonChocoMog));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]).toMatchObject({
      role: 'source',
      fact: { event: 'pump', target: { types: { has: ['Creature'] }, excludeSelf: true }, untilEndOfTurn: true },
    });
    expect(result.facts[1]).toMatchObject({ role: 'sink', fact: { to: 'Battlefield', types: { has: ['Creature'] }, excludeSelf: true } });
  });

  it('accepts Summon: Knights of Round chapter V (notSelf, matches its own pre-existing hand-authored source fact byte-for-byte)', () => {
    const result = recognizePumpAllCreaturesYouControlEffectStructural(structuralInput('Summon: Knights of Round', summonKnightsOfRound));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'pump',
          controller: 'you',
          target: { types: { has: ['Creature'] }, excludeSelf: true },
          targeted: false,
          untilEndOfTurn: true,
          annotations: [{ target: 'oracle', line: 2, start: 51, end: 56 }],
          // `Fact.triggeredBy` (2026-09-16, "widen populate" pass) — Summon:
          // Knights of Round's own real Saga chapter V trigger.
          triggeredBy: 'chapterV',
        },
        provenance: { origin: 'parser', rule: 'pumpAllCreaturesYouControl-effect-structural' },
      },
      {
        role: 'sink',
        fact: {
          to: 'Battlefield',
          controller: 'you',
          types: { has: ['Creature'] },
          excludeSelf: true,
          // WIDENED (2026-09-16, fin/20-47 pass) — the sink now spans the
          // WHOLE matched clause, not the same narrow "+2/+2" span the
          // source fact uses (closes a real `verify-text-coverage.mjs` gap:
          // the "Other creatures you control get" prefix was never covered
          // by anything). No `triggeredBy` on a sink fact at all (2026-09-16,
          // sink/triggeredBy architecture correction).
          annotations: [{ target: 'oracle', line: 2, start: 19, end: 74 }],
        },
        provenance: { origin: 'parser', rule: 'pumpAllCreaturesYouControl-effect-structural' },
      },
    ]);
    // Real regression-guard: slice-and-assert the literal widened substring.
    const line2 = finCards.get('Summon: Knights of Round')!.front.oracleText.split('\n')[2]!;
    expect(line2.slice(19, 74)).toBe('Other creatures you control get +2/+2 until end of turn');
  });

  it("accepts Esper Origins // Summon: Esper Maduin's own back face chapter III (notSelf, tolerates \"and gain trample\" gap before \"until end of turn\")", () => {
    const result = recognizePumpAllCreaturesYouControlEffectStructural(structuralInput('Esper Origins // Summon: Esper Maduin', esperOriginsSummonEsperMaduin, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]).toMatchObject({ role: 'source', fact: { event: 'pump', target: { types: { has: ['Creature'] }, excludeSelf: true }, untilEndOfTurn: true } });
  });

  it('accepts Circle of Power (subtype Wizard, tolerates "and gain lifelink" gap)', () => {
    const result = recognizePumpAllCreaturesYouControlEffectStructural(structuralInput('Circle of Power', circleOfPower));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]).toMatchObject({ role: 'source', fact: { event: 'pump', target: { types: { has: ['Creature', 'Wizard'] } }, untilEndOfTurn: true } });
  });

  it('accepts Summon: Esper Ramuh (subtype Wizard, chapters II+III share one real clause, collapse to 1 group)', () => {
    const result = recognizePumpAllCreaturesYouControlEffectStructural(structuralInput('Summon: Esper Ramuh', summonEsperRamuh));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]).toMatchObject({ role: 'source', fact: { event: 'pump', target: { types: { has: ['Creature', 'Wizard'] } }, untilEndOfTurn: true } });
  });

  it("accepts Sidequest: Raise a Chocobo // Black Chocobo's own back face (subtype Bird)", () => {
    const result = recognizePumpAllCreaturesYouControlEffectStructural(structuralInput('Sidequest: Raise a Chocobo // Black Chocobo', sidequestRaiseAChocobo, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]).toMatchObject({ role: 'source', fact: { event: 'pump', target: { types: { has: ['Creature', 'Bird'] } }, untilEndOfTurn: true } });
  });

  it("accepts Rydia's Return (no subtype/notSelf)", () => {
    const result = recognizePumpAllCreaturesYouControlEffectStructural(structuralInput("Rydia's Return", rydiaSReturn));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]).toMatchObject({ role: 'source', fact: { event: 'pump', target: { types: { has: ['Creature'] } }, untilEndOfTurn: true } });
  });

  it('declines The Wandering Minstrel (Computed power/toughness — opaque)', () => {
    const result = recognizePumpAllCreaturesYouControlEffectStructural(structuralInput('The Wandering Minstrel', theWanderingMinstrel));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('non-literal') });
  });
});
