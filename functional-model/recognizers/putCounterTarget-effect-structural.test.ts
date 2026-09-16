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
import { summonShiva } from '../cards/summon-shiva/definition';
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
  it('accepts Ultima, Origin of Oblivion — "put a blight counter on target land" (source + paired sink, split into disjoint action-clause/object-phrase spans — 2026-09-16 real user-reported fix, see module doc comment)', () => {
    const input = structuralInput('Ultima, Origin of Oblivion', ultimaOriginOfOblivion);
    const result = recognizePutCounterTargetEffectStructural(input);
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
          annotations: [{ target: 'oracle', line: 1, start: 25, end: 60 }],
          // `Fact.triggeredBy` (2026-09-16, "widen populate" pass) — Ultima's
          // own real "Whenever Ultima attacks..." trigger.
          triggeredBy: 'onAttack',
        },
        provenance: { origin: 'parser', rule: 'putCounterTarget-effect-structural' },
      },
      {
        role: 'sink',
        fact: {
          to: 'Battlefield',
          types: { has: ['Land'] },
          annotations: [{ target: 'oracle', line: 1, start: 49, end: 60 }],
        },
        provenance: { origin: 'parser', rule: 'putCounterTarget-effect-structural' },
      },
    ]);
    // Real string-slice byproduct check against the card's own real printed
    // text (not inferred/guessed) — the SOURCE covers the whole clause
    // ("put a blight counter on target land," user-confirmed 2026-09-16:
    // the target is part of the action itself, not a separate condition),
    // the SINK narrows to just the target object-phrase ("target land") —
    // overlap between them is expected, not a bug.
    const line = input.oracleText.split('\n')[1]!;
    expect(line.slice(25, 60)).toBe('put a blight counter on target land');
    expect(line.slice(49, 60)).toBe('target land');
  });

  it('accepts Cloudbound Moogle — "put a +1/+1 counter on target creature" (no owner clause at all; source/sink split into disjoint spans)', () => {
    const input = structuralInput('Cloudbound Moogle', cloudboundMoogle);
    const result = recognizePutCounterTargetEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({
      event: 'putCounter',
      counterType: '+1/+1',
      target: { types: { has: ['Creature'] } },
      targeted: true,
      annotations: [{ target: 'oracle', line: 1, start: 27, end: 65 }],
    });
    expect(result.facts[1]!.fact).toMatchObject({
      to: 'Battlefield',
      types: { has: ['Creature'] },
      annotations: [{ target: 'oracle', line: 1, start: 50, end: 65 }],
    });
    const line = input.oracleText.split('\n')[1]!;
    expect(line.slice(27, 65)).toBe('put a +1/+1 counter on target creature');
    expect(line.slice(50, 65)).toBe('target creature');
  });

  it('accepts Combat Tutorial — "Put a +1/+1 counter on up to one target creature you control" (loose wildcard between "on" and "target"; sink includes the "up to one" quantifier, not just the bare "target creature")', () => {
    const input = structuralInput('Combat Tutorial', combatTutorial);
    const result = recognizePutCounterTargetEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({
      event: 'putCounter',
      counterType: '+1/+1',
      target: { types: { has: ['Creature'] } },
      annotations: [{ target: 'oracle', line: 0, start: 31, end: 79 }],
    });
    expect(result.facts[1]!.fact).toMatchObject({
      to: 'Battlefield',
      annotations: [{ target: 'oracle', line: 0, start: 54, end: 79 }],
    });
    const line = input.oracleText.split('\n')[0]!;
    expect(line.slice(31, 79)).toBe('Put a +1/+1 counter on up to one target creature');
    expect(line.slice(54, 79)).toBe('up to one target creature');
  });

  it('accepts Ride the Shoopuf — "put a +1/+1 counter on target creature you control" (owner: you; source/sink split into disjoint spans)', () => {
    const input = structuralInput('Ride the Shoopuf', rideTheShoopuf);
    const result = recognizePutCounterTargetEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({
      event: 'putCounter',
      counterType: '+1/+1',
      target: { types: { has: ['Creature'] } },
      annotations: [{ target: 'oracle', line: 0, start: 47, end: 85 }],
    });
    expect(result.facts[1]!.fact).toMatchObject({
      to: 'Battlefield',
      annotations: [{ target: 'oracle', line: 0, start: 70, end: 85 }],
    });
    const line = input.oracleText.split('\n')[0]!;
    expect(line.slice(47, 85)).toBe('put a +1/+1 counter on target creature');
    expect(line.slice(70, 85)).toBe('target creature');
  });

  it('accepts Rosa, Resolute White Mage — "put a +1/+1 counter on target creature you control. It gains lifelink..." (stops at the typeWord, doesn\'t swallow the trailing sentence; source/sink split into disjoint spans)', () => {
    const input = structuralInput('Rosa, Resolute White Mage', rosaResoluteWhiteMage);
    const result = recognizePutCounterTargetEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({
      event: 'putCounter',
      counterType: '+1/+1',
      target: { types: { has: ['Creature'] } },
      annotations: [{ target: 'oracle', line: 1, start: 41, end: 79 }],
    });
    expect(result.facts[1]!.fact).toMatchObject({
      to: 'Battlefield',
      annotations: [{ target: 'oracle', line: 1, start: 64, end: 79 }],
    });
    const line = input.oracleText.split('\n')[1]!;
    expect(line.slice(41, 79)).toBe('put a +1/+1 counter on target creature');
    expect(line.slice(64, 79)).toBe('target creature');
  });

  it("accepts Prishe's Wanderings — \"put a +1/+1 counter on target creature you control\" (second effect in the container, but preceded by a 'move' search, not a tapTarget; ALSO a real over-broad-SOURCE-anchor fix, 2026-09-16 — the old, unbounded gap crossed the period after this card's own EARLIER, unrelated \"put it onto the battlefield tapped, then shuffle\" sentence, anchoring to the wrong \"put\")", () => {
    const input = structuralInput("Prishe's Wanderings", prisheSWanderings);
    const result = recognizePutCounterTargetEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({
      event: 'putCounter',
      counterType: '+1/+1',
      target: { types: { has: ['Creature'] } },
      annotations: [{ target: 'oracle', line: 0, start: 145, end: 183 }],
    });
    expect(result.facts[1]!.fact).toMatchObject({
      to: 'Battlefield',
      annotations: [{ target: 'oracle', line: 0, start: 168, end: 183 }],
    });
    const line = input.oracleText.split('\n')[0]!;
    expect(line.slice(145, 183)).toBe('put a +1/+1 counter on target creature');
    expect(line.slice(168, 183)).toBe('target creature');
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

describe('putCounterTarget-effect-structural — pronoun-carryover branch (2026-09-16, real, closed — see module doc comment; explicitly NOT covered by the 2026-09-16 source/sink split fix above — no in-clause object-phrase exists to split off, see module doc comment\'s own "source/sink split fix" section)', () => {
  it('accepts Ice Flan — "Put a stun counter on it," constraint derived off the preceding tapTarget\'s own creature-or-artifact validType (no sink — no confirmed typeWord for creature-or-artifact even here)', () => {
    const result = recognizePutCounterTargetEffectStructural(structuralInput('Ice Flan', iceFlan));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'putCounter',
          counterType: 'stun',
          target: { types: { hasAny: ['Creature', 'Artifact'] } },
          targeted: true,
          annotations: [{ target: 'oracle', line: expect.any(Number), start: expect.any(Number), end: expect.any(Number) }],
          // `Fact.triggeredBy` (2026-09-16, "widen populate" pass) — Ice
          // Flan's own real "When Ice Flan enters..." trigger.
          triggeredBy: 'onEnter',
        },
        provenance: { origin: 'parser', rule: 'putCounterTarget-effect-structural' },
      },
      {
        role: 'sink',
        fact: {
          to: 'Battlefield',
          types: { hasAny: ['Creature', 'Artifact'] },
          annotations: [{ target: 'oracle', line: expect.any(Number), start: expect.any(Number), end: expect.any(Number) }],
        },
        provenance: { origin: 'parser', rule: 'putCounterTarget-effect-structural' },
      },
    ]);
  });

  it('accepts Omega, Heartless Evolution — "Put X stun counters on each of those permanents," constraint derived off the preceding tapTarget\'s own creature-or-artifact validType, non-literal (Computed) amount does not trip the non-positive guard', () => {
    const result = recognizePutCounterTargetEffectStructural(structuralInput('Omega, Heartless Evolution', omegaHeartlessEvolution));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'putCounter', counterType: 'Stun', target: { types: { hasAny: ['Creature', 'Artifact'] } }, targeted: true });
    expect(result.facts[1]!.fact).toMatchObject({ to: 'Battlefield', types: { hasAny: ['Creature', 'Artifact'] } });
  });

  it('accepts Summon: Shiva — chapters I/II share the identical real "Tap target creature ... Put a stun counter on it" clause, constraint derived off the preceding tapTarget\'s own plain creature validType (real sink this time, unlike Ice Flan/Omega\'s creature-or-artifact)', () => {
    const result = recognizePutCounterTargetEffectStructural(structuralInput('Summon: Shiva', summonShiva));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const putCounterFacts = result.facts.filter((f) => f.fact.event === 'putCounter');
    expect(putCounterFacts.length).toBeGreaterThan(0);
    for (const f of putCounterFacts) {
      if (f.role === 'source') expect(f.fact).toMatchObject({ counterType: 'stun', target: { types: { has: ['Creature'] } }, targeted: true });
      else expect(f.fact).toMatchObject({ to: 'Battlefield', types: { has: ['Creature'] } });
    }
  });
});

describe('putCounterTarget-effect-structural — structural scope declines (never reach \'mismatch\')', () => {
  it('declines a card with no putCounterTarget effect at all', () => {
    const result = recognizePutCounterTargetEffectStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '' } as CardDefinition as unknown as StructuralRecognizerInput);
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no kind:"putCounterTarget"') });
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
