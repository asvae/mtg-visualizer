// Verifies `grantKeywordAllAttacking-effect-structural.ts` against the one
// real pool card: Cecil, Dark Knight // Cecil, Redeemed Paladin's back face
// ("other attacking creatures gain indestructible until end of turn").
import { describe, expect, it } from 'vitest';
import { cecilDarkKnight } from '../cards/cecil-dark-knight-cecil-redeemed-paladin/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeGrantKeywordAllAttackingEffectStructural, type StructuralRecognizerInput } from './grantKeywordAllAttacking-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('grantKeywordAllAttacking-effect-structural', () => {
  it('accepts Cecil, Redeemed Paladin (back face) — "other attacking creatures gain indestructible until end of turn", source+sink pair; 2026-09-16 SOURCE/SINK split fix: sink narrows to the subject phrase "other attacking creatures," not the whole clause', () => {
    const backDef = cecilDarkKnight.backFace as CardDefinition;
    const input = structuralInput('Cecil, Dark Knight // Cecil, Redeemed Paladin', backDef, 'back');
    const result = recognizeGrantKeywordAllAttackingEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    const source = result.facts.find((f) => f.role === 'source')!;
    const sink = result.facts.find((f) => f.role === 'sink')!;
    expect(source.fact).toMatchObject({
      event: 'grantKeyword',
      keyword: 'Indestructible',
      controller: 'you',
      target: { types: { has: ['Creature'] }, excludeSelf: true },
      attacking: true,
      targeted: false,
      untilEndOfTurn: true,
    });
    // Oracle text (line 1): "Protect — Whenever Cecil attacks, other
    // attacking creatures gain indestructible until end of turn." —
    // [34,59)="other attacking creatures" (sink) — verified by direct
    // string-slice.
    expect(sink.fact).toMatchObject({
      to: 'Battlefield',
      types: { has: ['Creature'] },
      attacking: true,
      annotations: [{ target: 'oracle', line: 1, start: 34, end: 59 }],
    });
    const ann = source.fact.annotations![0]!;
    const line = input.oracleText.split('\n')[ann.line]!;
    expect(line.slice(ann.start, ann.end)).toBe('indestructible');
    const sinkAnn = sink.fact.annotations![0]!;
    const sinkLine = input.oracleText.split('\n')[sinkAnn.line]!;
    expect(sinkLine.slice(sinkAnn.start, sinkAnn.end)).toBe('other attacking creatures');
  });

  it('declines a card with no attacking-creatures grantKeywordAll Effect at all', () => {
    const result = recognizeGrantKeywordAllAttackingEffectStructural(structuralInput('Ahriman', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'grantKeywordAll'") });
  });
});
