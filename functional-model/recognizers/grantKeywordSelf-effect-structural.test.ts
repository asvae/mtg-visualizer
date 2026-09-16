// Verifies `grantKeywordSelf-effect-structural.ts` against the real
// matches/declines its own module doc comment names.
import { describe, expect, it } from 'vitest';
import { sahagin } from '../cards/sahagin/definition';
import { sidequestHuntTheMark } from '../cards/sidequest-hunt-the-mark-yiazmat-ultimate-mark/definition';
import type { CardDefinition, Effect } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeGrantKeywordSelfEffectStructural, type StructuralRecognizerInput } from './grantKeywordSelf-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('grantKeywordSelf-effect-structural', () => {
  it("accepts Sahagin — Unblockable, real idiom \"and it can't be blocked this turn\"", () => {
    const result = recognizeGrantKeywordSelfEffectStructural(structuralInput('Sahagin', sahagin));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'grantKeyword',
          keyword: 'Unblockable',
          target: 'self',
          untilEndOfTurn: true,
          annotations: [{ target: 'oracle', line: 0, start: 124, end: 153 }],
          // `Fact.triggeredBy` (2026-09-16, "widen populate" pass) — Sahagin's
          // own real "Whenever you cast a noncreature spell with mana value
          // 4 or greater..." trigger.
          triggeredBy: 'onCastNoncreatureSpell4Mana',
        },
        provenance: { origin: 'parser', rule: 'grantKeywordSelf-effect-structural' },
      },
    ]);
  });

  it('accepts Sidequest: Hunt the Mark // Yiazmat, Ultimate Mark (back face) — Indestructible, own printed name as subject, "gains indestructible until end of turn"', () => {
    const backDef = sidequestHuntTheMark.backFace!;
    const result = recognizeGrantKeywordSelfEffectStructural(structuralInput('Sidequest: Hunt the Mark // Yiazmat, Ultimate Mark', backDef, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'grantKeyword', keyword: 'Indestructible', target: 'self', untilEndOfTurn: true });
  });

  it('declines an unconfirmed keyword', () => {
    const def: CardDefinition = { name: 'Test Card', effects: [{ kind: 'grantKeywordSelf', keyword: 'Flying', untilEndOfTurn: true } satisfies Effect] };
    const result = recognizeGrantKeywordSelfEffectStructural(structuralInput('Sahagin', def));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no confirmed real English self-grant template') });
  });

  it('declines no untilEndOfTurn', () => {
    const def: CardDefinition = { name: 'Test Card', effects: [{ kind: 'grantKeywordSelf', keyword: 'Indestructible' } satisfies Effect] };
    const result = recognizeGrantKeywordSelfEffectStructural(structuralInput('Sahagin', def));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no untilEndOfTurn') });
  });

  it('declines a card with no grantKeywordSelf effect at all on this face', () => {
    const result = recognizeGrantKeywordSelfEffectStructural(structuralInput('Sahagin', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'grantKeywordSelf'") });
  });
});
