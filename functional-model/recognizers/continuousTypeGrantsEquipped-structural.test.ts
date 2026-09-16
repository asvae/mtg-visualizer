// Verifies `continuousTypeGrantsEquipped-structural.ts` against a job-select
// Equipment (real "is a Knight in addition to its other types" clause) and a
// vowel-initial granted type (Machinist's Arsenal's own "is an Artificer").
import { describe, expect, it } from 'vitest';
import { dragoonsLance } from '../cards/dragoon-s-lance/definition';
import { machinistsArsenal } from '../cards/machinist-s-arsenal/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import {
  recognizeContinuousTypeGrantsEquippedStructural,
  type ContinuousTypeGrantsRecognizerInput,
} from './continuousTypeGrantsEquipped-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): ContinuousTypeGrantsRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, continuousTypeGrants: def.continuousTypeGrants };
}

describe('continuousTypeGrantsEquipped-structural — "is a[n] <Type> in addition to its other types"', () => {
  it("accepts Dragoon's Lance (consonant-initial type, \"a Knight\")", () => {
    const result = recognizeContinuousTypeGrantsEquippedStructural(structuralInput("Dragoon's Lance", dragoonsLance));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'grantType', type: 'Knight', target: { equippedBySelf: true }, annotations: [{ target: 'oracle', line: 1, start: 33, end: 75 }] },
        provenance: { origin: 'parser', rule: 'continuousTypeGrantsEquipped-structural' },
      },
    ]);
  });

  it('accepts Machinist\'s Arsenal (vowel-initial type, "an Artificer")', () => {
    const result = recognizeContinuousTypeGrantsEquippedStructural(structuralInput("Machinist's Arsenal", machinistsArsenal));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'grantType', type: 'Artificer', target: { equippedBySelf: true }, annotations: [{ target: 'oracle', line: 1, start: 63, end: 109 }] },
        provenance: { origin: 'parser', rule: 'continuousTypeGrantsEquipped-structural' },
      },
    ]);
  });
});
