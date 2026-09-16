import { describe, expect, it } from 'vitest';
import { blazingBomb } from '../cards/blazing-bomb/definition';
import { lightOfJudgment } from '../cards/light-of-judgment/definition';
import { slashOfLight } from '../cards/slash-of-light/definition';
import { suplex } from '../cards/suplex/definition';
import { thunderMagic } from '../cards/thunder-magic/definition';
import { summonEsperRamuh } from '../cards/summon-esper-ramuh/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeDealDamageTargetEffectStructural, type StructuralRecognizerInput } from './dealDamageTarget-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('dealDamageTarget-effect-structural', () => {
  it('accepts Blazing Bomb ("deals damage equal to its power to target creature" — Computed amount, no recognized collection root, source+sink only) — SOURCE annotation deliberately NOT widened: "It" (bare pronoun) is not a recognized subject form, still starts right at "deals"', () => {
    const result = recognizeDealDamageTargetEffectStructural(structuralInput('Blazing Bomb', blazingBomb));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    const source = result.facts.find((f) => f.role === 'source')!;
    expect(source.fact).toMatchObject({ event: 'damage', controller: 'you', target: { types: { has: ['Creature'] } }, targeted: true });
    const sink = result.facts.find((f) => f.role === 'sink')!;
    expect(sink.fact).toMatchObject({ to: 'Battlefield', types: { has: ['Creature'] } });
    expect((sink.fact as { controller?: string }).controller).toBeUndefined();
    const input = structuralInput('Blazing Bomb', blazingBomb);
    const { line, start, end } = source.fact.annotations![0] as { line: number; start: number; end: number };
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe('deals damage');
  });

  it('accepts Light of Judgment ("deals 6 damage to target creature", ignores the unrelated second sentence) — SOURCE annotation widened to include the card\'s own printed name as the subject', () => {
    const result = recognizeDealDamageTargetEffectStructural(structuralInput('Light of Judgment', lightOfJudgment));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const source = result.facts.find((f) => f.role === 'source')!;
    const input = structuralInput('Light of Judgment', lightOfJudgment);
    const { line, start, end } = source.fact.annotations![0] as { line: number; start: number; end: number };
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe('Light of Judgment deals 6 damage');
  });

  it('declines Slash of Light (migrated 2026-09-16 off kind:\'dealDamageTarget\' onto the kind:\'program\' combinator DSL — no dealDamageTarget Effect left on this face at all)', () => {
    const result = recognizeDealDamageTargetEffectStructural(structuralInput('Slash of Light', slashOfLight));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'dealDamageTarget'") });
  });

  it('accepts Suplex (modal "Suplex deals 3 damage to target creature. If that creature would die...") — SOURCE annotation widened to include the card\'s own printed name as the subject', () => {
    const result = recognizeDealDamageTargetEffectStructural(structuralInput('Suplex', suplex));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const source = result.facts.find((f) => f.role === 'source')!;
    const input = structuralInput('Suplex', suplex);
    const { line, start, end } = source.fact.annotations![0] as { line: number; start: number; end: number };
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe('Suplex deals 3 damage');
  });

  it('accepts Thunder Magic (Tiered, 3 textually distinct repeated-template clauses, one claimed per effect) — every mode\'s SOURCE annotation widened to include the card\'s own printed name, repeated identically per mode', () => {
    const result = recognizeDealDamageTargetEffectStructural(structuralInput('Thunder Magic', thunderMagic));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const sources = result.facts.filter((f) => f.role === 'source');
    expect(sources).toHaveLength(3);
    const input = structuralInput('Thunder Magic', thunderMagic);
    const amounts = ['2', '4', '8'];
    sources.forEach((f, i) => {
      const { line, start, end } = f.fact.annotations![0] as { line: number; start: number; end: number };
      expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe(`Thunder Magic deals ${amounts[i]} damage`);
    });
  });

  it('accepts Summon: Esper Ramuh (owner:"opponents" — "target creature an opponent controls"; Computed amount classifies as "cards in your graveyard", no matching bucket, source+sink only) — SOURCE annotation widened to include "This creature" as the subject (2026-09-16, verify-text-coverage.mjs gap)', () => {
    const result = recognizeDealDamageTargetEffectStructural(structuralInput('Summon: Esper Ramuh', summonEsperRamuh));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const source = result.facts.find((f) => f.role === 'source')!;
    expect(source.fact).toMatchObject({ event: 'damage', controller: 'you', target: { types: { has: ['Creature'] } }, targeted: true });
    const sink = result.facts.find((f) => f.role === 'sink')!;
    expect(sink.fact).toMatchObject({ to: 'Battlefield', controller: 'opp', types: { has: ['Creature'] } });
    const input = structuralInput('Summon: Esper Ramuh', summonEsperRamuh);
    const { line, start, end } = source.fact.annotations![0] as { line: number; start: number; end: number };
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe('This creature deals damage');
  });

  it('declines a card with no dealDamageTarget effect at all on this face', () => {
    const result = recognizeDealDamageTargetEffectStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '' });
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'dealDamageTarget'") });
  });
});
