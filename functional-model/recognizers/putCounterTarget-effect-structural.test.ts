// Verifies `putCounterTarget-effect-structural.ts` against real cards from
// each bucket named in that file's own module doc comment: matched real
// clauses (both a type-constrained `validType` and the unconstrained `'any'`
// Saga case), structural scope declines (non-positive amount,
// creature-or-artifact, tapTarget-preceded), and the two real mismatch
// declines suppressed via `// recognizer-exception:` markers on their own
// cards (checked here only for the RAW recognizer verdict — the exception
// suppression itself is `apply-recognizers.mjs`'s own concern, not this
// recognizer's).
import { describe, expect, it } from 'vitest';
import { ultimaOriginOfOblivion } from '../cards/ultima-origin-of-oblivion/definition';
import { cloudboundMoogle } from '../cards/cloudbound-moogle/definition';
import { combatTutorial } from '../cards/combat-tutorial/definition';
import { rideTheShoopuf } from '../cards/ride-the-shoopuf/definition';
import { clashOfTheEikons } from '../cards/clash-of-the-eikons/definition';
import { rosaResoluteWhiteMage } from '../cards/rosa-resolute-white-mage/definition';
import { prisheSWanderings } from '../cards/prishe-s-wanderings/definition';
import { theEarthCrystal } from '../cards/the-earth-crystal/definition';
import { torgalAFineHound } from '../cards/torgal-a-fine-hound/definition';
import { iceFlan } from '../cards/ice-flan/definition';
import { omegaHeartlessEvolution } from '../cards/omega-heartless-evolution/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizePutCounterTargetEffectStructural, type StructuralRecognizerInput } from './putCounterTarget-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('putCounterTarget-effect-structural — real matched clauses', () => {
  it('accepts Ultima, Origin of Oblivion — "put a blight counter on target land" (source + paired sink)', () => {
    const result = recognizePutCounterTargetEffectStructural(structuralInput('Ultima, Origin of Oblivion', ultimaOriginOfOblivion));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'putCounter',
          counterType: 'blight',
          target: { types: { has: ['Land'] } },
          targeted: true,
          annotations: [{ target: 'oracle', line: expect.any(Number), start: expect.any(Number), end: expect.any(Number) }],
        },
        provenance: { origin: 'parser', rule: 'putCounterTarget-effect-structural' },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', types: { has: ['Land'] }, annotations: [{ target: 'oracle', line: expect.any(Number), start: expect.any(Number), end: expect.any(Number) }] },
        provenance: { origin: 'parser', rule: 'putCounterTarget-effect-structural' },
      },
    ]);
  });

  it('accepts Cloudbound Moogle — "put a +1/+1 counter on target creature" (no owner clause at all)', () => {
    const result = recognizePutCounterTargetEffectStructural(structuralInput('Cloudbound Moogle', cloudboundMoogle));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'putCounter', counterType: '+1/+1', target: { types: { has: ['Creature'] } }, targeted: true });
    expect(result.facts[1]!.fact).toMatchObject({ to: 'Battlefield', types: { has: ['Creature'] } });
  });

  it('accepts Combat Tutorial — "Put a +1/+1 counter on up to one target creature you control" (loose wildcard between "on" and "target")', () => {
    const result = recognizePutCounterTargetEffectStructural(structuralInput('Combat Tutorial', combatTutorial));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'putCounter', counterType: '+1/+1', target: { types: { has: ['Creature'] } } });
  });

  it('accepts Ride the Shoopuf — "put a +1/+1 counter on target creature you control" (owner: you)', () => {
    const result = recognizePutCounterTargetEffectStructural(structuralInput('Ride the Shoopuf', rideTheShoopuf));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'putCounter', counterType: '+1/+1', target: { types: { has: ['Creature'] } } });
  });

  it('accepts Rosa, Resolute White Mage — "put a +1/+1 counter on target creature you control. It gains lifelink..." (stops at the typeWord, doesn\'t swallow the trailing sentence)', () => {
    const result = recognizePutCounterTargetEffectStructural(structuralInput('Rosa, Resolute White Mage', rosaResoluteWhiteMage));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'putCounter', counterType: '+1/+1', target: { types: { has: ['Creature'] } } });
  });

  it("accepts Prishe's Wanderings — \"put a +1/+1 counter on target creature you control\" (second effect in the container, but preceded by a 'move' search, not a tapTarget)", () => {
    const result = recognizePutCounterTargetEffectStructural(structuralInput("Prishe's Wanderings", prisheSWanderings));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'putCounter', counterType: '+1/+1', target: { types: { has: ['Creature'] } } });
  });

  it('accepts Clash of the Eikons\' own "Put a lore counter on target Saga you control" mode — validType:\'any\' omits the typeWord requirement AND the target constraint (no sink emitted either)', () => {
    const result = recognizePutCounterTargetEffectStructural(structuralInput('Clash of the Eikons', clashOfTheEikons));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // Only ONE fact: the "Put a lore counter" mode's own source. Its sibling
    // "Remove a lore counter" mode (amount:-1) is structurally out of scope
    // (non-positive amount) and the fight mode has no putCounterTarget at
    // all — neither contributes anything.
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]).toEqual({
      role: 'source',
      fact: { event: 'putCounter', counterType: 'LORE', targeted: true, annotations: [{ target: 'oracle', line: expect.any(Number), start: expect.any(Number), end: expect.any(Number) }] },
      provenance: { origin: 'parser', rule: 'putCounterTarget-effect-structural' },
    });
  });
});

