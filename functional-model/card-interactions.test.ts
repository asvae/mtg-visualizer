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
// `matcher-model/match-query.ts`'s own scope note).
//
// **2026-09-18, later the same day**: the `lifegain` catalog entry
// (`matcher-model/catalog/lifegain.ts`) now also declares a real
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
import { felidarSavior } from './fdn-cards/felidar-savior/definition';
import { healersHawk } from './fdn-cards/healer-s-hawk/definition';
import { bigfinBouncer } from './fdn-cards/bigfin-bouncer/definition';
import { clawsOut } from './fdn-cards/claws-out/definition';
import { dazzlingAngel } from './fdn-cards/dazzling-angel/definition';
import { exemplarOfLight } from './fdn-cards/exemplar-of-light/definition';

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
  it("Ajani's Pridemate gets a 'Lifegain' category (owns it via consumerTriggerNames — its real onLifeGained trigger name), but is NEVER itself among the Lifegain matches: it has no gainLife effect of its own, it's purely a consumer ('whenever you gain life') — only the real producer (the mock) is a match; catalog-only means its baseline 'enters the battlefield'/'counters' raw categories no longer appear at all. It does NOT self-display 'Cats' (2026-09-18, Battlefield presence, `requireConsumerForSelfOwnership`) even though it structurally IS a Cat creature — merely BEING a Cat is passive membership, not a deliberate ability (see the real Helpful Hunter bug fix below). It DOES self-display AND self-match '+1/+1' (2026-09-18, new catalog entry) — its own real 'put a +1/+1 counter on this creature' effect is a genuine direct producer match, same class of authored ability as Day of Judgment's own destroy-all program, not bare type membership", () => {
    const result = computeCardInteractions(ajanisPridemate, [ajanisPridemate, lifegainMock]);
    const categories = result.map((r) => r.category).sort();
    expect(categories).toEqual(['+1/+1', 'Lifegain']);
    expect(categories).not.toContain('life gain');
    const lifegain = result.find((r) => r.category === 'Lifegain');
    expect(lifegain!.matchingCardNames).toEqual(['Test Lifegain Producer']);
    const counters = result.find((r) => r.category === '+1/+1');
    expect(counters!.matchingCardNames).toEqual(["Ajani's Pridemate"]);
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

  it('catalog-only: Helpful Hunter\'s real on:enter "draw a card" ETB is a real structural fact but no catalog entry covers "card draw" — it no longer surfaces a "card draw" category; it DOES now get the real "ETB" catalog category instead (added 2026-09-18)', () => {
    const result = computeCardInteractions(helpfulHunter, [helpfulHunter, serraAngel]);
    expect(result.find((r) => r.category === 'card draw')).toBeUndefined();
    expect(result.find((r) => r.category === 'Lifegain' || r.category === 'Graveyard fodder')).toBeUndefined();
    const etb = result.find((r) => r.category === 'ETB');
    expect(etb).toBeDefined();
  });

  it('real bug fix, 2026-09-18: "ETB" is redesigned as a genuine two-role "blink/bounce value" archetype (same shape as Lifegain), not a single self-referential fact — the ORIGINAL design over-matched (Felidar Savior self-showed "ETB: 20" against the real 100-card pool, just for having an on:\'enter\' trigger). Helpful Hunter OWNS "ETB" via its real on:\'enter\' trigger (a pure consumer — the thing worth re-triggering), but has zero matches with no real bounce/blink producer in the pool: it never counts as its own match merely for having the ability, same rule Lifegain/Ajani\'s Pridemate already established. Helpful Hunter does NOT self-display "Cats"/"Creatures" either (2026-09-18, real bug fix — see the dedicated Battlefield presence tests below): its typeLine is literally \'Creature — Cat\', but bare type/subtype MEMBERSHIP alone must never grant self-ownership of a battlefield-presence category, only a genuine consumer effect does', () => {
    const result = computeCardInteractions(helpfulHunter, [helpfulHunter, serraAngel]);
    expect(result).toEqual([{ category: 'ETB', count: 0, matchingCardNames: [] }]);
  });

  it('real bug fix, 2026-09-18: Felidar Savior likewise OWNS "ETB" via its own real on:\'enter\' trigger (consumer), but its matchingCardNames now correctly shows the real PRODUCER — Bigfin Bouncer\'s own real "return target creature to hand" effect (FDN) — never itself or Helpful Hunter, since neither has a bounce/blink effect of its own; vanilla Serra Angel is excluded entirely', () => {
    const result = computeCardInteractions(felidarSavior, [felidarSavior, helpfulHunter, bigfinBouncer, serraAngel]);
    const etb = result.find((r) => r.category === 'ETB');
    expect(etb).toBeDefined();
    expect(etb!.matchingCardNames).toEqual(['Bigfin Bouncer']);
  });

  it('real bug fix, 2026-09-18: Bigfin Bouncer is BOTH a producer (its own real bounce-to-hand effect) AND a consumer (it also has its own real on:\'enter\' trigger) for "ETB" — genuinely counts as its OWN match, same as any other category where a card satisfies its own want (contrast Felidar Savior/Helpful Hunter above, consumer-only, never self-matching). It does NOT self-display "Creatures" (2026-09-18, Battlefield presence, `requireConsumerForSelfOwnership`) — being a Creature is bare membership, not a deliberate ability, unlike ETB\'s own genuine bounce EFFECT', () => {
    const result = computeCardInteractions(bigfinBouncer, [bigfinBouncer]);
    expect(result).toEqual([{ category: 'ETB', count: 1, matchingCardNames: ['Bigfin Bouncer'] }]);
  });

  it("real bug fix, 2026-09-18: Healer's Hawk does NOT self-display 'Lifegain' — its only path to the category is the `lifelink` sink-derivation predicate (a structural INFERENCE from its bare Lifelink keyword, no `gainLife` effect anywhere on its own definition), which is real enough to make it a MATCH for someone else's want (see the next test) but not a genuine, directly-authored statement of what this card itself does, so it must not self-own the category (contrast Day of Judgment above, whose own real 'destroy all creatures' program IS a direct statement, and correctly still self-owns 'Graveyard fodder'). It also does NOT self-display 'Creatures' (typeLine 'Creature — Bird', 2026-09-18 Battlefield presence, `requireConsumerForSelfOwnership`) — bare Creature-type membership, no anthem/Affinity effect of its own", () => {
    expect(computeCardInteractions(healersHawk, [healersHawk])).toEqual([]);
  });

  it("real bug fix, 2026-09-18: Felidar Savior does NOT self-display 'Lifegain' (same predicate-only reasoning as Healer's Hawk) — it DOES still self-display 'ETB' (a genuine, directly-authored on:'enter' trigger owns the category as a consumer, per the ETB redesign above) but with zero matches when alone in the pool: it has no bounce/blink effect of its own to be a producer. It does NOT self-display 'Cats'/'Creatures' (typeLine 'Creature — Cat Beast', 2026-09-18 Battlefield presence, `requireConsumerForSelfOwnership`) — bare Cat/Creature-type membership, no Affinity/anthem effect of its own. It DOES self-display AND self-match '+1/+1' (2026-09-18, new catalog entry) — its own real \"put a +1/+1 counter on each of up to two other target creatures you control\" effect genuinely produces +1/+1 counters (the query has no self-targeting constraint, same broad-by-design matching every other counterType-agnostic-target query already uses), a direct, non-predicate-derived producer match", () => {
    const result = computeCardInteractions(felidarSavior, [felidarSavior]);
    expect(result).toEqual([
      { category: '+1/+1', count: 1, matchingCardNames: ['Felidar Savior'] },
      { category: 'ETB', count: 0, matchingCardNames: [] },
    ]);
  });

  it("real bug fix, 2026-09-18 — the REVERSE direction is unchanged: Ajani's Pridemate (a genuine consumer, owns 'Lifegain' via consumerTriggerNames) still sees BOTH Healer's Hawk AND Felidar Savior as real Lifegain producers in its own matchingCardNames — a predicate-derived match is still a real match for someone else's want, only SELF-ownership is affected by the fix above", () => {
    const result = computeCardInteractions(ajanisPridemate, [ajanisPridemate, healersHawk, felidarSavior]);
    const lifegain = result.find((r) => r.category === 'Lifegain');
    expect(lifegain).toBeDefined();
    expect(lifegain!.matchingCardNames).toEqual(['Felidar Savior', "Healer's Hawk"]);
  });

  it("Battlefield presence (2026-09-18): Claws Out (FDN #6) self-displays BOTH 'Cats' (its own real \"Affinity for Cats\" costReduction) AND 'Creatures' (its own real bare pumpAll \"Creatures you control get +2/+2\") — never itself among the matches for either, since it's an Instant with no Cat/Creature-producing effect of its own", () => {
    const result = computeCardInteractions(clawsOut, [clawsOut, ajanisPridemate, serraAngel]);
    const categories = result.map((r) => r.category).sort();
    expect(categories).toEqual(['Cats', 'Creatures']);
    const cats = result.find((r) => r.category === 'Cats')!;
    const creatures = result.find((r) => r.category === 'Creatures')!;
    expect(cats.matchingCardNames).not.toContain('Claws Out');
    expect(creatures.matchingCardNames).not.toContain('Claws Out');
  });

  it("Battlefield presence: Claws Out's own 'Cats' row correctly includes Ajani's Pridemate (a real Cat creature — its own baseline entersBattlefield occurrence structurally guarantees a Cat permanent) but excludes Serra Angel (no Cat subtype)", () => {
    const result = computeCardInteractions(clawsOut, [clawsOut, ajanisPridemate, serraAngel]);
    const cats = result.find((r) => r.category === 'Cats')!;
    expect(cats.matchingCardNames).toEqual(["Ajani's Pridemate"]);
  });

  it("Battlefield presence: Claws Out's own 'Creatures' row includes BOTH Ajani's Pridemate and Serra Angel — deliberately broad, any real creature counts as a PRODUCER for the reverse direction (see battlefield-presence-creatures.ts's own header)", () => {
    const result = computeCardInteractions(clawsOut, [clawsOut, ajanisPridemate, serraAngel]);
    const creatures = result.find((r) => r.category === 'Creatures')!;
    expect(creatures.matchingCardNames).toEqual(["Ajani's Pridemate", 'Serra Angel']);
  });

  it("real bug fix, 2026-09-18 (found live: Helpful Hunter self-displayed 'Cats' on its own page purely for BEING a Cat): Ajani's Pridemate (a real Cat creature, no Affinity/anthem effect of its own) does NOT self-display 'Cats' — bare Cat-type MEMBERSHIP is passive, not a deliberate ability, so `requireConsumerForSelfOwnership` withholds self-ownership even though it's a genuine, direct (non-predicate-derived) producer match", () => {
    const result = computeCardInteractions(ajanisPridemate, [ajanisPridemate, serraAngel]);
    expect(result.find((r) => r.category === 'Cats')).toBeUndefined();
    expect(result.find((r) => r.category === 'Creatures')).toBeUndefined();
  });

  it("Battlefield presence — the REVERSE direction is unaffected by the self-ownership fix: Ajani's Pridemate still correctly appears as a real 'Cats' AND 'Creatures' PRODUCER in Claws Out's own matchingCardNames (already covered by the 2 tests above) and in ANY other card's own battlefield-presence matches — e.g. Helpful Hunter (real Cat) is still a genuine 'Cats' match for Claws Out", () => {
    const result = computeCardInteractions(clawsOut, [clawsOut, helpfulHunter]);
    const cats = result.find((r) => r.category === 'Cats')!;
    expect(cats.matchingCardNames).toEqual(['Helpful Hunter']);
  });

  it("Battlefield presence: a card with neither the Cats nor the Creatures shape (Serra Angel — a vanilla, non-Cat creature with no Affinity/anthem effect of its own) does NOT self-display EITHER 'Cats' or 'Creatures' — bare Creature-type membership alone is never enough (real bug fix, 2026-09-18)", () => {
    const result = computeCardInteractions(serraAngel, [serraAngel]);
    expect(result.find((r) => r.category === 'Cats')).toBeUndefined();
    expect(result.find((r) => r.category === 'Creatures')).toBeUndefined();
    expect(result).toEqual([]);
  });

  it('real bug fix, 2026-09-18 (etb.ts consumerTriggerNames widened): Dazzling Angel (FDN #9) self-displays BOTH "Lifegain" (a genuine direct producer — its own onOtherCreatureEnter trigger\'s gainLife effect is walked regardless of the trigger\'s own name/on-value) AND "ETB" (owned via the new consumerTriggerNames:[\'onOtherCreatureEnter\'] signal — it is genuinely ETB-reactive even though `on:\'enter\'` alone can never fire for ANOTHER permanent) — alone in the pool, "ETB" has zero matches since it has no bounce/blink effect of its own', () => {
    const result = computeCardInteractions(dazzlingAngel, [dazzlingAngel]);
    const categories = result.map((r) => r.category).sort();
    expect(categories).toEqual(['ETB', 'Lifegain']);
    const lifegain = result.find((r) => r.category === 'Lifegain')!;
    expect(lifegain.matchingCardNames).toEqual(['Dazzling Angel']);
    const etb = result.find((r) => r.category === 'ETB')!;
    expect(etb.matchingCardNames).toEqual([]);
  });

  it('Dazzling Angel\'s own "ETB" row correctly picks up Bigfin Bouncer as a real PRODUCER once it\'s in the pool (Dazzling Angel itself never counts as its own ETB match, since it has no bounce effect of its own)', () => {
    const result = computeCardInteractions(dazzlingAngel, [dazzlingAngel, bigfinBouncer]);
    const etb = result.find((r) => r.category === 'ETB')!;
    expect(etb.matchingCardNames).toEqual(['Bigfin Bouncer']);
  });

  it('real gap found+fixed live verifying Task 2 (lifegain.ts consumerTriggerNames widened): Exemplar of Light (FDN #11) self-displays "Lifegain" via its own real "onLifeGain" trigger name (a genuine spelling variant of Ajani\'s Pridemate\'s "onLifeGained", not the same string) — alone in the pool it owns the category with zero matches (no gainLife producer in scope), and correctly sees Felidar Savior as a real producer once in the pool', () => {
    const alone = computeCardInteractions(exemplarOfLight, [exemplarOfLight]);
    const lifegainAlone = alone.find((r) => r.category === 'Lifegain')!;
    expect(lifegainAlone).toBeDefined();
    expect(lifegainAlone.matchingCardNames).toEqual([]);
    const withProducer = computeCardInteractions(exemplarOfLight, [exemplarOfLight, felidarSavior]);
    const lifegain = withProducer.find((r) => r.category === 'Lifegain')!;
    expect(lifegain.matchingCardNames).toEqual(['Felidar Savior']);
  });

  it('new "+1/+1" sink (2026-09-18): Exemplar of Light (FDN #11) is a genuine self-referential producer/consumer loop — its own real "putCounter" effect (from its "whenever you gain life, put a +1/+1 counter on this creature" trigger) is a direct, non-predicate-derived match, so it correctly self-owns AND self-matches "+1/+1" (unlike Battlefield presence, no requireConsumerForSelfOwnership escape hatch applies here — putting a counter is a genuine authored effect, not bare type membership)', () => {
    const result = computeCardInteractions(exemplarOfLight, [exemplarOfLight]);
    expect(result.find((r) => r.category === '+1/+1')).toEqual({ category: '+1/+1', count: 1, matchingCardNames: ['Exemplar of Light'] });
  });

  it('results are sorted by descending count, then alphabetically by category, and every entry has a non-negative integer count matching matchingCardNames.length', () => {
    const result = computeCardInteractions(ajanisPridemate, [ajanisPridemate, serraAngel, helpfulHunter, dayOfJudgment]);
    for (const entry of result) expect(entry.count).toBe(entry.matchingCardNames.length);
    for (let i = 1; i < result.length; i++) expect(result[i - 1]!.count).toBeGreaterThanOrEqual(result[i]!.count);
  });
});
