// Verifies `putCounter-broadcast-structural.ts` against the 3 real pool
// cards its own module doc comment found (out of 18 real
// `actions.putCounter`-calling `kind:'custom'` effects checked), plus the
// real decline shapes (a chosen-target closure, no putCounter call at all).
//
// **2026-09-14 update**: all 3 of these real cards (Aerith Gainsborough's
// `onDies`, Dion/Bahamut's back-face chapter I+II, The Crystal's Chosen's
// own 2nd effect) were migrated off `kind:'custom'` onto the real
// `combinator.ts` typed-program AST (see each card's own `definition.ts`
// comment, and `saga-lore-and-sacrifice-structural.ts`'s own comment on the
// same migration's effect on ITS OWN opacity check). This recognizer only
// ever finds a `kind:'custom'` closure to probe (see its own module doc
// comment), so it correctly no longer matches any of these 3 real card
// EXPORTS post-migration — see the "no longer matches (migrated onto
// combinator.ts)" describe block at the bottom of this file. That's an
// accepted, expected consequence of the migration, not a recognizer bug — a
// `program` effect is now DIRECTLY structurally readable (`combinator.ts`'s
// own `walkProgram`), so probing it at runtime is no longer even the right
// tool; teaching a recognizer to read `kind:'program'` directly is real,
// valuable future work, not attempted here. The first 3 tests below keep
// testing `probeBroadcastPutCounter`'s own CLASSIFICATION logic (still real,
// still needed for genuinely-`custom` cases elsewhere in the pool) via a
// synthetic reconstruction of each real card's OWN original closure — the
// same real oracle text, the same real closure body these cards used to
// ship, just no longer sourced from the live `CardDefinition` export.
import { describe, expect, it } from 'vitest';
import { aerithGainsborough } from '../cards/aerith-gainsborough/definition';
import { dionBahamutsDominant } from '../cards/dion-bahamut-s-dominant-bahamut-warden-of-light/definition';
import { theCrystalsChosen } from '../cards/the-crystal-s-chosen/definition';
import { aerithRescueMission } from '../cards/aerith-rescue-mission/definition';
import type { CardDefinition, EffectContext, Actions } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizePutCounterBroadcastStructural, type StructuralRecognizerInput } from './putCounter-broadcast-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('putCounter-broadcast-structural — action-probe classification + verbatim text confirmation', () => {
  it('classifies Aerith Gainsborough\'s own PRE-migration `onDies` closure shape — "put X +1/+1 counters on each legendary creature you control" (probe classifies target.types.has:["Creature","Legendary"])', () => {
    const rawStructural = structuralInput('Aerith Gainsborough', aerithGainsborough);
    const input: StructuralRecognizerInput = {
      ...rawStructural,
      triggers: [
        {
          name: 'onDies',
          effects: [
            {
              kind: 'custom',
              describe: 'put X +1/+1 counters on each legendary creature you control',
              run: (ctx: EffectContext, actions: Actions) => {
                const x = ctx.self.getCounters('+1/+1');
                if (x <= 0) return;
                const legendaries = ctx.you.getCreaturesInPlay().filter((c) => c.hasSubtype('Legendary'));
                for (const creature of legendaries) actions.putCounter(creature, '+1/+1', x);
              },
            },
          ],
        },
      ],
    };
    const result = recognizePutCounterBroadcastStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'putCounter',
          counterType: '+1/+1',
          controller: 'you',
          target: { types: { has: ['Creature', 'Legendary'] } },
          targeted: false,
          annotations: [{ target: 'oracle', line: 2, start: 31, end: 90 }],
        },
        provenance: { origin: 'parser', rule: 'putCounter-broadcast-structural' },
      },
      {
        role: 'sink',
        // Narrowed 2026-09-16 (real user-reported bug: the sink used to
        // reuse the SOURCE's own whole-clause span [31,90) verbatim — this
        // sink's own real claim is only "a legendary creature you control
        // exists", i.e. just the trailing object phrase, not the verb).
        fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature', 'Legendary'] }, annotations: [{ target: 'oracle', line: 2, start: 55, end: 90 }] },
        provenance: { origin: 'parser', rule: 'putCounter-broadcast-structural' },
      },
    ]);
    // Real byproduct check — matches this card's own pre-existing
    // hand-authored source fact's annotation byte-for-byte.
    const lines = rawStructural.oracleText.split('\n');
    expect(lines[2]!.slice(31, 90)).toBe('put X +1/+1 counters on each legendary creature you control');
    // Real byproduct check — the sink's own narrower object-phrase span.
    expect(lines[2]!.slice(55, 90)).toBe('each legendary creature you control');
  });

  it('classifies Bahamut, Warden of Light (Dion\'s back face)\'s own PRE-migration chapter I+II closure shape — "Put a +1/+1 counter on each OTHER creature you control" (the "other" variant; chapterI+chapterII both match the SAME real clause, so the SAME pair is returned twice, deduped at the runner level)', () => {
    const rawStructural = structuralInput("Dion, Bahamut's Dominant // Bahamut, Warden of Light", dionBahamutsDominant.backFace!, 'back');
    const chapterEffect = {
      kind: 'custom' as const,
      describe: 'Wings of Light — put a +1/+1 counter on each other creature you control',
      run: (ctx: EffectContext, actions: Actions) => {
        for (const creature of ctx.you.getCreaturesInPlay().filter((c) => c.getId() !== ctx.self.getId())) actions.putCounter(creature, '+1/+1', 1);
      },
    };
    const input: StructuralRecognizerInput = {
      ...rawStructural,
      triggers: [
        { name: 'chapterI', effects: [chapterEffect] },
        { name: 'chapterII', effects: [chapterEffect] },
      ],
    };
    const result = recognizePutCounterBroadcastStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(4);
    expect(result.facts[0]).toEqual(result.facts[2]);
    expect(result.facts[1]).toEqual(result.facts[3]);
    expect(result.facts[0]).toEqual({
      role: 'source',
      fact: {
        event: 'putCounter',
        counterType: '+1/+1',
        controller: 'you',
        target: { types: { has: ['Creature'] } },
        targeted: false,
        annotations: [{ target: 'oracle', line: 1, start: 25, end: 79 }],
      },
      provenance: { origin: 'parser', rule: 'putCounter-broadcast-structural' },
    });
    // Narrowed 2026-09-16 (same real sink over-selection bug Aerith
    // Gainsborough surfaced) — sink anchors to just "each other creature you
    // control" (chars [48,79)), not the whole [25,79) verb clause.
    expect(result.facts[1]).toEqual({
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, annotations: [{ target: 'oracle', line: 1, start: 48, end: 79 }] },
      provenance: { origin: 'parser', rule: 'putCounter-broadcast-structural' },
    });
    const lines = rawStructural.oracleText.split('\n');
    expect(lines[1]!.slice(48, 79)).toBe('each other creature you control');
  });

  it('classifies The Crystal\'s Chosen\'s own PRE-migration 2nd-effect closure shape — "put a +1/+1 counter on each creature you control" (the plain, non-"other" variant — no self on the battlefield to exclude in the first place; a Sorcery)', () => {
    const rawStructural = structuralInput("The Crystal's Chosen", theCrystalsChosen);
    const input: StructuralRecognizerInput = {
      ...rawStructural,
      effects: [
        rawStructural.effects![0]!,
        {
          kind: 'custom',
          describe: 'put a +1/+1 counter on each creature you control',
          run: (ctx: EffectContext, actions: Actions) => {
            for (const creature of ctx.you.getCreaturesInPlay()) actions.putCounter(creature, '+1/+1', 1);
          },
        },
      ],
    };
    const result = recognizePutCounterBroadcastStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'putCounter', counterType: '+1/+1', controller: 'you', target: { types: { has: ['Creature'] } }, targeted: false });
    expect(result.facts[1]!.fact).toMatchObject({ to: 'Battlefield', controller: 'you', types: { has: ['Creature'] } });
    // Narrowed 2026-09-16 (same real sink over-selection bug Aerith
    // Gainsborough surfaced) — sink anchors to just "each creature you
    // control" (chars [76,101)), not the whole [53,101) verb clause.
    expect(result.facts[1]!.fact.annotations).toEqual([{ target: 'oracle', line: 0, start: 76, end: 101 }]);
    const lines = rawStructural.oracleText.split('\n');
    expect(lines[0]!.slice(76, 101)).toBe('each creature you control');
  });

  it('declines Aerith Rescue Mission — its own real closure calls `actions.chooseTarget` before `putCounter` (a chosen-target shape, out of the probe\'s own scope) — matches today\'s existing hand-authored data (this specific fact stays agent-derived, not this recognizer\'s concern)', () => {
    const result = recognizePutCounterBroadcastStructural(structuralInput('Aerith Rescue Mission', aerithRescueMission));
    expect(result.matched).toBe(false);
  });

  it('declines a card with no kind:"custom" effect at all on this face', () => {
    const result = recognizePutCounterBroadcastStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '', effects: undefined, triggers: undefined, abilities: undefined } as unknown as StructuralRecognizerInput);
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no kind:"custom"') });
  });

  it('declines a synthetic custom effect whose closure never calls actions.putCounter at all', () => {
    const input: StructuralRecognizerInput = {
      name: 'Fake Card',
      typeLine: 'Creature',
      oracleText: 'Fake Card draws a card.',
      effects: [{ kind: 'custom', describe: 'draw a card', run: (_ctx: unknown, actions: { chooseTarget?: unknown; putCounter?: unknown } | Record<string, unknown>) => undefined }] as unknown as StructuralRecognizerInput['effects'],
    };
    const result = recognizePutCounterBroadcastStructural(input);
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no custom effect on this face was classified') });
  });
});

describe('putCounter-broadcast-structural — no longer matches (migrated onto combinator.ts, 2026-09-14)', () => {
  it('Aerith Gainsborough\'s own REAL, current export declines — its `onDies` effect is now `kind:"program"`, not `kind:"custom"`', () => {
    const result = recognizePutCounterBroadcastStructural(structuralInput('Aerith Gainsborough', aerithGainsborough));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no kind:"custom"') });
  });

  it('Bahamut, Warden of Light (Dion\'s back face)\'s own REAL, current export declines — its chapter I+II effects are now `kind:"program"`', () => {
    const result = recognizePutCounterBroadcastStructural(structuralInput("Dion, Bahamut's Dominant // Bahamut, Warden of Light", dionBahamutsDominant.backFace!, 'back'));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no kind:"custom"') });
  });

  it('The Crystal\'s Chosen\'s own REAL, current export declines — its 2nd effect is now `kind:"program"`', () => {
    const result = recognizePutCounterBroadcastStructural(structuralInput("The Crystal's Chosen", theCrystalsChosen));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no kind:"custom"') });
  });
});
