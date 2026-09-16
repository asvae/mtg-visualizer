import { describe, expect, it } from 'vitest';
import { gRahaTia } from '../cards/g-raha-tia/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import {
  recognizeDiesOtherPermanentsOncePerTurnTriggerStructural,
  type StructuralRecognizerInput,
} from './diesOtherPermanentsOncePerTurn-trigger-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('diesOtherPermanentsOncePerTurn-trigger-structural', () => {
  it("accepts G'raha Tia (\"Whenever one or more other creatures and/or artifacts you control die\")", () => {
    const result = recognizeDiesOtherPermanentsOncePerTurnTriggerStructural(structuralInput("G'raha Tia", gRahaTia));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: {
          event: 'dies',
          controller: 'you',
          target: { types: { hasAny: ['Creature', 'Artifact'] }, excludeSelf: true },
          oncePerTurn: true,
          annotations: [{ target: 'oracle', line: 1, start: 18, end: 144 }],
        },
        provenance: { origin: 'parser', rule: 'diesOtherPermanentsOncePerTurn-trigger-structural' },
      },
    ]);
    // Real regression-guard: slice-and-assert the literal widened substring
    // (now the WHOLE trigger sentence, not just its "...you control die"
    // precondition prefix).
    const line1 = finCards.get("G'raha Tia")!.front.oracleText.split('\n')[1]!;
    expect(line1.slice(18, 144)).toBe(
      'Whenever one or more other creatures and/or artifacts you control die, draw a card. This ability triggers only once each turn.',
    );
  });

  it('declines a card with no activationLimit-1 trigger', () => {
    const result = recognizeDiesOtherPermanentsOncePerTurnTriggerStructural({
      name: 'Ahriman',
      typeLine: 'Creature',
      oracleText: 'Whenever one or more other creatures you control die, draw a card.',
      effects: [],
      triggers: [{ name: 'x', effects: [] }],
    });
    expect(result).toEqual({ matched: false, reason: 'no trigger on this face has activationLimit === 1' });
  });

  it('declines a card with the capped trigger but no matching clause text', () => {
    const result = recognizeDiesOtherPermanentsOncePerTurnTriggerStructural({
      name: 'Ahriman',
      typeLine: 'Creature',
      oracleText: 'Whenever a creature you control dies, draw a card. This ability triggers only once each turn.',
      effects: [],
      triggers: [{ name: 'x', effects: [], activationLimit: 1 }],
    });
    expect(result).toEqual({
      matched: false,
      reason: 'no "Whenever one or more (other) <type list> you control die" clause found',
    });
  });
});
