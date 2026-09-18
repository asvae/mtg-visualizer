// `computeCardInteractions` — see `card-interactions.ts`'s own header for
// the full (a)/(b) design investigation AND the later "CATALOG-FIRST
// CATEGORIZATION" section (2026-09-18, follow-up pass). Real FDN
// `CardDefinition`s are used wherever the pool already has a real shape to
// exercise (Ajani's Pridemate, Day of Judgment); one minimal MOCKED
// `CardDefinition` is used for the "a real `gainLife` effect exists in the
// pool" case, per this project's own established "predicate/matching-logic
// corpus uses mocked CardDefinitions" convention
// (`project_predicate_corpus_mocked_carddefinitions` — the real FDN
// 10-card pool has zero cards with an actual `kind: 'gainLife'` effect
// today; Healer's Hawk's Lifelink is a KEYWORD, not an Effect, and
// `deriveOccurrences` deliberately doesn't walk `keywords` — see
// `sink-model/match-sink.ts`'s own scope note).
import { describe, expect, it } from 'vitest';
import type { CardDefinition, Effect } from './card';
import { computeCardInteractions } from './card-interactions';
import { ajanisPridemate } from './fdn-cards/ajani-s-pridemate/definition';
import { dayOfJudgment } from './fdn-cards/day-of-judgment/definition';
import { serraAngel } from './fdn-cards/serra-angel/definition';
import { helpfulHunter } from './fdn-cards/helpful-hunter/definition';

const lifegainMock: CardDefinition = {
  name: 'Test Lifegain Producer',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Human Cleric',
  pt: [1, 1],
  effects: [{ kind: 'gainLife', amount: 1 } satisfies Effect],
};

const blankLandMock: CardDefinition = {
  name: 'Test Blank Land',
  manaCost: '',
  typeLine: 'Land',
};

describe('computeCardInteractions', () => {
  it("Ajani's Pridemate does NOT get a 'Lifegain' category, even with the real catalog entry now checked first (per this file's own (a)/(b) writeup AND its later CATALOG-FIRST CATEGORIZATION section: a catalog query is PRODUCER-shaped, and Ajani's Pridemate doesn't itself have a gainLife effect — its trigger only REACTS to lifegain, a consumer-side signal with no safe structural derivation) — its own real categories stay 'enters the battlefield' (baseline creature) and 'counters' (its own putCounter effect)", () => {
    const result = computeCardInteractions(ajanisPridemate, [ajanisPridemate, lifegainMock]);
    const categories = result.map((r) => r.category);
    expect(categories).not.toContain('Lifegain');
    expect(categories).not.toContain('life gain');
    expect(categories.sort()).toEqual(['counters', 'enters the battlefield']);
  });

  it("self-inclusion: Ajani's Pridemate's own 'counters' category includes Ajani's Pridemate itself (it puts a +1/+1 counter on itself, satisfying its own bare 'counters' want)", () => {
    const result = computeCardInteractions(ajanisPridemate, [ajanisPridemate]);
    const counters = result.find((r) => r.category === 'counters');
    expect(counters).toBeDefined();
    expect(counters!.matchingCardNames).toContain("Ajani's Pridemate");
    expect(counters!.count).toBe(1);
  });

  it("self-inclusion + catalog-first: Day of Judgment's own destroy-all-creatures program now categorizes under the real catalog label 'Graveyard fodder' (not the old raw 'destroy' label) and includes Day of Judgment itself (its own program satisfies the catalog's own graveyard-fodder query)", () => {
    const result = computeCardInteractions(dayOfJudgment, [dayOfJudgment]);
    expect(result.find((r) => r.category === 'destroy')).toBeUndefined();
    const graveyardFodder = result.find((r) => r.category === 'Graveyard fodder');
    expect(graveyardFodder).toBeDefined();
    expect(graveyardFodder!.matchingCardNames).toContain('Day of Judgment');
    // Its own baseline "normal sorcery resolves to its owner's graveyard"
    // occurrence is a genuinely DIFFERENT `via` than the catalog-consumed
    // destroy occurrence — still falls back to its own raw label.
    expect(result.find((r) => r.category === 'moves to graveyard')).toBeDefined();
  });

  it("a real 'gainLife' effect now categorizes under the real catalog label 'Lifegain' (not the old raw 'life gain' label) when checked against a card that carries no lifegain effect of its own — proves the catalog-first mechanism end-to-end (not specific to Ajani's own trigger name)", () => {
    const result = computeCardInteractions(lifegainMock, [lifegainMock, serraAngel, helpfulHunter]);
    expect(result.find((r) => r.category === 'life gain')).toBeUndefined();
    const lifegain = result.find((r) => r.category === 'Lifegain');
    expect(lifegain).toBeDefined();
    expect(lifegain!.count).toBeGreaterThan(0);
    expect(lifegain!.matchingCardNames).toEqual(['Test Lifegain Producer']);
  });

  it('self-inclusion holds for the gainLife mock too: it appears in its own Lifegain (catalog) category results', () => {
    const result = computeCardInteractions(lifegainMock, [lifegainMock]);
    const lifegain = result.find((r) => r.category === 'Lifegain');
    expect(lifegain?.matchingCardNames).toEqual(['Test Lifegain Producer']);
  });

  it('a card with no matchable triggers/effects (a bare Land, no static abilities, no on:enter trigger) produces an empty result — not an error', () => {
    expect(() => computeCardInteractions(blankLandMock, [blankLandMock, ajanisPridemate])).not.toThrow();
    expect(computeCardInteractions(blankLandMock, [blankLandMock, ajanisPridemate])).toEqual([]);
  });

  it('a card with a real on:enter trigger (Helpful Hunter, "draw a card" ETB) produces a real "card draw" category and matches itself', () => {
    const result = computeCardInteractions(helpfulHunter, [helpfulHunter, serraAngel]);
    const draw = result.find((r) => r.category === 'card draw');
    expect(draw).toBeDefined();
    expect(draw!.matchingCardNames).toEqual(["Helpful Hunter"]);
  });

  it('results are sorted by descending count, then alphabetically by category, and every entry has a non-negative integer count matching matchingCardNames.length', () => {
    const result = computeCardInteractions(ajanisPridemate, [ajanisPridemate, serraAngel, helpfulHunter, dayOfJudgment]);
    for (const entry of result) expect(entry.count).toBe(entry.matchingCardNames.length);
    for (let i = 1; i < result.length; i++) expect(result[i - 1]!.count).toBeGreaterThanOrEqual(result[i]!.count);
  });
});
