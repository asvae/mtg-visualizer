import { describe, expect, it } from 'vitest';
import { magitekArmor } from '../cards/magitek-armor/definition';
import { theLunarWhale } from '../cards/the-lunar-whale/definition';
import { theRegalia } from '../cards/the-regalia/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeCrewCostStructural, type CrewCostRecognizerInput } from './crewCost-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): CrewCostRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, crewCost: def.crewCost };
}

describe('crewCost-structural', () => {
  it('accepts Magitek Armor (full Crew 1 reminder text) — 2026-09-16 SOURCE/SINK split fix: source narrows to bare "Crew 1," sink narrows to "creatures you control"', () => {
    const result = recognizeCrewCostStructural(structuralInput('Magitek Armor', magitekArmor));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 1): "Crew 1 (Tap any number of creatures you
    // control with total power 1 or more: This Vehicle becomes an
    // artifact creature until end of turn.)" — [0,6)="Crew 1" (source),
    // [26,47)="creatures you control" (sink) — verified by direct
    // string-slice.
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'crew', target: 'self', annotations: [{ target: 'oracle', line: 1, start: 0, end: 6 }] },
        provenance: { origin: 'parser', rule: 'crewCost-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, annotations: [{ target: 'oracle', line: 1, start: 26, end: 47 }] },
        provenance: { origin: 'parser', rule: 'crewCost-structural' },
      },
    ]);
  });

  it('accepts The Lunar Whale (bare "Crew 1" line, no reminder text) — no separable object phrase, source and sink both stay the same unsplit "Crew 1" span', () => {
    const result = recognizeCrewCostStructural(structuralInput('The Lunar Whale', theLunarWhale));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'crew', target: 'self', annotations: [{ target: 'oracle', line: 3, start: 0, end: 6 }] },
        provenance: { origin: 'parser', rule: 'crewCost-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, annotations: [{ target: 'oracle', line: 3, start: 0, end: 6 }] },
        provenance: { origin: 'parser', rule: 'crewCost-structural' },
      },
    ]);
  });

  it('accepts The Regalia (bare "Crew 1" line, previously had NO crew fact at all) — same unsplit-span case as The Lunar Whale', () => {
    const result = recognizeCrewCostStructural(structuralInput('The Regalia', theRegalia));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'crew', target: 'self', annotations: [{ target: 'oracle', line: 2, start: 0, end: 6 }] },
        provenance: { origin: 'parser', rule: 'crewCost-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, annotations: [{ target: 'oracle', line: 2, start: 0, end: 6 }] },
        provenance: { origin: 'parser', rule: 'crewCost-structural' },
      },
    ]);
  });

  it('declines a card with no crewCost on this face', () => {
    const result = recognizeCrewCostStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '', crewCost: undefined });
    expect(result).toEqual({ matched: false, reason: 'no crewCost on this face' });
  });
});
