// Verifies `digReveal-effect-structural.ts` against the one real card this
// recognizer confidently matches (Ashe, Princess of Dalmasca —
// `validType:'artifact'`) and the real, confirmed decline cases named in its
// own module doc comment: Commune with Beavers (`validType:'any'`, a
// documented approximation of a real 3-way disjunction — NOT "any card"),
// Dark Confidant (no `validType`/`optional` at all), and Choco, Seeker of
// Paradise (a `Computed<number>` `qty`).
import { describe, expect, it } from 'vitest';
import { ashePrincessOfDalmasca } from '../cards/ashe-princess-of-dalmasca/definition';
import { communeWithBeavers } from '../cards/commune-with-beavers/definition';
import { darkConfidant } from '../cards/dark-confidant/definition';
import { chocoSeekerOfParadise } from '../cards/choco-seeker-of-paradise/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeDigRevealEffectStructural, type StructuralRecognizerInput } from './digReveal-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('digReveal-effect-structural', () => {
  it('accepts Ashe, Princess of Dalmasca — "reveal an artifact card from among them and put it into your hand"', () => {
    const result = recognizeDigRevealEffectStructural(structuralInput('Ashe, Princess of Dalmasca', ashePrincessOfDalmasca));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          to: 'Hand',
          from: 'Library',
          controller: 'you',
          types: { has: ['Artifact'] },
          annotations: [{ target: 'oracle', line: 0, start: expect.any(Number), end: expect.any(Number) }],
        },
        provenance: { origin: 'parser', rule: 'digReveal-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Library', controller: 'you', types: { has: ['Artifact'] }, annotations: [{ target: 'oracle', line: 0, start: expect.any(Number), end: expect.any(Number) }] },
        provenance: { origin: 'parser', rule: 'digReveal-effect-structural' },
      },
    ]);
  });

  it('declines Commune with Beavers — validType:"any" is a documented approximation of "artifact, creature, or land", not "any card"', () => {
    const result = recognizeDigRevealEffectStructural(structuralInput('Commune with Beavers', communeWithBeavers));
    expect(result.matched).toBe(false);
  });

  it('declines Dark Confidant — no validType/optional at all', () => {
    const result = recognizeDigRevealEffectStructural(structuralInput('Dark Confidant', darkConfidant));
    expect(result.matched).toBe(false);
  });

  it('declines Choco, Seeker of Paradise — qty is a Computed<number> closure', () => {
    const result = recognizeDigRevealEffectStructural(structuralInput('Choco, Seeker of Paradise', chocoSeekerOfParadise));
    expect(result.matched).toBe(false);
  });
});
