// Verifies `dealDamage-effect-structural.ts` against every real
// `kind:'dealDamage'` Effect in the pool (7 real occurrences, see that
// file's own module doc comment) — literal-amount cases, both real
// non-literal (`Computed<number>`) cases (one that gets a tier-2 paired
// sink, one that correctly doesn't), and the real declines.
import { describe, expect, it } from 'vitest';
import { blackWaltzNo3 } from '../cards/black-waltz-no-3/definition';
import { joshuaPhoenixsDominant } from '../cards/joshua-phoenix-s-dominant-phoenix-warden-of-fire/definition';
import { sabotender } from '../cards/sabotender/definition';
import { theEmperorOfPalamecia } from '../cards/the-emperor-of-palamecia-the-lord-master-of-hell/definition';
import { viviOrnitier } from '../cards/vivi-ornitier/definition';
import { summonBahamut } from '../cards/summon-bahamut/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeDealDamageEffectStructural, type StructuralRecognizerInput } from './dealDamage-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('dealDamage-effect-structural — literal + Computed<number> `dealDamage` effects targeting "opponents"', () => {
  it('accepts Black Waltz No. 3 — literal amount:2, "Black Waltz No. 3 deals 2 damage to each opponent."', () => {
    const result = recognizeDealDamageEffectStructural(structuralInput('Black Waltz No. 3', blackWaltzNo3));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'damage', controller: 'you', recipient: 'opp', targeted: false, annotations: [{ target: 'oracle', line: 1, start: expect.any(Number), end: expect.any(Number) }] },
        provenance: { origin: 'parser', rule: 'dealDamage-effect-structural' },
      },
    ]);
    // No Computed amount here — confirm no tier-2 sink is ever attempted for
    // a literal amount (only 1 fact, not 2).
    expect(result.facts).toHaveLength(1);
  });

  it('accepts Phoenix, Warden of Fire (Joshua\'s back face) — chapterI + chapterII share the SAME real clause, both returned (dedup happens at the runner level, not here)', () => {
    const backDef = joshuaPhoenixsDominant.backFace!;
    const result = recognizeDealDamageEffectStructural(structuralInput('Joshua, Phoenix\'s Dominant // Phoenix, Warden of Fire', backDef, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]).toEqual(result.facts[1]);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'damage', controller: 'you', recipient: 'opp', targeted: false });
  });

  it('accepts Sabotender — "this creature deals 1 damage to each opponent."', () => {
    const result = recognizeDealDamageEffectStructural(structuralInput('Sabotender', sabotender));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'damage', controller: 'you', recipient: 'opp', targeted: false });
  });

  it('accepts Vivi Ornitier — "...it deals 1 damage to each opponent." (pronoun subject, not the card\'s own name/"this creature")', () => {
    const result = recognizeDealDamageEffectStructural(structuralInput('Vivi Ornitier', viviOrnitier));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'damage', controller: 'you', recipient: 'opp', targeted: false });
  });

  it('accepts Summon: Bahamut (chapter IV, Mega Flare) — Computed<number> amount, classified "scales with permanents you control" by the promoted runtime probe, so ALSO emits the paired SINK fact', () => {
    const result = recognizeDealDamageEffectStructural(structuralInput('Summon: Bahamut', summonBahamut));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    const [sourceFact, sinkFact] = result.facts;
    expect(sourceFact).toEqual({
      role: 'source',
      fact: { event: 'damage', controller: 'you', recipient: 'opp', targeted: false, annotations: [{ target: 'oracle', line: 3, start: 32, end: 123 }] },
      provenance: { origin: 'parser', rule: 'dealDamage-effect-structural' },
    });
    expect(sinkFact).toEqual({
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', annotations: [{ target: 'oracle', line: 3, start: 32, end: 123 }] },
      provenance: { origin: 'parser', rule: 'dealDamage-effect-structural' },
    });
    // Real byproduct check: the claimed span really does read the real
    // "deals ... damage ... to each opponent" clause verbatim. Also matches
    // this card's own pre-existing hand-authored `damage` fact's annotation
    // byte-for-byte ({line:3,start:32,end:123}), which is exactly why this
    // recognizer retags it in place instead of appending a duplicate.
    const input = structuralInput('Summon: Bahamut', summonBahamut);
    const lines = input.oracleText.split('\n');
    expect(lines[3]!.slice(32, 123)).toBe(
      'deals damage equal to the total mana value of other permanents you control to each opponent',
    );
  });

  it('accepts The Lord Master of Hell (Emperor of Palamecia\'s back face) — Computed<number> amount classified "scales with cards in your graveyard", a bucket with NO confirmed sink shape, so the source fact is still asserted but NO sink is emitted', () => {
    const backDef = theEmperorOfPalamecia.backFace!;
    const result = recognizeDealDamageEffectStructural(structuralInput('The Emperor of Palamecia // The Lord Master of Hell', backDef, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'damage', controller: 'you', recipient: 'opp', targeted: false });
  });

  it('declines a card with no dealDamage effect at all on this face', () => {
    const result = recognizeDealDamageEffectStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '' } as CardDefinition as unknown as StructuralRecognizerInput);
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no kind:"dealDamage"') });
  });

  it('declines a synthetic dealDamage effect whose target is not "opponents" — no confirmed real Fact shape for any other EffectOwner value', () => {
    const input: StructuralRecognizerInput = {
      name: 'Fake Card',
      typeLine: 'Creature',
      oracleText: 'Fake Card deals 1 damage to you.',
      effects: [{ kind: 'dealDamage', target: 'you', amount: 1 }] as unknown as StructuralRecognizerInput['effects'],
    };
    const result = recognizeDealDamageEffectStructural(input);
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('only "opponents" has a confirmed real Fact shape') });
  });

  it('declines (mismatch) a synthetic dealDamage effect whose real text has no "deals ... damage to each opponent" clause at all', () => {
    const input: StructuralRecognizerInput = {
      name: 'Fake Card',
      typeLine: 'Creature',
      oracleText: 'Fake Card fights target creature.',
      effects: [{ kind: 'dealDamage', target: 'opponents', amount: 1 }] as unknown as StructuralRecognizerInput['effects'],
    };
    const result = recognizeDealDamageEffectStructural(input);
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.kind).toBe('mismatch');
  });
});
