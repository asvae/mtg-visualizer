// Verifies `castTypeSpell-trigger-structural.ts` against the real 8-card
// pool this recognizer's own module doc comment describes: every real
// `onCast<Type>Spell`-named trigger accepted with the exact Fact shape that
// card's own existing hand-authored data already uses (or, where none
// exists, the new shape this recognizer establishes), plus the real
// deliberate declines (the unsupported `onCastSpellYouDontOwn` name, and a
// card with no trigger of this family at all).
//
// **`onCastCreatureSpell` (Champions of the Perfect) is NOT exercised here
// via `loadFinCards`** — same real, permanent, documented testing gap
// `continuousPTGrantsSubtype-structural.test.ts`'s own module doc comment
// already establishes for Elvish Archdruid/Thranduil: Champions of the
// Perfect is a real cross-set reference card (Bloomburrow) with no entry
// under any `data/*/*_scryfall.json` (confirmed — `apply-recognizers.mjs`'s
// own "skip, no oracle text found" path already tolerates this pool-wide),
// so it's exercised only via a synthetic input below (its real, `forge-
// lookup.mjs`-confirmed oracle text hand-transcribed into the synthetic
// case, same as this file's own "declines" synthetic cases already do) —
// same real-text confirmation, just not routed through the fixture loader
// that has no entry for it.
import { describe, expect, it } from 'vitest';
import { sahagin } from '../cards/sahagin/definition';
import { thePrimaVista } from '../cards/the-prima-vista/definition';
import { venatHeartOfHydaelyn } from '../cards/venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal/definition';
import { shantottoTacticianMagician } from '../cards/shantotto-tactician-magician/definition';
import { tellahGreatSage } from '../cards/tellah-great-sage/definition';
import { viviOrnitier } from '../cards/vivi-ornitier/definition';
import { vaanStreetThief } from '../cards/vaan-street-thief/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeCastTypeSpellTriggerStructural } from './castTypeSpell-trigger-structural';
import type { StructuralRecognizerInput } from './structural-effects';

const finCards = loadFinCards();

/** Same real-oracle-text + real-`CardDefinition`-half pairing
 * `destroy-effect-structural.test.ts`'s own `structuralInput` helper already
 * establishes. */
function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('castTypeSpell-trigger-structural — "Whenever you cast a <type> spell" precondition, keyed on Trigger.name', () => {
  it('accepts onCastCreatureSpell (Champions of the Perfect — synthetic input, its own real forge-lookup.mjs-confirmed oracle text, see this file\'s own module doc comment for why not loadFinCards) — matches its own existing hand-authored flat-types shape', () => {
    const result = recognizeCastTypeSpellTriggerStructural({
      name: 'Champions of the Perfect',
      typeLine: 'Creature — Elf Warrior',
      oracleText:
        "As an additional cost to cast this spell, behold an Elf and exile it. (Exile an Elf you control or an Elf card from your hand.)\nWhenever you cast a creature spell, draw a card.\nWhen this creature leaves the battlefield, return the exiled card to its owner's hand.",
      triggers: [{ name: 'onCastCreatureSpell', effects: [{ kind: 'drawCard', amount: 1 }] }],
    });
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: { event: 'castCreatureSpell', controller: 'you', types: { has: ['Creature'] }, annotations: [expect.objectContaining({ target: 'oracle' })] },
        provenance: { origin: 'parser', rule: 'castTypeSpell-trigger-structural' },
      },
    ]);
  });

  it('accepts onCastLegendarySpell (Venat, Heart of Hydaelyn) — matches its own existing hand-authored target+oncePerTurn shape', () => {
    const input = structuralInput('Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal', venatHeartOfHydaelyn, 'front');
    const result = recognizeCastTypeSpellTriggerStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: {
          event: 'cast',
          controller: 'you',
          target: { types: { has: ['Legendary'] } },
          oncePerTurn: true,
          annotations: [expect.objectContaining({ target: 'oracle' })],
        },
        provenance: { origin: 'parser', rule: 'castTypeSpell-trigger-structural' },
      },
    ]);
    // Real regression-guard (2026-09-16, fin/20-47 pass) — the annotation
    // now widens to include the real corroborating "This ability triggers
    // only once each turn." sentence, not just the bare "Whenever you cast
    // a legendary spell" precondition.
    const ann = (result.facts[0]!.fact as { annotations: { line: number; start: number; end: number }[] }).annotations[0]!;
    const line0 = input.oracleText.split('\n')[ann.line]!;
    expect(line0.slice(ann.start, ann.end)).toBe('Whenever you cast a legendary spell, draw a card. This ability triggers only once each turn.');
  });

  it.each([
    ['Sahagin', sahagin],
    ['The Prima Vista', thePrimaVista],
  ])('accepts onCastNoncreatureSpell4Mana (%s) — matches its own existing hand-authored cmc:{min:4} shape', (scryfallName, def) => {
    const result = recognizeCastTypeSpellTriggerStructural(structuralInput(scryfallName, def));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: {
          event: 'cast',
          controller: 'you',
          target: { types: { not: ['Creature'] }, cmc: { min: 4 } },
          annotations: [expect.objectContaining({ target: 'oracle' })],
        },
        provenance: { origin: 'parser', rule: 'castTypeSpell-trigger-structural' },
      },
    ]);
  });

  it.each([
    ['Shantotto, Tactician Magician', shantottoTacticianMagician],
    ['Tellah, Great Sage', tellahGreatSage],
    ['Vivi Ornitier', viviOrnitier],
  ])('accepts the bare onCastNoncreatureSpell (%s) — a genuinely NEW fact, none of these 3 real cards has an existing hand-authored sink for this want', (scryfallName, def) => {
    const result = recognizeCastTypeSpellTriggerStructural(structuralInput(scryfallName, def));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: { event: 'cast', controller: 'you', target: { types: { not: ['Creature'] } }, annotations: [expect.objectContaining({ target: 'oracle' })] },
        provenance: { origin: 'parser', rule: 'castTypeSpell-trigger-structural' },
      },
    ]);
  });

  it('declines onCastSpellYouDontOwn (Vaan, Street Thief) — no ownership vocabulary exists in Constraints, real documented decline, not a silent skip', () => {
    const result = recognizeCastTypeSpellTriggerStructural(structuralInput('Vaan, Street Thief', vaanStreetThief));
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.reason).toMatch(/onCastSpellYouDontOwn/);
  });

  it('declines a card with no onCast<Type>Spell-named trigger at all', () => {
    const result = recognizeCastTypeSpellTriggerStructural({ name: 'Fake Card', typeLine: 'Creature — Human', oracleText: 'Vigilance', triggers: [] });
    expect(result.matched).toBe(false);
  });

  it('mismatch-declines when a trigger carries a known name but the expected clause is not found verbatim (kind:"mismatch", not "scope")', () => {
    const result = recognizeCastTypeSpellTriggerStructural({
      name: 'Fake Card',
      typeLine: 'Creature — Human',
      oracleText: 'Whenever you cast an instant spell, draw a card.',
      triggers: [{ name: 'onCastCreatureSpell', effects: [{ kind: 'drawCard' }] }],
    });
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.kind).toBe('mismatch');
  });
});
