// Verifies `triggerDoubling-selfAndAttachedEquipment-structural.ts` against
// the one real card this recognizer confidently matches (Cloud, Midgar
// Mercenary — `scope:'selfAndAttachedEquipment'`) and the real, confirmed
// decline cases named in its own module doc comment: The Masamune
// (`scope:'equippedSelf'`, a genuinely different sentence) and Traveling
// Chocobo (`scope:'anyPermanentYouControl'`, also genuinely different).
import { describe, expect, it } from 'vitest';
import { cloudMidgarMercenary } from '../cards/cloud-midgar-mercenary/definition';
import { theMasamune } from '../cards/the-masamune/definition';
import { travelingChocobo } from '../cards/traveling-chocobo/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import {
  recognizeTriggerDoublingSelfAndAttachedEquipmentStructural,
  type TriggerDoublingRecognizerInput,
} from './triggerDoubling-selfAndAttachedEquipment-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): TriggerDoublingRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, triggerDoubling: def.triggerDoubling };
}

describe('triggerDoubling-selfAndAttachedEquipment-structural', () => {
  it('accepts Cloud, Midgar Mercenary — "a triggered ability of Cloud or an Equipment attached to it"', () => {
    const result = recognizeTriggerDoublingSelfAndAttachedEquipmentStructural(structuralInput('Cloud, Midgar Mercenary', cloudMidgarMercenary));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'sink',
        fact: { event: 'triggeredAbility', target: 'self', annotations: [{ target: 'oracle', line: 1, start: expect.any(Number), end: expect.any(Number) }] },
        provenance: { origin: 'parser', rule: 'triggerDoubling-selfAndAttachedEquipment-structural' },
      },
      {
        role: 'sink',
        fact: {
          event: 'triggeredAbility',
          target: { types: { has: ['Equipment'] }, attachedToSelf: true },
          annotations: [{ target: 'oracle', line: 1, start: expect.any(Number), end: expect.any(Number) }],
        },
        provenance: { origin: 'parser', rule: 'triggerDoubling-selfAndAttachedEquipment-structural' },
      },
    ]);
  });

  it('declines The Masamune — scope:"equippedSelf", a genuinely different real sentence', () => {
    const result = recognizeTriggerDoublingSelfAndAttachedEquipmentStructural(structuralInput('The Masamune', theMasamune));
    expect(result.matched).toBe(false);
  });

  it('declines Traveling Chocobo — scope:"anyPermanentYouControl", also genuinely different', () => {
    const result = recognizeTriggerDoublingSelfAndAttachedEquipmentStructural(structuralInput('Traveling Chocobo', travelingChocobo));
    expect(result.matched).toBe(false);
  });
});
