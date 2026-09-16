// Verifies `continuousKeywordGrantsSubtype-structural.ts` against its real
// cards: Ardyn's own `includeSelf:false` 3-keyword Oxford-comma list,
// Dion's own `includeSelf:true`/`onlyDuringYourTurn:true` single keyword,
// The Fire Crystal's own bare, no-`subtype` "Creatures you control have
// haste," and (2026-09-16 static-ability audit widening) the genuinely
// third self-only shape: freya-crescent/kain-traitorous-dragoon (Legendary,
// own short name) and tonberry (non-Legendary, "this creature").
import { describe, expect, it } from 'vitest';
import { ardynTheUsurper } from '../cards/ardyn-the-usurper/definition';
import { dionBahamutsDominant } from '../cards/dion-bahamut-s-dominant-bahamut-warden-of-light/definition';
import { theFireCrystal } from '../cards/the-fire-crystal/definition';
import { freyaCrescent } from '../cards/freya-crescent/definition';
import { kainTraitorousDragoon } from '../cards/kain-traitorous-dragoon/definition';
import { tonberry } from '../cards/tonberry/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import {
  recognizeContinuousKeywordGrantsSubtypeStructural,
  type ContinuousKeywordGrantsSubtypeRecognizerInput,
} from './continuousKeywordGrantsSubtype-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): ContinuousKeywordGrantsSubtypeRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, continuousKeywordGrants: def.continuousKeywordGrants };
}

describe('continuousKeywordGrantsSubtype-structural', () => {
  it('accepts Ardyn, the Usurper (includeSelf:false, 3-keyword Oxford-comma list)', () => {
    const result = recognizeContinuousKeywordGrantsSubtypeStructural(structuralInput('Ardyn, the Usurper', ardynTheUsurper));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'grantKeyword', keyword: 'Menace', controller: 'you', target: { types: { has: ['Demon'] } }, annotations: [{ target: 'oracle', line: 0, start: 0, end: 51 }] },
        provenance: { origin: 'parser', rule: 'continuousKeywordGrantsSubtype-structural' },
      },
      {
        role: 'source',
        fact: { event: 'grantKeyword', keyword: 'Lifelink', controller: 'you', target: { types: { has: ['Demon'] } }, annotations: [{ target: 'oracle', line: 0, start: 0, end: 51 }] },
        provenance: { origin: 'parser', rule: 'continuousKeywordGrantsSubtype-structural' },
      },
      {
        role: 'source',
        fact: { event: 'grantKeyword', keyword: 'Haste', controller: 'you', target: { types: { has: ['Demon'] } }, annotations: [{ target: 'oracle', line: 0, start: 0, end: 51 }] },
        provenance: { origin: 'parser', rule: 'continuousKeywordGrantsSubtype-structural' },
      },
    ]);
  });

  it("accepts Dion, Bahamut's Dominant (includeSelf:true, onlyDuringYourTurn, single keyword)", () => {
    const result = recognizeContinuousKeywordGrantsSubtypeStructural(
      structuralInput("Dion, Bahamut's Dominant // Bahamut, Warden of Light", dionBahamutsDominant),
    );
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'grantKeyword', keyword: 'Flying', controller: 'you', target: { types: { has: ['Knight'] } }, annotations: [{ target: 'oracle', line: 0, start: 18, end: 82 }] },
        provenance: { origin: 'parser', rule: 'continuousKeywordGrantsSubtype-structural' },
      },
    ]);
  });

  it('accepts The Fire Crystal (no subtype at all — "Creatures you control have haste")', () => {
    const result = recognizeContinuousKeywordGrantsSubtypeStructural(structuralInput('The Fire Crystal', theFireCrystal));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'grantKeyword', keyword: 'Haste', controller: 'you', target: { types: { has: ['Creature'] } }, annotations: [{ target: 'oracle', line: 1, start: 0, end: 32 }] },
        provenance: { origin: 'parser', rule: 'continuousKeywordGrantsSubtype-structural' },
      },
    ]);
  });

  it('accepts Freya Crescent (Legendary, self-only, onlyDuringYourTurn, single keyword)', () => {
    const result = recognizeContinuousKeywordGrantsSubtypeStructural(structuralInput('Freya Crescent', freyaCrescent));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'grantKeyword', keyword: 'Flying', target: 'self' });
    // 2026-09-16 widening: annotation covers the whole "Jump — During your
    // turn, Freya Crescent has flying" clause (minus the "Jump — " label),
    // not just the bare word "flying" — closes a real verify-text-coverage
    // gap ("Jump — During your turn, Freya Crescent has" was uncovered).
    const card = finCards.get('Freya Crescent')!;
    const ann = result.facts[0]!.fact.annotations![0]!;
    const line = card.front.oracleText.split('\n')[ann.line as number]!;
    expect(line.slice(ann.start as number, ann.end as number)).toBe('During your turn, Freya Crescent has flying');
  });

  it('accepts Kain, Traitorous Dragoon (Legendary, self-only, lowercase "during your turn")', () => {
    const result = recognizeContinuousKeywordGrantsSubtypeStructural(structuralInput('Kain, Traitorous Dragoon', kainTraitorousDragoon));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'grantKeyword', keyword: 'Flying', target: 'self' });
    const card = finCards.get('Kain, Traitorous Dragoon')!;
    const ann = result.facts[0]!.fact.annotations![0]!;
    const line = card.front.oracleText.split('\n')[ann.line as number]!;
    expect(line.slice(ann.start as number, ann.end as number)).toBe('During your turn, Kain has flying');
  });

  it('accepts Tonberry (non-Legendary, self-only via "this creature," 2-keyword list)', () => {
    const result = recognizeContinuousKeywordGrantsSubtypeStructural(structuralInput('Tonberry', tonberry));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts.map((f) => (f.fact as { keyword: string }).keyword).sort()).toEqual(['Deathtouch', 'FirstStrike']);
    for (const f of result.facts) expect(f.fact).toMatchObject({ target: 'self' });
    // Both keywords share the identical full-clause annotation (real,
    // accepted duplication — see this recognizer's own 2026-09-16 widening
    // comment).
    const card = finCards.get('Tonberry')!;
    for (const f of result.facts) {
      const ann = f.fact.annotations![0]!;
      const line = card.front.oracleText.split('\n')[ann.line as number]!;
      expect(line.slice(ann.start as number, ann.end as number)).toBe('During your turn, this creature has first strike and deathtouch');
    }
  });
});
