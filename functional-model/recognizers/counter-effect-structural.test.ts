// Verifies `counter-effect-structural.ts` against the real, whole-pool
// 3-card set: Louisoix's Sacrifice (verbatim, same capitalization),
// Swallowed by Leviathan (case-insensitive only, mid-sentence real text),
// Syncopate (verbatim).
import { describe, expect, it } from 'vitest';
import { louisoixsSacrifice } from '../cards/louisoix-s-sacrifice/definition';
import { swallowedByLeviathan } from '../cards/swallowed-by-leviathan/definition';
import { syncopate } from '../cards/syncopate/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeCounterEffectStructural, type StructuralRecognizerInput } from './counter-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('counter-effect-structural', () => {
  it("accepts Louisoix's Sacrifice — describe matches its own oracle text VERBATIM (same capitalization); the SAME `counterEffect` object is shared by BOTH modal modes (real card structure — an additional-cost choice, not 2 distinct counter clauses), so this recognizer independently matches it twice (dedup is apply-recognizers.mjs's own runner-level job, same 'no exclusive-consumption line-claiming' precedent token-creation-structural.ts's own Saga case already establishes)", () => {
    const input = structuralInput("Louisoix's Sacrifice", louisoixsSacrifice);
    const result = recognizeCounterEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    for (const f of result.facts) {
      expect(f).toEqual({
        role: 'source',
        fact: { event: 'counter', target: {}, targeted: true, annotations: [expect.objectContaining({ target: 'oracle' })] },
        provenance: { origin: 'parser', rule: 'counter-effect-structural' },
      });
    }
    const ann = result.facts[0]!.fact.annotations![0]!;
    const line = input.oracleText.split('\n')[ann.line]!;
    expect(line.slice(ann.start, ann.end)).toBe('Counter target activated ability, triggered ability, or noncreature spell.');
  });

  it('accepts Swallowed by Leviathan — describe matches mid-sentence, case-insensitively only ("...then counter the chosen spell...")', () => {
    const input = structuralInput('Swallowed by Leviathan', swallowedByLeviathan);
    const result = recognizeCounterEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'counter', target: {}, targeted: true });
    const ann = result.facts[0]!.fact.annotations![0]!;
    const line = input.oracleText.split('\n')[ann.line]!;
    expect(line.slice(ann.start, ann.end).toLowerCase()).toBe('counter the chosen spell unless its controller pays {1} for each card in your graveyard.');
  });

  it('accepts Syncopate — describe matches its own oracle text VERBATIM (curly-brace {X} mana symbol correctly escaped, not treated as a regex quantifier)', () => {
    const input = structuralInput('Syncopate', syncopate);
    const result = recognizeCounterEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'counter', target: {}, targeted: true });
  });

  it('declines a card with no counter Effect at all on this face', () => {
    const result = recognizeCounterEffectStructural(structuralInput('Ahriman', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'counter'") });
  });
});
