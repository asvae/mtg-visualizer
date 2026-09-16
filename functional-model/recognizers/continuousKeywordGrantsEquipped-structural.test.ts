// Verifies `continuousKeywordGrantsEquipped-structural.ts` against its two
// real clause shapes (`onlyDuringYourTurn` standalone sentence vs. a
// comma-joined list) and CantUntap's own fixed-sentence template
// (2026-09-16 widening — no longer a permanent decline).
import { describe, expect, it } from 'vitest';
import { dragoonsLance } from '../cards/dragoon-s-lance/definition';
import { paladinsArms } from '../cards/paladin-s-arms/definition';
import { sleepMagic } from '../cards/sleep-magic/definition';
import { bardsBow } from '../cards/bard-s-bow/definition';
import { genjiGlove } from '../cards/genji-glove/definition';
import { samuraisKatana } from '../cards/samurai-s-katana/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import {
  recognizeContinuousKeywordGrantsEquippedStructural,
  type ContinuousKeywordGrantsRecognizerInput,
} from './continuousKeywordGrantsEquipped-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): ContinuousKeywordGrantsRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, continuousKeywordGrants: def.continuousKeywordGrants };
}

describe('continuousKeywordGrantsEquipped-structural', () => {
  it("accepts Dragoon's Lance (onlyDuringYourTurn standalone sentence, Flying)", () => {
    const result = recognizeContinuousKeywordGrantsEquippedStructural(structuralInput("Dragoon's Lance", dragoonsLance));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'grantKeyword', keyword: 'Flying', target: { equippedBySelf: true } });
    expect(result.facts[0]!.provenance).toEqual({ origin: 'parser', rule: 'continuousKeywordGrantsEquipped-structural' });
    // 2026-09-16 widening: annotation covers the whole standalone sentence
    // (closes a real verify-text-coverage.mjs gap — "During your turn,
    // equipped creature has" was uncovered before this).
    const card = finCards.get("Dragoon's Lance")!;
    const ann = result.facts[0]!.fact.annotations![0]!;
    const line = card.front.oracleText.split('\n')[ann.line as number]!;
    expect(line.slice(ann.start as number, ann.end as number)).toBe('During your turn, equipped creature has flying');
  });

  it("accepts Paladin's Arms (comma-joined list, Ward with an untracked cost)", () => {
    const result = recognizeContinuousKeywordGrantsEquippedStructural(structuralInput("Paladin's Arms", paladinsArms));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'grantKeyword', keyword: 'Ward', target: { equippedBySelf: true } });
  });

  it('accepts Bard\'s Bow (comma-joined list, single keyword Reach)', () => {
    const result = recognizeContinuousKeywordGrantsEquippedStructural(structuralInput("Bard's Bow", bardsBow));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'grantKeyword', keyword: 'Reach', target: { equippedBySelf: true } });
  });

  it('accepts Genji Glove (single-keyword full sentence, DoubleStrike)', () => {
    const result = recognizeContinuousKeywordGrantsEquippedStructural(structuralInput('Genji Glove', genjiGlove));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'grantKeyword', keyword: 'DoubleStrike', target: { equippedBySelf: true } });
    // 2026-09-16 widening: annotation covers the whole sentence (closes a
    // real verify-text-coverage.mjs gap — "Equipped creature has" was
    // uncovered before this).
    const card = finCards.get('Genji Glove')!;
    const ann = result.facts[0]!.fact.annotations![0]!;
    const line = card.front.oracleText.split('\n')[ann.line as number]!;
    expect(line.slice(ann.start as number, ann.end as number)).toBe('Equipped creature has double strike');
  });

  it("accepts Samurai's Katana (2-keyword list, Trample and Haste)", () => {
    const result = recognizeContinuousKeywordGrantsEquippedStructural(structuralInput("Samurai's Katana", samuraisKatana));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    expect(result.facts.map((f) => (f.fact as { keyword: string }).keyword).sort()).toEqual(['Haste', 'Trample']);
  });

  it('accepts Sleep Magic (CantUntap\'s own real fixed-sentence template, "doesn\'t untap during its controller\'s untap step")', () => {
    const result = recognizeContinuousKeywordGrantsEquippedStructural(structuralInput('Sleep Magic', sleepMagic));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'grantKeyword', keyword: 'CantUntap', target: { equippedBySelf: true } });
  });
});
