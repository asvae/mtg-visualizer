// Verifies `loseLife-effect-structural.ts` against the real pool: the 3
// literal RESOLUTION-phrasing cards the task named (Al Bhed Salvagers,
// Circle of Power, Fang, Fearless l'Cie), the COST-phrasing card (Dark
// Knight's Greatsword's own "Equip—Pay 3 life"), the TARGETED "opponent
// loses" shape (Al Bhed Salvagers again, plus Sephiroth's own real
// front+back-face repeat), the UNTARGETED "each opponent/player loses"
// shape (Malboro, Summon: Anima chapter IV, Summon: Primal Odin chapter
// III), and the real Computed<number> decline (Dark Confidant, mirroring
// `gainLife-effect-structural.test.ts`'s own Omega, Heartless Evolution
// case).
import { describe, expect, it } from 'vitest';
import { alBhedSalvagers } from '../cards/al-bhed-salvagers/definition';
import { circleOfPower } from '../cards/circle-of-power/definition';
import { fangFearlessLcie } from '../cards/fang-fearless-l-cie/definition';
import { darkConfidant } from '../cards/dark-confidant/definition';
import { darkKnightsGreatsword } from '../cards/dark-knight-s-greatsword/definition';
import { malboro } from '../cards/malboro/definition';
import { summonAnima } from '../cards/summon-anima/definition';
import { summonPrimalOdin } from '../cards/summon-primal-odin/definition';
import { sephirothFabledSoldier } from '../cards/sephiroth-fabled-soldier-sephiroth-one-winged-angel/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeLoseLifeEffectStructural, type StructuralRecognizerInput } from './loseLife-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('loseLife-effect-structural', () => {
  it('accepts Circle of Power — "you lose 2 life" (resolution phrasing)', () => {
    const result = recognizeLoseLifeEffectStructural(structuralInput('Circle of Power', circleOfPower));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'lifeloss', controller: 'you', annotations: [expect.objectContaining({ target: 'oracle' })] },
        provenance: { origin: 'parser', rule: 'loseLife-effect-structural' },
      },
    ]);
  });

  it("accepts Fang, Fearless l'Cie — \"you lose 1 life\" (resolution phrasing)", () => {
    const result = recognizeLoseLifeEffectStructural(structuralInput("Fang, Fearless l'Cie", fangFearlessLcie));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'lifeloss', controller: 'you' });
  });

  it('accepts Al Bhed Salvagers — "target opponent loses 1 life" (targeted phrasing), controller:opp/targeted:true', () => {
    const result = recognizeLoseLifeEffectStructural(structuralInput('Al Bhed Salvagers', alBhedSalvagers));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'lifeloss', controller: 'opp', targeted: true });
    const ann = result.facts[0]!.fact.annotations![0]!;
    const input = structuralInput('Al Bhed Salvagers', alBhedSalvagers);
    const line = input.oracleText.split('\n')[ann.line]!;
    expect(line.slice(ann.start, ann.end)).toBe('target opponent loses 1 life');
  });

  it('accepts Sephiroth, Fabled SOLDIER // Sephiroth, One-Winged Angel — the SAME "target opponent loses 1 life" clause on BOTH real faces (front trigger, back granted-emblem text)', () => {
    const frontResult = recognizeLoseLifeEffectStructural(structuralInput('Sephiroth, Fabled SOLDIER // Sephiroth, One-Winged Angel', sephirothFabledSoldier, 'front'));
    expect(frontResult.matched, `front got: ${!frontResult.matched && frontResult.reason}`).toBe(true);
    if (frontResult.matched) {
      expect(frontResult.facts[0]!.fact).toMatchObject({ event: 'lifeloss', controller: 'opp', targeted: true });
    }
    const backDef = sephirothFabledSoldier.backFace as CardDefinition;
    const backResult = recognizeLoseLifeEffectStructural(structuralInput('Sephiroth, Fabled SOLDIER // Sephiroth, One-Winged Angel', backDef, 'back'));
    expect(backResult.matched, `back got: ${!backResult.matched && backResult.reason}`).toBe(true);
    if (backResult.matched) {
      expect(backResult.facts[0]!.fact).toMatchObject({ event: 'lifeloss', controller: 'opp', targeted: true });
    }
  });

  it('accepts Malboro — "each opponent discards a card, loses 2 life, and exiles..." (untargeted phrasing, "loses" mid-list, not adjacent to "opponent")', () => {
    const result = recognizeLoseLifeEffectStructural(structuralInput('Malboro', malboro));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'lifeloss', controller: 'opp', targeted: false });
  });

  it('accepts Summon: Anima — chapters I/II/III share "you lose 1 life" (one real line, 3 structurally-identical effects), chapter IV\'s own "Each opponent ... loses 3 life" is untargeted opp', () => {
    const result = recognizeLoseLifeEffectStructural(structuralInput('Summon: Anima', summonAnima));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(4); // 3 identical chapterI/II/III + chapterIV — dedup is apply-recognizers.mjs's own job, not this recognizer's
    const youFacts = result.facts.filter((f) => (f.fact as { controller?: string }).controller === 'you');
    const oppFacts = result.facts.filter((f) => (f.fact as { controller?: string }).controller === 'opp');
    expect(youFacts).toHaveLength(3);
    expect(oppFacts).toHaveLength(1);
    expect(oppFacts[0]!.fact).toMatchObject({ targeted: false });
  });

  it('accepts Summon: Primal Odin chapter III — "Each player loses 2 life" (owner:\'each\'), controller:you only (same simplification this card\'s own pre-existing hand-authored fact already used)', () => {
    const result = recognizeLoseLifeEffectStructural(structuralInput('Summon: Primal Odin', summonPrimalOdin));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'lifeloss', controller: 'you', targeted: false });
  });

  it('accepts Dark Knight\'s Greatsword — "Equip—Pay 3 life" (cost phrasing, not resolution phrasing)', () => {
    const result = recognizeLoseLifeEffectStructural(structuralInput("Dark Knight's Greatsword", darkKnightsGreatsword));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'lifeloss', controller: 'you' });
    const ann = result.facts[0]!.fact.annotations![0]!;
    const input = structuralInput("Dark Knight's Greatsword", darkKnightsGreatsword);
    const line = input.oracleText.split('\n')[ann.line]!;
    expect(line.slice(ann.start, ann.end)).toBe('Pay 3 life');
  });

  it('declines Dark Confidant — a real Computed<number> amount ("You lose life equal to its mana value"), same wall gainLife-effect-structural.ts already documents for Omega, Heartless Evolution', () => {
    const result = recognizeLoseLifeEffectStructural(structuralInput('Dark Confidant', darkConfidant));
    expect(result.matched).toBe(false);
  });

  it('declines a card with no loseLife Effect at all on this face', () => {
    const result = recognizeLoseLifeEffectStructural(structuralInput('Ahriman', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'loseLife'") });
  });
});
