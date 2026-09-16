// Verifies `sacrifice-effect-structural.ts` against the real matches/
// declines its own module doc comment names.
import { describe, expect, it } from 'vitest';
import { ahriman } from '../cards/ahriman/definition';
import { phantomTrain } from '../cards/phantom-train/definition';
import { namazuTrader } from '../cards/namazu-trader/definition';
import { renoAndRude } from '../cards/reno-and-rude/definition';
import { midgarCityOfMako } from '../cards/midgar-city-of-mako-reactor-raid/definition';
import { vaynesTreachery } from '../cards/vayne-s-treachery/definition';
import { sidequestHuntTheMark } from '../cards/sidequest-hunt-the-mark-yiazmat-ultimate-mark/definition';
import { sephirothFabledSoldier } from '../cards/sephiroth-fabled-soldier-sephiroth-one-winged-angel/definition';
import { sleepMagic } from '../cards/sleep-magic/definition';
import { louisoixsSacrifice } from '../cards/louisoix-s-sacrifice/definition';
import { quinaQuGourmet } from '../cards/quina-qu-gourmet/definition';
import { corneredByBlackMages } from '../cards/cornered-by-black-mages/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeSacrificeEffectStructural, type StructuralRecognizerInput } from './sacrifice-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('sacrifice-effect-structural — TEMPLATE 1 ("Sacrifice a/an/another <type>[ or <type2>]")', () => {
  it('accepts Ahriman — notSelf:true, creature-or-artifact ("creature or artifact" order), cost-embedded; 2026-09-16 SOURCE/SINK split fix: sink narrows to "another creature or artifact," not the whole "Sacrifice another creature or artifact" clause', () => {
    const result = recognizeSacrificeEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 1): "{3}, Sacrifice another creature or artifact:
    // Draw a card." — [5,43)="Sacrifice another creature or artifact"
    // (source), [15,43)="another creature or artifact" (sink) — verified
    // by direct string-slice.
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'sacrifice',
          from: 'Battlefield',
          to: 'Graveyard',
          controller: 'you',
          target: { types: { hasAny: ['Creature', 'Artifact'] }, excludeSelf: true },
          targeted: true,
          annotations: [{ target: 'oracle', line: 1, start: 5, end: 43 }],
        },
        provenance: { origin: 'parser', rule: 'sacrifice-effect-structural' },
      },
      {
        role: 'sink',
        fact: {
          to: 'Battlefield',
          controller: 'you',
          types: { hasAny: ['Creature', 'Artifact'] },
          excludeSelf: true,
          annotations: [{ target: 'oracle', line: 1, start: 15, end: 43 }],
        },
        provenance: { origin: 'parser', rule: 'sacrifice-effect-structural' },
      },
    ]);
  });

  it('accepts Phantom Train — notSelf:true, creature-or-artifact ("artifact or creature" order); sink narrows to "another artifact or creature"', () => {
    const result = recognizeSacrificeEffectStructural(structuralInput('Phantom Train', phantomTrain));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'sacrifice', target: { types: { hasAny: ['Creature', 'Artifact'] }, excludeSelf: true }, annotations: [{ target: 'oracle', line: 1, start: 0, end: 38 }] });
    // Oracle text (line 1): "Sacrifice another artifact or creature: Put a
    // +1/+1 counter on this Vehicle. (...)" — [10,38)="another artifact
    // or creature" (sink) — verified by direct string-slice.
    expect(result.facts[1]!.fact).toMatchObject({ to: 'Battlefield', types: { hasAny: ['Creature', 'Artifact'] }, excludeSelf: true, annotations: [{ target: 'oracle', line: 1, start: 10, end: 38 }] });
  });

  it('accepts Namazu Trader — notSelf:true, optional, "you may sacrifice another creature or artifact. If you do,"; sink narrows to "another creature or artifact"', () => {
    const result = recognizeSacrificeEffectStructural(structuralInput('Namazu Trader', namazuTrader));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 1): "Whenever this creature attacks, you may
    // sacrifice another creature or artifact. If you do, surveil 2. (...)"
    // — [50,78)="another creature or artifact" (sink) — verified by
    // direct string-slice.
    expect(result.facts[1]!.fact).toMatchObject({ to: 'Battlefield', types: { hasAny: ['Creature', 'Artifact'] }, excludeSelf: true, annotations: [{ target: 'oracle', line: 1, start: 50, end: 78 }] });
  });

  it('accepts Reno and Rude — notSelf:true, optional; sink narrows to "another creature or artifact"', () => {
    const result = recognizeSacrificeEffectStructural(structuralInput('Reno and Rude', renoAndRude));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 1): "...Then you may sacrifice another creature
    // or artifact. If you do, (...)" — [124,152)="another creature or
    // artifact" (sink) — verified by direct string-slice.
    expect(result.facts[1]!.fact).toMatchObject({ to: 'Battlefield', types: { hasAny: ['Creature', 'Artifact'] }, excludeSelf: true, annotations: [{ target: 'oracle', line: 1, start: 124, end: 152 }] });
  });

  it('accepts Midgar, City of Mako // Reactor Raid (back face) — no notSelf, optional, "an artifact or creature"; sink narrows to "an artifact or creature"', () => {
    const backDef = midgarCityOfMako.backFace!;
    const result = recognizeSacrificeEffectStructural(structuralInput('Midgar, City of Mako // Reactor Raid', backDef, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'sacrifice', target: { types: { hasAny: ['Creature', 'Artifact'] } } });
    expect((result.facts[0]!.fact as { target?: { excludeSelf?: boolean } }).target?.excludeSelf).toBeUndefined();
    // Oracle text (line 0): "You may sacrifice an artifact or creature. If
    // you do, draw two cards. (...)" — [18,41)="an artifact or creature"
    // (sink) — verified by direct string-slice.
    expect(result.facts[1]!.fact).toMatchObject({ to: 'Battlefield', types: { hasAny: ['Creature', 'Artifact'] }, annotations: [{ target: 'oracle', line: 0, start: 18, end: 41 }] });
  });

  it('accepts Vayne\'s Treachery — no notSelf, no optional, "Kicker—Sacrifice an artifact or creature."; sink narrows to "an artifact or creature"', () => {
    const result = recognizeSacrificeEffectStructural(structuralInput("Vayne's Treachery", vaynesTreachery));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 0): "Kicker—Sacrifice an artifact or creature.
    // (...)" — [17,40)="an artifact or creature" (sink) — verified by
    // direct string-slice.
    expect(result.facts[1]!.fact).toMatchObject({ to: 'Battlefield', types: { hasAny: ['Creature', 'Artifact'] }, annotations: [{ target: 'oracle', line: 0, start: 17, end: 40 }] });
  });

  it('accepts Sidequest: Hunt the Mark // Yiazmat, Ultimate Mark (back face) — notSelf:true, cost-embedded, colon boundary; sink narrows to "another creature or artifact"', () => {
    const backDef = sidequestHuntTheMark.backFace!;
    const result = recognizeSacrificeEffectStructural(structuralInput('Sidequest: Hunt the Mark // Yiazmat, Ultimate Mark', backDef, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 0): "{1}{B}, Sacrifice another creature or
    // artifact: Yiazmat gains indestructible until end of turn. Tap it."
    // — [18,46)="another creature or artifact" (sink) — verified by
    // direct string-slice.
    expect(result.facts[1]!.fact).toMatchObject({ to: 'Battlefield', types: { hasAny: ['Creature', 'Artifact'] }, excludeSelf: true, annotations: [{ target: 'oracle', line: 0, start: 18, end: 46 }] });
  });

  it('accepts Sephiroth, Fabled SOLDIER (front face) — notSelf:true, optional, single-type "creature"; sink narrows to "another creature"', () => {
    const result = recognizeSacrificeEffectStructural(structuralInput('Sephiroth, Fabled SOLDIER // Sephiroth, One-Winged Angel', sephirothFabledSoldier));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'sacrifice', target: { types: { has: ['Creature'] }, excludeSelf: true } });
    // Oracle text (line 0): "Whenever Sephiroth enters or attacks, you may
    // sacrifice another creature. If you do, draw a card." — [56,72)=
    // "another creature" (sink) — verified by direct string-slice.
    expect(result.facts[1]!.fact).toMatchObject({ to: 'Battlefield', types: { has: ['Creature'] }, excludeSelf: true, annotations: [{ target: 'oracle', line: 0, start: 56, end: 72 }] });
  });

  it("declines Sephiroth, One-Winged Angel (Sephiroth Fabled SOLDIER's own back face) — Computed sacCount qty", () => {
    const backDef = sephirothFabledSoldier.backFace!;
    const result = recognizeSacrificeEffectStructural(structuralInput('Sephiroth, Fabled SOLDIER // Sephiroth, One-Winged Angel', backDef, 'back'));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('Computed') });
  });
});

