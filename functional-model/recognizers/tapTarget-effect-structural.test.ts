// Verifies `tapTarget-effect-structural.ts` against the real matches/
// declines its own module doc comment names.
import { describe, expect, it } from 'vitest';
import { coeurl } from '../cards/coeurl/definition';
import { summonShiva } from '../cards/summon-shiva/definition';
import { crossroadsVillage } from '../cards/crossroads-village/definition';
import { ringOfTheLucii } from '../cards/ring-of-the-lucii/definition';
import { iceFlan } from '../cards/ice-flan/definition';
import { tidusBlitzballStar } from '../cards/tidus-blitzball-star/definition';
import { ultrosObnoxiousOctopus } from '../cards/ultros-obnoxious-octopus/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeTapTargetEffectStructural, type StructuralRecognizerInput } from './tapTarget-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('tapTarget-effect-structural — real "Tap target <type>" template', () => {
  it("accepts Coeurl — no owner, excludeEnchantment:true, matches this card's own pre-existing hand-authored fact byte-for-byte", () => {
    const result = recognizeTapTargetEffectStructural(structuralInput('Coeurl', coeurl));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // 2026-09-16 SOURCE/SINK span-narrowing fix (same bug class as
    // `putCounterTarget-effect-structural.ts`'s own confirmed fix): source
    // narrows to just the bare verb "Tap," sink narrows to just the object
    // phrase "target nonenchantment creature" — no longer the same
    // whole-clause span reused on both. Oracle text: "{1}{W}, {T}: Tap
    // target nonenchantment creature." — chars [13,16)="Tap",
    // [17,47)="target nonenchantment creature" (verified by direct
    // string-slice against the real oracle text, not inferred).
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'tap',
          target: { types: { has: ['Creature'], not: ['Enchantment'] } },
          targeted: true,
          annotations: [{ target: 'oracle', line: 0, start: 13, end: 16 }],
        },
        provenance: { origin: 'parser', rule: 'tapTarget-effect-structural' },
      },
      {
        role: 'sink',
        fact: {
          to: 'Battlefield',
          types: { has: ['Creature'], not: ['Enchantment'] },
          annotations: [{ target: 'oracle', line: 0, start: 17, end: 47 }],
        },
        provenance: { origin: 'parser', rule: 'tapTarget-effect-structural' },
      },
    ]);
  });

  it('accepts Summon: Shiva — owner:\'opponents\', "target creature an opponent controls," 2 identical chapter effects', () => {
    const result = recognizeTapTargetEffectStructural(structuralInput('Summon: Shiva', summonShiva));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(4);
    // Both chapter effects share the same real clause ("I, II — Heavenly
    // Strike — Tap target creature an opponent controls."), line 1,
    // [26,29)="Tap" (source), [30,66)="target creature an opponent
    // controls" (sink) — verified by direct string-slice.
    for (const f of result.facts) {
      if (f.role === 'source') {
        expect(f.fact).toMatchObject({
          event: 'tap',
          target: { types: { has: ['Creature'] } },
          annotations: [{ target: 'oracle', line: 1, start: 26, end: 29 }],
        });
      } else {
        expect(f.fact).toMatchObject({
          to: 'Battlefield',
          types: { has: ['Creature'] },
          annotations: [{ target: 'oracle', line: 1, start: 30, end: 66 }],
        });
      }
    }
  });

  it('declines Crossroads Village — the real ETB-tapped-self workaround (owner:\'you\'), not a genuine targeted tap; no "tap target land" phrase exists anywhere in its own real text', () => {
    const result = recognizeTapTargetEffectStructural(structuralInput('Crossroads Village', crossroadsVillage));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no confirmed structural->text template') });
  });

  it("accepts Ice Flan — owner:'opponents', validType:'creature-or-artifact', real \"tap target artifact or creature an opponent controls\"", () => {
    const result = recognizeTapTargetEffectStructural(structuralInput('Ice Flan', iceFlan));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 0): "When this creature enters, tap target
    // artifact or creature an opponent controls. Put a stun counter on
    // it. (...)" — [27,30)="tap" (source), [31,79)="target artifact or
    // creature an opponent controls" (sink) — verified by direct
    // string-slice.
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'tap',
          target: { types: { hasAny: ['Creature', 'Artifact'] } },
          targeted: true,
          annotations: [{ target: 'oracle', line: 0, start: 27, end: 30 }],
          triggeredBy: 'onEnter',
        },
        provenance: { origin: 'parser', rule: 'tapTarget-effect-structural' },
      },
      {
        role: 'sink',
        fact: {
          to: 'Battlefield',
          types: { hasAny: ['Creature', 'Artifact'] },
          annotations: [{ target: 'oracle', line: 0, start: 31, end: 79 }],
        },
        provenance: { origin: 'parser', rule: 'tapTarget-effect-structural' },
      },
    ]);
  });

  it('accepts Tidus, Blitzball Star — owner:\'opponents\', "Whenever Tidus attacks, tap target creature an opponent controls."', () => {
    const result = recognizeTapTargetEffectStructural(structuralInput('Tidus, Blitzball Star', tidusBlitzballStar));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 1): "Whenever Tidus attacks, tap target creature
    // an opponent controls." — [24,27)="tap" (source), [28,64)="target
    // creature an opponent controls" (sink) — verified by direct
    // string-slice.
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'tap',
          target: { types: { has: ['Creature'] } },
          targeted: true,
          annotations: [{ target: 'oracle', line: 1, start: 24, end: 27 }],
          triggeredBy: 'onAttacks',
        },
        provenance: { origin: 'parser', rule: 'tapTarget-effect-structural' },
      },
      {
        role: 'sink',
        fact: {
          to: 'Battlefield',
          types: { has: ['Creature'] },
          annotations: [{ target: 'oracle', line: 1, start: 28, end: 64 }],
        },
        provenance: { origin: 'parser', rule: 'tapTarget-effect-structural' },
      },
    ]);
  });

  it('accepts Ultros, Obnoxious Octopus — owner:\'opponents\', "...tap target creature an opponent controls and put a stun counter on it."', () => {
    const result = recognizeTapTargetEffectStructural(structuralInput('Ultros, Obnoxious Octopus', ultrosObnoxiousOctopus));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 0): "Whenever you cast a noncreature spell, if at
    // least four mana was spent to cast it, tap target creature an
    // opponent controls and put a stun counter on it. (...)" —
    // [83,86)="tap" (source), [87,123)="target creature an opponent
    // controls" (sink) — verified by direct string-slice.
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'tap',
          target: { types: { has: ['Creature'] } },
          targeted: true,
          annotations: [{ target: 'oracle', line: 0, start: 83, end: 86 }],
          triggeredBy: 'onNoncreatureSpellCastGE4Mana',
        },
        provenance: { origin: 'parser', rule: 'tapTarget-effect-structural' },
      },
      {
        role: 'sink',
        fact: {
          to: 'Battlefield',
          types: { has: ['Creature'] },
          annotations: [{ target: 'oracle', line: 0, start: 87, end: 123 }],
        },
        provenance: { origin: 'parser', rule: 'tapTarget-effect-structural' },
      },
    ]);
  });

  it('declines Ring of the Lucii — validType:\'creature-or-artifact\' builds the "artifact or creature" phrase, but real text is the broader "target nonland permanent" (mismatch, suppressed via its own recognizer-exception marker in real pool use)', () => {
    const result = recognizeTapTargetEffectStructural(structuralInput('Ring of the Lucii', ringOfTheLucii));
    expect(result).toEqual({ matched: false, kind: 'mismatch', reason: expect.stringContaining('not found') });
  });

  it('declines a card with no tapTarget effect at all on this face', () => {
    const result = recognizeTapTargetEffectStructural(structuralInput('Ahriman', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'tapTarget'") });
  });
});
