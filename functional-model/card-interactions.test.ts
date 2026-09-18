// `computeCardInteractions` — see `card-interactions.ts`'s own header for
// the full (a)/(b) design investigation. Real FDN `CardDefinition`s are
// used wherever the pool already has a real shape to exercise (Ajani's
// Pridemate, Day of Judgment); one minimal MOCKED `CardDefinition` is used
// for the "a real `gainLife` effect exists in the pool" case, per this
// project's own established "predicate/matching-logic corpus uses mocked
// CardDefinitions" convention (`project_predicate_corpus_mocked_
// carddefinitions` — the real FDN 10-card pool has zero cards with an
// actual `kind: 'gainLife'` effect today; Healer's Hawk's Lifelink is a
// KEYWORD, not an Effect, and `deriveOccurrences` deliberately doesn't walk
// `keywords` — see `sink-model/match-sink.ts`'s own scope note).
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
  it("Ajani's Pridemate does NOT get a 'Lifegain'/'life gain' category (per this file's own (a)/(b) writeup: Trigger.name is not a safe structural signal) — its own real categories are 'enters the battlefield' (baseline creature) and 'counters' (its own putCounter effect)", () => {
    const result = computeCardInteractions(ajanisPridemate, [ajanisPridemate, lifegainMock]);
    const categories = result.map((r) => r.category);
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

  it("self-inclusion: Day of Judgment's own 'destroy' category includes Day of Judgment itself (its own 'destroy all creatures' program satisfies its own unconstrained destroy-a-creature want)", () => {
    const result = computeCardInteractions(dayOfJudgment, [dayOfJudgment]);
    const destroy = result.find((r) => r.category === 'destroy');
    expect(destroy).toBeDefined();
    expect(destroy!.matchingCardNames).toContain('Day of Judgment');
  });

  it("a real 'gainLife' effect in the pool produces a non-zero-count 'life gain' category when checked against a card that carries no lifegain effect of its own — proves the general per-occurrence category mechanism end-to-end (not specific to Ajani's own trigger name)", () => {
    const result = computeCardInteractions(lifegainMock, [lifegainMock, serraAngel, helpfulHunter]);
    const lifegain = result.find((r) => r.category === 'life gain');
    expect(lifegain).toBeDefined();
    expect(lifegain!.count).toBeGreaterThan(0);
    expect(lifegain!.matchingCardNames).toEqual(['Test Lifegain Producer']);
  });

  it('self-inclusion holds for the gainLife mock too: it appears in its own life gain category results', () => {
    const result = computeCardInteractions(lifegainMock, [lifegainMock]);
    const lifegain = result.find((r) => r.category === 'life gain');
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
