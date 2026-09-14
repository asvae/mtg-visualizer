// Verifies `putCounterSelf-effect-structural.ts` against real cards from
// each bucket named in that file's own module doc comment: matched real
// clauses (own printed name, short name, and permanent-supertype self
// references, plus a genuine `Computed<number>` amount that still matches on
// text alone), and the 4 real mismatch declines (each suppressed via its own
// `// recognizer-exception:` marker, checked here only for the RAW
// recognizer verdict — the exception suppression itself is
// `apply-recognizers.mjs`'s own concern, not this recognizer's).
import { describe, expect, it } from 'vitest';
import { aerithGainsborough } from '../cards/aerith-gainsborough/definition';
import { blazingBomb } from '../cards/blazing-bomb/definition';
import { demonWall } from '../cards/demon-wall/definition';
import { judgeMagisterGabranth } from '../cards/judge-magister-gabranth/definition';
import { excaliburIi } from '../cards/excalibur-ii/definition';
import { quinaQuGourmet } from '../cards/quina-qu-gourmet/definition';
import { sephirothPlanetsHeir } from '../cards/sephiroth-planet-s-heir/definition';
import { sahagin } from '../cards/sahagin/definition';
import { zodiarkUmbralGod } from '../cards/zodiark-umbral-god/definition';
import { sazhSChocobo } from '../cards/sazh-s-chocobo/definition';
import { seymourFlux } from '../cards/seymour-flux/definition';
import { tidusBlitzballStar } from '../cards/tidus-blitzball-star/definition';
import { ultrosObnoxiousOctopus } from '../cards/ultros-obnoxious-octopus/definition';
import { vincentValentine } from '../cards/vincent-valentine-galian-beast/definition';
import { viviOrnitier } from '../cards/vivi-ornitier/definition';
import { phantomTrain } from '../cards/phantom-train/definition';
import { relentlessXAtm092 } from '../cards/relentless-x-atm092/definition';
import { tonberry } from '../cards/tonberry/definition';
import { zackFair } from '../cards/zack-fair/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizePutCounterSelfEffectStructural, type StructuralRecognizerInput } from './putCounterSelf-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  const ownName = scryfallName.includes(' // ') ? scryfallName.split(' // ')[face === 'back' ? 1 : 0]!.trim() : def.name;
  return { name: ownName, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('putCounterSelf-effect-structural — real matched clauses', () => {
  it('accepts Aerith Gainsborough — "put a +1/+1 counter on Aerith Gainsborough" (own full printed name)', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Aerith Gainsborough', aerithGainsborough));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'putCounter', counterType: '+1/+1', target: 'self', annotations: [{ target: 'oracle', line: expect.any(Number), start: expect.any(Number), end: expect.any(Number) }] },
        provenance: { origin: 'parser', rule: 'putCounterSelf-effect-structural' },
      },
    ]);
    const { line, start, end } = result.facts[0]!.fact.annotations![0] as { line: number; start: number; end: number };
    const input = structuralInput('Aerith Gainsborough', aerithGainsborough);
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe('put a +1/+1 counter on Aerith Gainsborough');
  });

  it('accepts Blazing Bomb — "put a +1/+1 counter on this creature" (permanent-supertype self reference)', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Blazing Bomb', blazingBomb));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'putCounter', counterType: '+1/+1', target: 'self' });
  });

  it('accepts Demon Wall — "Put two +1/+1 counters on this creature" (literal quantity word never anchored)', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Demon Wall', demonWall));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'putCounter', counterType: '+1/+1', target: 'self' });
  });

  it('accepts Judge Magister Gabranth — own full printed name', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Judge Magister Gabranth', judgeMagisterGabranth));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Excalibur II — "put a charge counter on Excalibur II" (counterType \'CHARGE\' matched case-insensitively)', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Excalibur II', excaliburIi));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'putCounter', counterType: 'CHARGE', target: 'self' });
  });

  it('accepts Quina, Qu Gourmet — "put a +1/+1 counter on Quina" (short name before the first comma)', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Quina, Qu Gourmet', quinaQuGourmet));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it("accepts Sephiroth, Planet's Heir — short name", () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput("Sephiroth, Planet's Heir", sephirothPlanetsHeir));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Sahagin — "this creature"', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Sahagin', sahagin));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Zodiark, Umbral God — short name', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Zodiark, Umbral God', zodiarkUmbralGod));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it("accepts Sazh's Chocobo — \"this creature\" (own printed name has an apostrophe, not a comma, so only the type-word alternation matches)", () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput("Sazh's Chocobo", sazhSChocobo));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Seymour Flux — own full printed name', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Seymour Flux', seymourFlux));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Tidus, Blitzball Star — short name', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Tidus, Blitzball Star', tidusBlitzballStar));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('accepts Ultros, Obnoxious Octopus — "put eight +1/+1 counters on Ultros" (a DIFFERENT, chosen-target "stun" clause earlier in this same card\'s own text never confuses this recognizer)', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Ultros, Obnoxious Octopus', ultrosObnoxiousOctopus));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'putCounter', counterType: '+1/+1', target: 'self' });
  });

  it('accepts Vincent Valentine (front face) — "put a number of +1/+1 counters on Vincent Valentine equal to that creature\'s power" (a genuine Computed<number> amount still matches on TEXT alone, since this Fact carries no magnitude)', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Vincent Valentine // Galian Beast', vincentValentine, 'front'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'putCounter', counterType: '+1/+1', target: 'self' });
  });

  it('accepts Vivi Ornitier — own full printed name', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Vivi Ornitier', viviOrnitier));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });
});

describe('putCounterSelf-effect-structural — structural scope decline', () => {
  it('declines a card with no self-target putCounter effect at all', () => {
    const result = recognizePutCounterSelfEffectStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '' } as CardDefinition as unknown as StructuralRecognizerInput);
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no kind:"putCounter"') });
  });

  it('declines a synthetic putCounter effect with a non-positive literal amount (a REMOVAL, not an addition)', () => {
    const input: StructuralRecognizerInput = {
      name: 'Fake Card',
      typeLine: 'Creature — Human',
      oracleText: 'Remove a stun counter from this creature.',
      effects: [{ kind: 'putCounter', target: 'self', counterType: 'stun', amount: -1 }] as unknown as StructuralRecognizerInput['effects'],
    };
    const result = recognizePutCounterSelfEffectStructural(input);
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('structurally out of scope') });
  });
});

describe("putCounterSelf-effect-structural — real, confirmed MISMATCH declines (all 4 carry a `// recognizer-exception:` marker, checked separately by apply-recognizers.mjs)", () => {
  it('declines (mismatch) Phantom Train — real text self-references via its own printed SUBTYPE ("this Vehicle"), not this card\'s name nor a vetted permanent-supertype word', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Phantom Train', phantomTrain));
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.kind).toBe('mismatch');
  });

  it('declines (mismatch) Relentless X-ATM092 — real text is "...with a finality counter on it," never the verb "put"', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Relentless X-ATM092', relentlessXAtm092));
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.kind).toBe('mismatch');
  });

  it('declines (mismatch) Tonberry — real text is "enters tapped with a stun counter on it," never the verb "put"', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Tonberry', tonberry));
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.kind).toBe('mismatch');
  });

  it('declines (mismatch) Zack Fair — real text is "enters with a +1/+1 counter on it," never the verb "put" for THIS counter (a later, unrelated "Put Zack Fair\'s counters on that creature" sentence never falsely matches either)', () => {
    const result = recognizePutCounterSelfEffectStructural(structuralInput('Zack Fair', zackFair));
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.kind).toBe('mismatch');
  });
});
