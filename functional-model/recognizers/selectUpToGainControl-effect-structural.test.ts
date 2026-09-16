// Verifies `selectUpToGainControl-effect-structural.ts` against the real
// pool this recognizer's own module doc comment describes: accepts
// Stiltzkin, Moogle Merchant's own confirmed shape; declines Zidane,
// Tantalus Thief's own real but differently-templated sibling (single-step,
// same `controller`/`from` shape family, but `controller:'you'` with a
// genuinely different English clause) and a card with no SelectUpTo at all.
import { describe, expect, it } from 'vitest';
import { stiltzkinMoogleMerchant } from '../cards/stiltzkin-moogle-merchant/definition';
import { zidaneTantalusThief } from '../cards/zidane-tantalus-thief/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeSelectUpToGainControlEffectStructural } from './selectUpToGainControl-effect-structural';
import type { StructuralRecognizerInput } from './structural-effects';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('selectUpToGainControl-effect-structural — "Target opponent gains control of another target permanent you control"', () => {
  it('accepts Stiltzkin, Moogle Merchant — matches its own existing hand-authored gainControl+sink shape exactly; 2026-09-16 SOURCE/SINK split fix: source narrows to "Target opponent gains control of," sink narrows to "another target permanent you control"', () => {
    const result = recognizeSelectUpToGainControlEffectStructural(structuralInput('Stiltzkin, Moogle Merchant', stiltzkinMoogleMerchant));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Oracle text (line 1): "{2}, {T}: Target opponent gains control of
    // another target permanent you control. If they do, you draw a
    // card." — [10,42)="Target opponent gains control of" (source),
    // [43,79)="another target permanent you control" (sink) — verified by
    // direct string-slice.
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'gainControl', controller: 'you', recipient: 'opp', targeted: true, annotations: [{ target: 'oracle', line: 1, start: 10, end: 42 }] },
        provenance: { origin: 'parser', rule: 'selectUpToGainControl-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', controller: 'you', annotations: [{ target: 'oracle', line: 1, start: 43, end: 79 }] },
        provenance: { origin: 'parser', rule: 'selectUpToGainControl-effect-structural' },
      },
    ]);
  });

  it('declines Zidane, Tantalus Thief — same single-step ApplyToBound(gainControl) family, but controller:\'you\' with a genuinely different real English template (no confirmed shape to build against)', () => {
    const result = recognizeSelectUpToGainControlEffectStructural(structuralInput('Zidane, Tantalus Thief', zidaneTantalusThief));
    expect(result.matched).toBe(false);
  });

  it('declines a card with no kind:"program" SelectUpTo effect at all', () => {
    const result = recognizeSelectUpToGainControlEffectStructural({ name: 'Fake Card', typeLine: 'Creature — Human', oracleText: 'Vigilance', effects: [] });
    expect(result.matched).toBe(false);
  });
});
