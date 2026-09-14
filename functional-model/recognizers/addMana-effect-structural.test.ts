// Verifies `addMana-effect-structural.ts` against the 3 real in-scope cards
// (see that file's own module doc comment — Elvish Archdruid is a cross-set
// reference card with no real oracle text checked in, so it's exercised only
// via `apply-recognizers.mjs`'s own "skip, no oracle text found" path, not
// here): the plain source-only cases (Cargo Ship, Ether), the paired-sink
// derivation off a real `on: 'tapLandForMana'` trigger (Ultima, Origin of
// Oblivion — including the real quoted-reminder-text disambiguation that
// motivated `matchesOutsideQuotes`), and the structural/mismatch declines.
import { describe, expect, it } from 'vitest';
import { cargoShip } from '../cards/cargo-ship/definition';
import { ether } from '../cards/ether/definition';
import { ultimaOriginOfOblivion } from '../cards/ultima-origin-of-oblivion/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeAddManaEffectStructural, type StructuralRecognizerInput } from './addMana-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('addMana-effect-structural — real matched clauses', () => {
  it('accepts Cargo Ship — "{T}: Add {C}." (a plain activated ability, no paired sink)', () => {
    const result = recognizeAddManaEffectStructural(structuralInput('Cargo Ship', cargoShip));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'addMana', colors: { has: ['C'] }, controller: 'you', annotations: [{ target: 'oracle', line: expect.any(Number), start: expect.any(Number), end: expect.any(Number) }] },
        provenance: { origin: 'parser', rule: 'addMana-effect-structural' },
      },
    ]);
  });

  it('accepts Ether — "{T}, Exile this artifact: Add {U}." (single match despite "artifact"/"Exile" also appearing on the same line)', () => {
    const result = recognizeAddManaEffectStructural(structuralInput('Ether', ether));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'addMana', colors: { has: ['U'] }, controller: 'you' });
  });

  it('accepts Ultima, Origin of Oblivion — "add an additional {C}" — real disambiguation against the quoted-reminder-text "Add {C}." earlier in the SAME face (2 raw matches, only 1 outside quotes) — and derives the paired SINK from its own `on:\'tapLandForMana\'` trigger', () => {
    const result = recognizeAddManaEffectStructural(structuralInput('Ultima, Origin of Oblivion', ultimaOriginOfOblivion));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'addMana', colors: { has: ['C'] }, controller: 'you', annotations: [{ target: 'oracle', line: expect.any(Number), start: expect.any(Number), end: expect.any(Number) }] },
        provenance: { origin: 'parser', rule: 'addMana-effect-structural' },
      },
      {
        role: 'sink',
        fact: {
          event: 'addMana',
          colors: { has: ['C'] },
          controller: 'you',
          types: { has: ['Land'] },
          annotations: [{ target: 'oracle', line: expect.any(Number), start: expect.any(Number), end: expect.any(Number) }],
        },
        provenance: { origin: 'parser', rule: 'addMana-effect-structural' },
      },
    ]);
    // Real byproduct check: the claimed span is the TRIGGER's own clause
    // ("add an additional {C}"), not the quoted reminder text ("Add {C}.")
    // a few words earlier on the SAME face.
    const input = structuralInput('Ultima, Origin of Oblivion', ultimaOriginOfOblivion);
    const ann = result.facts[0]!.fact.annotations![0]!;
    if (ann.target !== 'oracle') throw new Error('fixture setup bug: expected an oracle-text annotation');
    const line = input.oracleText.split('\n')[ann.line]!;
    expect(line.slice(ann.start, ann.end)).toBe('add an additional {C}');
  });

  it('declines a card with no addMana effect at all on this face', () => {
    const result = recognizeAddManaEffectStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '' } as CardDefinition as unknown as StructuralRecognizerInput);
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no kind:"addMana"') });
  });

  it('declines (mismatch) a synthetic addMana effect whose real text has no "add ... {color}" clause at all', () => {
    const input: StructuralRecognizerInput = {
      name: 'Fake Card',
      typeLine: 'Artifact',
      oracleText: '{T}: Draw a card.',
      effects: [{ kind: 'addMana', color: 'C', amount: 1 }] as unknown as StructuralRecognizerInput['effects'],
    };
    const result = recognizeAddManaEffectStructural(input);
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.kind).toBe('mismatch');
  });

  it('does NOT pair a sink for a synthetic tapLandForMana trigger whose own addMana color disagrees with tapLandForManaColor (no unconfirmed cross-color pairing)', () => {
    const input: StructuralRecognizerInput = {
      name: 'Fake Card',
      typeLine: 'Creature',
      oracleText: 'Whenever you tap a land for {G}, add {U}.',
      triggers: [
        {
          name: 'onTap',
          on: 'tapLandForMana',
          tapLandForManaColor: 'G',
          effects: [{ kind: 'addMana', color: 'U', amount: 1 }],
        },
      ] as unknown as StructuralRecognizerInput['triggers'],
    };
    const result = recognizeAddManaEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.role).toBe('source');
  });
});
