// Verifies `jobSelectCreateTokenAndEquip-effect-structural.ts` against 3 real
// cards sharing the identical closure body, plus the real decline (Coral
// Sword's own genuinely different chosen-target attach closure).
import { describe, expect, it } from 'vitest';
import { dragoonsLance } from '../cards/dragoon-s-lance/definition';
import { machinistsArsenal } from '../cards/machinist-s-arsenal/definition';
import { paladinsArms } from '../cards/paladin-s-arms/definition';
import { coralSword } from '../cards/coral-sword/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import {
  recognizeJobSelectCreateTokenAndEquipEffectStructural,
  type StructuralRecognizerInput,
} from './jobSelectCreateTokenAndEquip-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('jobSelectCreateTokenAndEquip-effect-structural', () => {
  it("accepts Dragoon's Lance", () => {
    const result = recognizeJobSelectCreateTokenAndEquipEffectStructural(structuralInput("Dragoon's Lance", dragoonsLance));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'entersBattlefield',
          to: 'Battlefield',
          controller: 'you',
          subject: { token: 'c_1_1_hero' },
          annotations: [{ target: 'oracle', line: 0, start: 40, end: 106 }],
          triggeredBy: 'onEnter',
        },
        provenance: { origin: 'parser', rule: 'jobSelectCreateTokenAndEquip-effect-structural' },
      },
    ]);
  });

  it("accepts Machinist's Arsenal", () => {
    const result = recognizeJobSelectCreateTokenAndEquipEffectStructural(structuralInput("Machinist's Arsenal", machinistsArsenal));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'entersBattlefield', subject: { token: 'c_1_1_hero' } });
  });

  it("accepts Paladin's Arms", () => {
    const result = recognizeJobSelectCreateTokenAndEquipEffectStructural(structuralInput("Paladin's Arms", paladinsArms));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('declines Coral Sword — chosen-target attach, not an unconditional self-attach-to-new-token', () => {
    const result = recognizeJobSelectCreateTokenAndEquipEffectStructural(structuralInput('Coral Sword', coralSword));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no custom effect on this face was classified') });
  });
});
