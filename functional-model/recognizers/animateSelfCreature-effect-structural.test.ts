import { describe, expect, it } from 'vitest';
import { magitekArmor } from '../cards/magitek-armor/definition';
import { thePrimaVista } from '../cards/the-prima-vista/definition';
import { theLunarWhale } from '../cards/the-lunar-whale/definition';
import { theRegalia } from '../cards/the-regalia/definition';
import { rideTheShoopuf } from '../cards/ride-the-shoopuf/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import {
  recognizeAnimateSelfCreatureEffectStructural,
  type AnimateSelfCreatureRecognizerInput,
} from './animateSelfCreature-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): AnimateSelfCreatureRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities, crewCost: def.crewCost };
}

describe('animateSelfCreature-effect-structural', () => {
  it('accepts Magitek Armor (explicit "becomes an artifact creature until end of turn" clause)', () => {
    const result = recognizeAnimateSelfCreatureEffectStructural(structuralInput('Magitek Armor', magitekArmor));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'grantType', type: 'Creature', target: 'self', untilEndOfTurn: true, annotations: [{ target: 'oracle', line: 1, start: 89, end: 135 }] },
        provenance: { origin: 'parser', rule: 'animateSelfCreature-effect-structural' },
      },
    ]);
  });

  it('accepts The Prima Vista (TWO separate qualifying effects, two separate real clauses)', () => {
    const result = recognizeAnimateSelfCreatureEffectStructural(structuralInput('The Prima Vista', thePrimaVista));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(2);
    const spans = result.facts.map((f) => f.fact.annotations![0]!);
    expect(new Set(spans.map((s) => `${s.target === 'oracle' ? s.line : 'typeLine'}:${s.start}-${s.end}`)).size).toBe(2);
  });

  it('accepts The Lunar Whale via the bare "Crew 1" fallback (no explicit "becomes a creature" clause exists)', () => {
    const result = recognizeAnimateSelfCreatureEffectStructural(structuralInput('The Lunar Whale', theLunarWhale));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact.annotations![0]).toEqual({ target: 'oracle', line: 3, start: 0, end: 6 });
  });

  it('accepts The Regalia via the same bare "Crew 1" fallback (had NO grantType fact at all before this pass)', () => {
    const result = recognizeAnimateSelfCreatureEffectStructural(structuralInput('The Regalia', theRegalia));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
  });

  it('declines Ride the Shoopuf (an animate-self-to-Creature effect, but NO crewCost — a genuinely different, permanent, non-Crew "becomes a 7/7 Beast creature" clause)', () => {
    const result = recognizeAnimateSelfCreatureEffectStructural(structuralInput('Ride the Shoopuf', rideTheShoopuf));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no crewCost on this face') });
  });

  it('declines a card with no qualifying animate effect on this face', () => {
    const result = recognizeAnimateSelfCreatureEffectStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '', effects: [] });
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'animate'") });
  });
});