describe('putCounterTarget-effect-structural — structural scope declines (never reach \'mismatch\')', () => {
  it('declines a card with no putCounterTarget effect at all', () => {
    const result = recognizePutCounterTargetEffectStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '' } as CardDefinition as unknown as StructuralRecognizerInput);
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no kind:"putCounterTarget"') });
  });

  it('declines Ice Flan — its own putCounterTarget is immediately preceded by a tapTarget in the same container ("put a stun counter on IT", the same object just tapped)', () => {
    const result = recognizePutCounterTargetEffectStructural(structuralInput('Ice Flan', iceFlan));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('every kind:"putCounterTarget" Effect on this face was structurally out of scope') });
  });

  it("declines Omega, Heartless Evolution — BOTH structurally out of scope: validType 'creature-or-artifact' (no confirmed template) AND preceded by a tapTarget", () => {
    const result = recognizePutCounterTargetEffectStructural(structuralInput('Omega, Heartless Evolution', omegaHeartlessEvolution));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('every kind:"putCounterTarget" Effect on this face was structurally out of scope') });
  });

  it('declines a synthetic putCounterTarget effect with a non-positive literal amount (a REMOVAL, not an addition)', () => {
    const input: StructuralRecognizerInput = {
      name: 'Fake Card',
      typeLine: 'Sorcery',
      oracleText: 'Remove a lore counter from target Saga.',
      effects: [{ kind: 'putCounterTarget', validType: 'any', counterType: 'LORE', amount: -1 }] as unknown as StructuralRecognizerInput['effects'],
    };
    const result = recognizePutCounterTargetEffectStructural(input);
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('every kind:"putCounterTarget" Effect on this face was structurally out of scope') });
  });
});

describe('putCounterTarget-effect-structural — real, confirmed MISMATCH declines (both cards carry a `// recognizer-exception:` marker, checked separately by apply-recognizers.mjs)', () => {
  it('declines (mismatch) The Earth Crystal — real text reads "Distribute two +1/+1 counters among ... target creatures," never "put ... counter on target"', () => {
    const result = recognizePutCounterTargetEffectStructural(structuralInput('The Earth Crystal', theEarthCrystal));
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.kind).toBe('mismatch');
  });

  it('declines (mismatch) Torgal, A Fine Hound — real text has neither "target" nor "put" at all ("...enters with an additional +1/+1 counter on it...")', () => {
    const result = recognizePutCounterTargetEffectStructural(structuralInput('Torgal, A Fine Hound', torgalAFineHound));
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.kind).toBe('mismatch');
  });
});
