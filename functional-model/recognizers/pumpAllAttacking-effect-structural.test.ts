// Verifies `pumpAllAttacking-effect-structural.ts` against Auron's
// Inspiration (the one real pool occurrence) and a scope decline.
import { describe, expect, it } from 'vitest';
import { auronSInspiration } from '../cards/auron-s-inspiration/definition';
import { ahriman } from '../cards/ahriman/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizePumpAllAttackingEffectStructural, type StructuralRecognizerInput } from './pumpAllAttacking-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe("pumpAllAttacking-effect-structural — \"Attacking creatures get ±P/±T\" (pumpAll, predicate:'attacking-creatures')", () => {
  it("accepts Auron's Inspiration — plus a paired sink; 2026-09-16 SOURCE/SINK split fix (revised same day): sink points at \"Attacking creatures\" (the subject/object phrase), SOURCE covers the FULL clause including that same subject (user-confirmed: the subject is part of the pump action's own description, not a separate condition) — a real span overlap between the two is expected, not a bug", () => {
    const result = recognizePumpAllAttackingEffectStructural(structuralInput("Auron's Inspiration", auronSInspiration));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 0): "Attacking creatures get +2/+0 until end of
    // turn." — [0,19)="Attacking creatures" (sink), [0,47)="Attacking
    // creatures get +2/+0 until end of turn" (source, whole clause) —
    // verified by direct string-slice.
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'pump', target: { types: { has: ['Creature'] }, attacking: true }, annotations: [{ target: 'oracle', line: 0, start: 0, end: 47 }] },
        provenance: { origin: 'parser', rule: 'pumpAllAttacking-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', types: { has: ['Creature'] }, attacking: true, annotations: [{ target: 'oracle', line: 0, start: 0, end: 19 }] },
        provenance: { origin: 'parser', rule: 'pumpAllAttacking-effect-structural' },
      },
    ]);
    const line = 'Attacking creatures get +2/+0 until end of turn.';
    expect(line.slice(0, 47)).toBe('Attacking creatures get +2/+0 until end of turn');
    expect(line.slice(0, 19)).toBe('Attacking creatures');
  });

  it('declines a real card with no pumpAll(attacking-creatures) effect at all (Ahriman)', () => {
    const result = recognizePumpAllAttackingEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'pumpAll'") });
  });
});