describe('sacrifice-effect-structural — TEMPLATE 2 (self-subtype "sacrifice this <SubtypeWord>")', () => {
  it('accepts Sleep Magic — validType:\'enchantment\', typeLine subtype "Aura", "sacrifice this Aura"', () => {
    const result = recognizeSacrificeEffectStructural(structuralInput('Sleep Magic', sleepMagic));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'sacrifice', subject: 'self', target: 'self', annotations: [{ target: 'oracle', line: 3, start: 41, end: 60 }], triggeredBy: 'onEnchantedDealtDamage' },
        provenance: { origin: 'parser', rule: 'sacrifice-effect-structural' },
      },
    ]);
  });
});

describe('sacrifice-effect-structural — real declines', () => {
  it('declines Louisoix\'s Sacrifice — real text narrows to "a LEGENDARY creature," a real structural under-approximation', () => {
    const result = recognizeSacrificeEffectStructural(structuralInput("Louisoix's Sacrifice", louisoixsSacrifice));
    expect(result).toEqual({ matched: false, kind: 'mismatch', reason: expect.stringContaining('0 total match') });
  });

  it('declines Quina, Qu Gourmet — real cost text is "Sacrifice a Frog" (a named type), already covered by sacrificeCostNamedType-structural', () => {
    const result = recognizeSacrificeEffectStructural(structuralInput('Quina, Qu Gourmet', quinaQuGourmet));
    expect(result).toEqual({ matched: false, kind: 'mismatch', reason: expect.stringContaining('0 total match') });
  });

  it("declines Cornered by Black Mages — owner:'opponents', no confirmed Fact-shape for a non-'you' owner", () => {
    const result = recognizeSacrificeEffectStructural(structuralInput('Cornered by Black Mages', corneredByBlackMages));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("owner:'opponents'") });
  });

  it('declines a card with no sacrifice effect at all on this face', () => {
    const result = recognizeSacrificeEffectStructural(structuralInput('Ahriman', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'sacrifice'") });
  });
});
