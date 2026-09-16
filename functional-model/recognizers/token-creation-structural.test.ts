// Verifies `token-creation-structural.ts` against the real pool: both
// user-named priority cards (Aerith Rescue Mission's "Hero token ETB",
// Battle Menu's "Knight token ETB"), a handful of the other real matches
// this recognizer's own module doc comment names, a Saga's own repeated-
// chapter case (Summon: Knights of Round — 4 structurally identical
// effects, no exclusive line-claiming), the "for each ... you control"
// scaling-amount MATCH (Moogles' Valor, 2026-09-16 — previously a blanket
// decline), and the real, specifically-named decline reasons (the 3 OTHER
// non-literal-amount cards, each a genuinely different real shape; inline
// TokenInfo literal with no TOKENS registry id) — same fixture convention
// every other structural recognizer test file already uses.
import { describe, expect, it } from 'vitest';
import { aerithRescueMission } from '../cards/aerith-rescue-mission/definition';
import { battleMenu } from '../cards/battle-menu/definition';
import { circleOfPower } from '../cards/circle-of-power/definition';
import { mooglesValor } from '../cards/moogles-valor/definition';
import { rufusShinra } from '../cards/rufus-shinra/definition';
import { theFinalDays } from '../cards/the-final-days/definition';
import { theWanderingMinstrel } from '../cards/the-wandering-minstrel/definition';
import { summonKnightsOfRound } from '../cards/summon-knights-of-round/definition';
import { undercityDireRat } from '../cards/undercity-dire-rat/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeTokenCreationStructural, type StructuralRecognizerInput } from './token-creation-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('token-creation-structural — real, unavoidable CR 111.7 consequence of any kind:"createToken" effect', () => {
  it("accepts Aerith Rescue Mission — the user's own named priority case (Hero token ETB), a modal mode's own createToken effect", () => {
    const result = recognizeTokenCreationStructural(structuralInput('Aerith Rescue Mission', aerithRescueMission));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'entersBattlefield', to: 'Battlefield', controller: 'you', subject: { token: 'c_1_1_hero' }, annotations: [{ target: 'oracle', line: 1, start: 22, end: 69 }] },
        provenance: { origin: 'parser', rule: 'token-creation-structural' },
      },
    ]);
    const input = structuralInput('Aerith Rescue Mission', aerithRescueMission);
    expect(input.oracleText.split('\n')[1]!.slice(22, 69)).toBe('Create three 1/1 colorless Hero creature tokens');
  });

  it("accepts Battle Menu — the user's own named priority case (Knight token ETB), matching this card's own pre-existing hand-authored fact byte-for-byte", () => {
    const result = recognizeTokenCreationStructural(structuralInput('Battle Menu', battleMenu));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'entersBattlefield', to: 'Battlefield', controller: 'you', subject: { token: 'w_2_2_knight' }, annotations: [{ target: 'oracle', line: 1, start: 11, end: 51 }] },
        provenance: { origin: 'parser', rule: 'token-creation-structural' },
      },
    ]);
  });

  it('accepts Undercity Dire Rat — a noncreature (Treasure) token, no P/T requirement in the built pattern', () => {
    const result = recognizeTokenCreationStructural(structuralInput('Undercity Dire Rat', undercityDireRat));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'entersBattlefield', to: 'Battlefield', controller: 'you', subject: { token: 'c_a_treasure_sac' } });
  });

  it('accepts Summon: Knights of Round — 4 structurally-identical Saga chapters, NOT exclusive-line-claimed (all 4 independently match the same real printed line; downstream dedup is apply-recognizers.mjs\'s own job, not this recognizer\'s)', () => {
    const result = recognizeTokenCreationStructural(structuralInput('Summon: Knights of Round', summonKnightsOfRound));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(4);
    for (const f of result.facts) {
      expect(f.fact).toMatchObject({ event: 'entersBattlefield', to: 'Battlefield', controller: 'you', subject: { token: 'w_2_2_knight' } });
    }
  });

  it('accepts Moogles\' Valor — a real "for each creature you control, create ..." per-instance scaling amount (Computed<number>), exactly 1 SOURCE fact (no paired sink, same single-fact convention as every other match above)', () => {
    const input = structuralInput("Moogles' Valor", mooglesValor);
    const result = recognizeTokenCreationStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]).toMatchObject({
      role: 'source',
      fact: { event: 'entersBattlefield', to: 'Battlefield', controller: 'you', subject: { token: 'w_1_2_moogle_lifelink' } },
      provenance: { origin: 'parser', rule: 'token-creation-structural' },
    });
    const ann = result.facts[0]!.fact.annotations![0]!;
    const line = input.oracleText.split('\n')[ann.line]!;
    expect(line.slice(ann.start, ann.end)).toBe('For each creature you control, create a 1/2 white Moogle creature token');
  });

  it('declines Rufus Shinra — a NAMED-creature presence check ("if you don\'t control a creature named Darkstar"), not a "for each" scaling count at all (also independently declines earlier, via the inline-TokenInfo/no-TOKENS-registry check — its Darkstar token is a literal, not a registry reference — same as this recognizer\'s own pre-existing check order for every other inline-literal card)', () => {
    const result = recognizeTokenCreationStructural(structuralInput('Rufus Shinra', rufusShinra));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no matching TOKENS registry entry') });
  });

  it('declines The Final Days — a two-branch cast-from-graveyard CONDITIONAL count ("create two ... If this spell was cast from a graveyard, instead create X ... where X is the number of creature cards in your graveyard"), not a "for each" scaling count (this one IS a TOKENS-registry token, so it reaches the real amount-anchor check and declines there)', () => {
    const result = recognizeTokenCreationStructural(structuralInput('The Final Days', theFinalDays));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no real quantifier template to verify') });
  });

  it('declines The Wandering Minstrel — a controlled-permanent-count THRESHOLD gate ("if you control five or more Towns, create..."), not a "for each" scaling count (also independently declines earlier, via the inline-TokenInfo/no-TOKENS-registry check — its Elemental token is a literal, not a registry reference)', () => {
    const result = recognizeTokenCreationStructural(structuralInput('The Wandering Minstrel', theWanderingMinstrel));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no matching TOKENS registry entry') });
  });

  it('declines Circle of Power — an inline TokenInfo literal (0/1 black Wizard) with no TOKENS registry id; color is not tracked structurally so no canonical id is derivable', () => {
    const result = recognizeTokenCreationStructural(structuralInput('Circle of Power', circleOfPower));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no matching TOKENS registry entry') });
  });

  it('declines a card with no createToken effect at all on this face', () => {
    const result = recognizeTokenCreationStructural(structuralInput('Ahriman', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'createToken'") });
  });
});
