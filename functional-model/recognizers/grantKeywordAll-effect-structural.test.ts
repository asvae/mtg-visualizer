// Verifies `grantKeywordAll-effect-structural.ts` against the real cases
// named in its own module doc comment.
import { describe, expect, it } from 'vitest';
import { dionBahamutsDominant } from '../cards/dion-bahamut-s-dominant-bahamut-warden-of-light/definition';
import { esperOriginsSummonEsperMaduin } from '../cards/esper-origins-summon-esper-maduin/definition';
import { circleOfPower } from '../cards/circle-of-power/definition';
import { summonFatChocobo } from '../cards/summon-fat-chocobo/definition';
import { mooglesValor } from '../cards/moogles-valor/definition';
import { theWindCrystal } from '../cards/the-wind-crystal/definition';
import { restorationMagic } from '../cards/restoration-magic/definition';
import { crystalFragmentsSummonAlexander } from '../cards/crystal-fragments-summon-alexander/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeGrantKeywordAllEffectStructural, type StructuralRecognizerInput } from './grantKeywordAll-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  const d = face === 'back' ? def.backFace! : def;
  return { name: d.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: d.effects, triggers: d.triggers, abilities: d.abilities };
}

describe('grantKeywordAll-effect-structural', () => {
  it("accepts Dion, Bahamut's Dominant back face chapter I/II (notSelf, anaphoric \"Those creatures\")", () => {
    const result = recognizeGrantKeywordAllEffectStructural(
      structuralInput("Dion, Bahamut's Dominant // Bahamut, Warden of Light", dionBahamutsDominant, 'back'),
    );
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // 2 chapters (I, II) share the exact same clause/keyword — collapsed to
    // one fact per this recognizer's own keyword-dedup, the runner's own
    // mergeRecognizedFactsByIdentity would collapse literal duplicates
    // anyway even if this recognizer didn't.
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'grantKeyword',
          keyword: 'Flying',
          controller: 'you',
          target: { types: { has: ['Creature'] }, excludeSelf: true },
          targeted: false,
          untilEndOfTurn: true,
          annotations: [{ target: 'oracle', line: 1, start: 102, end: 108 }],
          // `Fact.triggeredBy` (2026-09-16, "widen populate" pass) — chapterI
          // and chapterII share the identical keyword, so this recognizer's
          // own keyword-dedup (`new Map(...)`, last-key-wins) keeps chapterII
          // as the one representative effect; the SINK below stays untagged
          // since the two chapters genuinely disagree on which trigger
          // caused it (real multi-trigger-same-line case, same "repeats, not
          // a typo" pattern flagged elsewhere in this pass).
          triggeredBy: 'chapterII',
        },
        provenance: { origin: 'parser', rule: 'grantKeywordAll-effect-structural' },
      },
      {
        role: 'sink',
        fact: {
          to: 'Battlefield',
          controller: 'you',
          types: { has: ['Creature'] },
          excludeSelf: true,
          // 2026-09-16 SOURCE/SINK split fix: narrows to just the subject
          // phrase "Those creatures" [81,96) — not the whole "Those
          // creatures gain flying until end of turn" clause [81,126) —
          // verified by direct string-slice.
          annotations: [{ target: 'oracle', line: 1, start: 81, end: 96 }],
        },
        provenance: { origin: 'parser', rule: 'grantKeywordAll-effect-structural' },
      },
    ]);
  });

  it('accepts Esper Origins // Summon: Esper Maduin back face chapter III (notSelf, literal "Other creatures you control", combined pump+keyword)', () => {
    const result = recognizeGrantKeywordAllEffectStructural(
      structuralInput('Esper Origins // Summon: Esper Maduin', esperOriginsSummonEsperMaduin, 'back'),
    );
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts.find((f) => f.role === 'source')!.fact).toMatchObject({ event: 'grantKeyword', keyword: 'Trample', target: { excludeSelf: true } });
    expect(result.facts.find((f) => f.role === 'sink')!.fact).toMatchObject({ to: 'Battlefield', types: { has: ['Creature'] }, excludeSelf: true });
  });

  it('accepts Circle of Power (subtype Wizard, combined pump+keyword)', () => {
    const result = recognizeGrantKeywordAllEffectStructural(structuralInput('Circle of Power', circleOfPower));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts.find((f) => f.role === 'source')!.fact).toMatchObject({ event: 'grantKeyword', keyword: 'Lifelink', target: { types: { has: ['Creature', 'Wizard'] } } });
    expect(result.facts.find((f) => f.role === 'sink')!.fact).toMatchObject({ to: 'Battlefield', types: { has: ['Creature', 'Wizard'] } });
  });

  it("accepts Summon: Fat Chocobo (3 IDENTICAL chapters collapse to 1 fact, real 'until end of turn' bugfix applied)", () => {
    const result = recognizeGrantKeywordAllEffectStructural(structuralInput('Summon: Fat Chocobo', summonFatChocobo));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts.find((f) => f.role === 'source')!.fact).toMatchObject({ event: 'grantKeyword', keyword: 'Trample' });
    expect(result.facts.find((f) => f.role === 'sink')!.fact).toMatchObject({ to: 'Battlefield' });
  });

  it("accepts Moogles' Valor (mid-sentence, lowercase subject)", () => {
    const result = recognizeGrantKeywordAllEffectStructural(structuralInput("Moogles' Valor", mooglesValor));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts.find((f) => f.role === 'source')!.fact).toMatchObject({ event: 'grantKeyword', keyword: 'Indestructible' });
    expect(result.facts.find((f) => f.role === 'sink')!.fact).toMatchObject({ to: 'Battlefield' });
  });

  it('accepts The Wind Crystal (2 keywords, one shared clause)', () => {
    const result = recognizeGrantKeywordAllEffectStructural(structuralInput('The Wind Crystal', theWindCrystal));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(3);
    const sources = result.facts.filter((f) => f.role === 'source');
    expect(sources.map((f) => (f.fact as { keyword: string }).keyword).sort()).toEqual(['Flying', 'Lifelink']);
    expect(result.facts.filter((f) => f.role === 'sink')).toHaveLength(1);
  });

  it('accepts Restoration Magic Curaga mode (permanents-you-control, 2 keywords)', () => {
    const result = recognizeGrantKeywordAllEffectStructural(structuralInput('Restoration Magic', restorationMagic));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(3);
    const sources = result.facts.filter((f) => f.role === 'source');
    expect(sources).toHaveLength(2);
    for (const f of sources) expect(f.fact).toMatchObject({});
    expect(result.facts.filter((f) => f.role === 'sink')).toHaveLength(1);
  });

  it('declines Crystal Fragments // Summon: Alexander (DamagePrevention has no "gain" template)', () => {
    const result = recognizeGrantKeywordAllEffectStructural(
      structuralInput('Crystal Fragments // Summon: Alexander', crystalFragmentsSummonAlexander, 'back'),
    );
    expect(result.matched, `got: ${result.matched}`).toBe(false);
  });
});
