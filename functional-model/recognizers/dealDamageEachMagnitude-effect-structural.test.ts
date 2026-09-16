// Verifies `dealDamageEachMagnitude-effect-structural.ts` against its one
// real pool occurrence (a `kind:'dealDamage'` `EachAction` whose own amount
// is a real `AddValue` two-term sum, reached through a program-AST walk),
// plus real declines.
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../card';
import { ahriman } from '../cards/ahriman/definition';
import { beatrixLoyalGeneral } from '../cards/beatrix-loyal-general/definition';
import { slashOfLight } from '../cards/slash-of-light/definition';
import { youreNotAlone } from '../cards/you-re-not-alone/definition';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeDealDamageEachMagnitudeEffectStructural, type StructuralRecognizerInput } from './dealDamageEachMagnitude-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const faceData = face === 'front' ? card.front : card.back!;
  return { name: def.name, typeLine: faceData.typeLine, oracleText: faceData.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('dealDamageEachMagnitude-effect-structural — a kind:"dealDamage" EachAction whose amount is a real AddValue sum, reached through a program-AST walk', () => {
  it('accepts Slash of Light\'s own real "creatures you control plus Equipment you control" sum', () => {
    const result = recognizeDealDamageEachMagnitudeEffectStructural(structuralInput('Slash of Light', slashOfLight));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(4);
    expect(result.facts[0]).toMatchObject({
      role: 'source',
      fact: { event: 'damage', controller: 'you', target: { types: { has: ['Creature'] } }, targeted: true },
      provenance: { origin: 'parser', rule: 'dealDamageEachMagnitude-effect-structural' },
    });
    expect(result.facts[1]).toMatchObject({ role: 'sink', fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] } } });
    expect(result.facts[2]).toMatchObject({ role: 'sink', fact: { to: 'Battlefield', controller: 'you', types: { has: ['Equipment'] } } });
    expect(result.facts[3]).toMatchObject({ role: 'sink', fact: { to: 'Battlefield', types: { has: ['Creature'] } } });
    expect(result.facts[3]!.fact).not.toHaveProperty('controller');
  });

  it('declines You\'re Not Alone (a real kind:"program" card with a pump, not dealDamage, EachAction)', () => {
    const result = recognizeDealDamageEachMagnitudeEffectStructural(structuralInput("You're Not Alone", youreNotAlone));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no recognized dealDamage EachAction occurrence') });
  });

  it('declines Beatrix, Loyal General (a real kind:"program" card with an equip, not dealDamage, EachAction)', () => {
    const result = recognizeDealDamageEachMagnitudeEffectStructural(structuralInput('Beatrix, Loyal General', beatrixLoyalGeneral));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no recognized dealDamage EachAction occurrence') });
  });

  it('declines a real card with no program effect at all (Ahriman)', () => {
    const result = recognizeDealDamageEachMagnitudeEffectStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'program'") });
  });
});
