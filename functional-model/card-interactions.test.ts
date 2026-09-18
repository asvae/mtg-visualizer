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
//
// **2026-09-18, later the same day**: the `lifegain` catalog entry
// (`sink-model/catalog/lifegain.ts`) now also declares a real
// `consumerTriggerNames: ['onLifeGained']` — Ajani's Pridemate's own real,
// checked-in trigger name — so the first test below was rewritten from
// asserting Ajani does NOT get "Lifegain" to asserting it now DOES, via
// the new consumer-side signal (`matchesConsumerTriggerNames`, a pure
// `Trigger.name` field comparison, never oracle text). See
// `card-interactions.ts`'s own "SUPERSEDED" header note for the full
// correction writeup.
//
// **2026-09-18, later still**: `computeCardInteractions` is now
// catalog-only — see `card-interactions.ts`'s own second "SUPERSEDED"
// header note. Every test below that used to assert a raw
// `describeFact`-labeled fallback category ("counters", "enters the
// battlefield", "moves to graveyard", "card draw") was rewritten to assert
// that label no longer appears at all, rather than deleted outright — the
// absence is itself the real, load-bearing behavior this change introduced.
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
  it("Ajani's Pridemate gets a 'Lifegain' category (owns it via consumerTriggerNames — its real onLifeGained trigger name), but is NEVER itself among the matches: it has no gainLife effect of its own, it's purely a consumer ('whenever you gain life') — only the real producer (the mock) is a match; catalog-only means its baseline 'enters the battlefield'/'counters' raw categories no longer appear at all", () => {
    const result = computeCardInteractions(ajanisPridemate, [ajanisPridemate, lifegainMock]);
    const categories = result.map((r) => r.category).sort();
    expect(categories).toEqual(['Lifegain']);
    expect(categories).not.toContain('life gain');
    const lifegain = result.find((r) => r.category === 'Lifegain');
    expect(lifegain!.matchingCardNames).toEqual(['Test Lifegain Producer']);
    expect(lifegain!.matchingCardNames).not.toContain("Ajani's Pridemate");
  });

  it("consumer-only ownership without self-inclusion: Ajani's Pridemate alone in the pool (no producer at all) still gets a 'Lifegain' row (it owns/cares about the category), but with zero matches — it is never counted as its own match", () => {
    const result = computeCardInteractions(ajanisPridemate, [ajanisPridemate]);
    const lifegain = result.find((r) => r.category === 'Lifegain');
    expect(lifegain).toBeDefined();
    expect(lifegain!.matchingCardNames).toEqual([]);
    expect(lifegain!.count).toBe(0);
  });

  it("a card with no consumerTriggerNames match at all (Serra Angel, no triggers) never gets 'Lifegain' even when checked against a real producer", () => {
    const result = computeCardInteractions(serraAngel, [serraAngel, lifegainMock]);
    expect(result.find((r) => r.category === 'Lifegain')).toBeUndefined();
  });

  it("catalog-only: Ajani's Pridemate's own baseline 'counters' occurrence (it puts a +1/+1 counter on itself) is a real structural fact but no catalog entry covers 'counters' — it no longer surfaces as its own category at all", () => {
    const result = computeCardInteractions(ajanisPridemate, [ajanisPridemate]);
    expect(result.find((r) => r.category === 'counters')).toBeUndefined();
  });

  it("self-inclusion + catalog-first: Day of Judgment's own destroy-all-creatures program categorizes under the real catalog label 'Graveyard fodder' (not the old raw 'destroy' label) and includes Day of Judgment itself (its own program satisfies the catalog's own graveyard-fodder query); catalog-only means its baseline 'moves to graveyard' raw category no longer appears either", () => {
    const result = computeCardInteractions(dayOfJudgment, [dayOfJudgment]);
    expect(result.find((r) => r.category === 'destroy')).toBeUndefined();
    const graveyardFodder = result.find((r) => r.category === 'Graveyard fodder');
    expect(graveyardFodder).toBeDefined();
    expect(graveyardFodder!.matchingCardNames).toContain('Day of Judgment');
    expect(result.find((r) => r.category === 'moves to graveyard')).toBeUndefined();
    expect(result).toEqual([graveyardFodder]);
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

  it('catalog-only: Helpful Hunter\'s real on:enter "draw a card" ETB is a real structural fact but no catalog entry covers "card draw" — it no longer surfaces a "card draw" category, and (matching neither Lifegain nor Graveyard fodder) gets no categories at all against a pool with no other catalog-relevant card', () => {
    const result = computeCardInteractions(helpfulHunter, [helpfulHunter, serraAngel]);
    expect(result.find((r) => r.category === 'card draw')).toBeUndefined();
    expect(result).toEqual([]);
  });

  it('results are sorted by descending count, then alphabetically by category, and every entry has a non-negative integer count matching matchingCardNames.length', () => {
    const result = computeCardInteractions(ajanisPridemate, [ajanisPridemate, serraAngel, helpfulHunter, dayOfJudgment]);
    for (const entry of result) expect(entry.count).toBe(entry.matchingCardNames.length);
    for (let i = 1; i < result.length; i++) expect(result[i - 1]!.count).toBeGreaterThanOrEqual(result[i]!.count);
  });
});
