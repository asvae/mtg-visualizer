// New test file (2026-09-16, closing 2 real Ambrosia Whiteheart text-
// coverage gaps) — this recognizer had no dedicated test file at all
// before this pass, despite being real, wired, production code (see its
// own module doc comment for the whole-pool check this covers). Verifies
// the 4 real literal-power/toughness accepts (with the 2026-09-16 subject-
// widened annotation span — see module doc comment), plus the 3 real
// `Computed<number>` declines and a couple of synthetic edge declines.
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../card';
import { ambrosiaWhiteheart } from '../cards/ambrosia-whiteheart/definition';
import { chocoSeekerOfParadise } from '../cards/choco-seeker-of-paradise/definition';
import { loporritScout } from '../cards/loporrit-scout/definition';
import { jumboCactuar } from '../cards/jumbo-cactuar/definition';
import { granPulseOchu } from '../cards/gran-pulse-ochu/definition';
import { tifaLockhart } from '../cards/tifa-lockhart/definition';
import { shantottoTacticianMagician } from '../cards/shantotto-tactician-magician/definition';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizePumpSelfEffectStructural, type StructuralRecognizerInput } from './pumpSelf-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('pumpSelf-effect-structural — literal (non-Computed) `kind:"pumpSelf"` effects', () => {
  it('accepts Ambrosia Whiteheart — annotation widened (2026-09-16) to include the card\'s own full printed name as the subject, not just "gets +1/+0 until end of turn"', () => {
    const result = recognizePumpSelfEffectStructural(structuralInput('Ambrosia Whiteheart', ambrosiaWhiteheart));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'pump', target: 'self', annotations: [{ target: 'oracle', line: 2, start: 47, end: 95 }], triggeredBy: 'onLandfall' },
        provenance: { origin: 'parser', rule: 'pumpSelf-effect-structural' },
      },
    ]);
    const input = structuralInput('Ambrosia Whiteheart', ambrosiaWhiteheart);
    expect(input.oracleText.split('\n')[2]!.slice(47, 95)).toBe('Ambrosia Whiteheart gets +1/+0 until end of turn');
  });

  it('accepts Choco, Seeker of Paradise — annotation widened to the short pre-comma form of the card\'s own printed name ("Choco," not "Choco, Seeker of Paradise")', () => {
    const result = recognizePumpSelfEffectStructural(structuralInput('Choco, Seeker of Paradise', chocoSeekerOfParadise));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const input = structuralInput('Choco, Seeker of Paradise', chocoSeekerOfParadise);
    const { line, start, end } = result.facts[0]!.fact.annotations![0] as { line: number; start: number; end: number };
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe('Choco gets +1/+0 until end of turn');
  });

  it('accepts Loporrit Scout — annotation widened to include "this creature" as the subject', () => {
    const result = recognizePumpSelfEffectStructural(structuralInput('Loporrit Scout', loporritScout));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const input = structuralInput('Loporrit Scout', loporritScout);
    const { line, start, end } = result.facts[0]!.fact.annotations![0] as { line: number; start: number; end: number };
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe('this creature gets +1/+1 until end of turn');
  });

  it('accepts Jumbo Cactuar — bare pronoun subject ("it"), a real confirmed form for THIS recognizer only (safe here specifically because of the immediately-following exact numeric suffix — see module doc comment) — annotation widened to include "it"', () => {
    const result = recognizePumpSelfEffectStructural(structuralInput('Jumbo Cactuar', jumboCactuar));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const input = structuralInput('Jumbo Cactuar', jumboCactuar);
    const { line, start, end } = result.facts[0]!.fact.annotations![0] as { line: number; start: number; end: number };
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe('it gets +9999/+0 until end of turn');
  });

  it('declines Gran Pulse Ochu — Computed<number> power, opaque, no real English template can be built without executing it', () => {
    const result = recognizePumpSelfEffectStructural(structuralInput('Gran Pulse Ochu', granPulseOchu));
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.reason).toContain('non-literal (Computed<number>) power/toughness');
  });

  it('declines Tifa Lockhart the same way (Computed<number> power)', () => {
    const result = recognizePumpSelfEffectStructural(structuralInput('Tifa Lockhart', tifaLockhart));
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.reason).toContain('non-literal (Computed<number>) power/toughness');
  });

  it('declines Shantotto, Tactician Magician the same way (Computed<number> power)', () => {
    const result = recognizePumpSelfEffectStructural(structuralInput('Shantotto, Tactician Magician', shantottoTacticianMagician));
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.reason).toContain('non-literal (Computed<number>) power/toughness');
  });

  it('declines a card with no pumpSelf effect at all on this face', () => {
    const result = recognizePumpSelfEffectStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '' } as CardDefinition as unknown as StructuralRecognizerInput);
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'pumpSelf'") });
  });

  it('declines (mismatch) a synthetic pumpSelf effect whose real text has no matching "<subject> gets ±P/±T" clause at all', () => {
    const input: StructuralRecognizerInput = {
      name: 'Fake Card',
      typeLine: 'Creature',
      oracleText: 'Fake Card fights target creature.',
      effects: [{ kind: 'pumpSelf', power: 1, toughness: 1 }] as unknown as StructuralRecognizerInput['effects'],
    };
    const result = recognizePumpSelfEffectStructural(input);
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.kind).toBe('mismatch');
  });
});
