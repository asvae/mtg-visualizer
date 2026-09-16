// Verifies `continuousPTGrantsEquipped-structural.ts` against a job-select
// Equipment (real "Equipped creature gets +N/+N" clause preceded by
// unrelated text), Crystal Fragments' own bare motivating case, and the one
// real permanent decline (a dynamic, non-literal per-artifact pump).
import { describe, expect, it } from 'vitest';
import { dragoonsLance } from '../cards/dragoon-s-lance/definition';
import { crystalFragmentsSummonAlexander } from '../cards/crystal-fragments-summon-alexander/definition';
import { machinistsArsenal } from '../cards/machinist-s-arsenal/definition';
import { excaliburIi } from '../cards/excalibur-ii/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import {
  recognizeContinuousPTGrantsEquippedStructural,
  type ContinuousPTGrantsRecognizerInput,
} from './continuousPTGrantsEquipped-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): ContinuousPTGrantsRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, continuousPTGrants: def.continuousPTGrants };
}

describe("continuousPTGrantsEquipped-structural — an Equipment's own real, fixed \"Equipped creature gets ±P/±T\" grant", () => {
  it("accepts Dragoon's Lance (job-select preamble, real +1/+0)", () => {
    const result = recognizeContinuousPTGrantsEquippedStructural(structuralInput("Dragoon's Lance", dragoonsLance));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'pump', target: { equippedBySelf: true }, annotations: [{ target: 'oracle', line: 1, start: 0, end: 28 }] },
        provenance: { origin: 'parser', rule: 'continuousPTGrantsEquipped-structural' },
      },
    ]);
  });

  it('accepts Crystal Fragments (no job-select preamble, real +1/+1 alone on line 0)', () => {
    const result = recognizeContinuousPTGrantsEquippedStructural(
      structuralInput('Crystal Fragments // Summon: Alexander', crystalFragmentsSummonAlexander),
    );
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'pump', target: { equippedBySelf: true }, annotations: [{ target: 'oracle', line: 0, start: 0, end: 28 }] },
        provenance: { origin: 'parser', rule: 'continuousPTGrantsEquipped-structural' },
      },
    ]);
  });

  it("accepts Machinist's Arsenal (scalePerType — \"gets +2/+2 for each artifact you control\", closed 2026-09-15)", () => {
    const result = recognizeContinuousPTGrantsEquippedStructural(structuralInput("Machinist's Arsenal", machinistsArsenal));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'pump', target: { equippedBySelf: true }, annotations: [{ target: 'oracle', line: 1, start: 0, end: 58 }] },
        provenance: { origin: 'parser', rule: 'continuousPTGrantsEquipped-structural' },
      },
    ]);
  });

  it('accepts Excalibur II (scalePerSelfCounter — "gets +1/+1 for each charge counter on Excalibur II", closed 2026-09-16)', () => {
    const result = recognizeContinuousPTGrantsEquippedStructural(structuralInput('Excalibur II', excaliburIi));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'pump', target: { equippedBySelf: true } });
  });
});
