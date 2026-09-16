// New test file (2026-09-16, coordinator-routed follow-up — this
// recognizer had no dedicated test file at all before this pass, despite
// being real, wired, production code). Covers the 4 real confirmed accepts
// plus the CR 108.4 gate this same pass added (see module doc comment) —
// not an exhaustive re-derivation of every real decline the module doc
// comment already documents in prose.
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../card';
import { ambrosiaWhiteheart } from '../cards/ambrosia-whiteheart/definition';
import { eject } from '../cards/eject/definition';
import { iceMagic } from '../cards/ice-magic/definition';
import { jillShivasDominant } from '../cards/jill-shiva-s-dominant-shiva-warden-of-ice/definition';
import { magicPot } from '../cards/magic-pot/definition';
import { phoenixDown } from '../cards/phoenix-down/definition';
import { whiteAuracite } from '../cards/white-auracite/definition';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeMoveEffectStructural, type StructuralRecognizerInput } from './move-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const faceData = face === 'front' ? card.front : card.back!;
  return { name: def.name, typeLine: faceData.typeLine, oracleText: faceData.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('move-effect-structural — kind:"move", target:true', () => {
  it('accepts Ambrosia Whiteheart\'s own Battlefield-sourced "return another permanent you control" — annotation widened (2026-09-16) to also cover the "return" verb and "to its owner\'s hand" destination clause, not just the object phrase', () => {
    const result = recognizeMoveEffectStructural(structuralInput('Ambrosia Whiteheart', ambrosiaWhiteheart));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const input = structuralInput('Ambrosia Whiteheart', ambrosiaWhiteheart);
    const { line, start, end } = result.facts[0]!.fact.annotations![0] as { line: number; start: number; end: number };
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe("return another permanent you control to its owner's hand");
  });

  it('accepts White Auracite\'s own Battlefield-sourced "target nonland permanent an opponent controls" — `to:\'Exile\'` needs no destination clause at all, annotation stays the bare object phrase (unaffected by the 2026-09-16 widening)', () => {
    const result = recognizeMoveEffectStructural(structuralInput('White Auracite', whiteAuracite));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const input = structuralInput('White Auracite', whiteAuracite);
    const { line, start, end } = result.facts[0]!.fact.annotations![0] as { line: number; start: number; end: number };
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe('target nonland permanent an opponent controls');
  });

  it('accepts Jill, Shiva\'s Dominant\'s own owner-omitted Battlefield-sourced "up to one other target nonland permanent" — annotation widened to also cover "return" and "to its owner\'s hand"', () => {
    const result = recognizeMoveEffectStructural(structuralInput("Jill, Shiva's Dominant // Shiva, Warden of Ice", jillShivasDominant));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const input = structuralInput("Jill, Shiva's Dominant // Shiva, Warden of Ice", jillShivasDominant);
    const { line, start, end } = result.facts[0]!.fact.annotations![0] as { line: number; start: number; end: number };
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe("return up to one other target nonland permanent to its owner's hand");
  });

  it('accepts Eject\'s own owner-omitted "target nonland permanent" — annotation widened to also cover "Return" and "to its owner\'s hand"', () => {
    const result = recognizeMoveEffectStructural(structuralInput('Eject', eject));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const input = structuralInput('Eject', eject);
    const { line, start, end } = result.facts[0]!.fact.annotations![0] as { line: number; start: number; end: number };
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe("Return target nonland permanent to its owner's hand");
  });

  it('accepts all 3 modes of Ice Magic — Blizzard (to:\'Hand\') widened to include "Return"/"to its owner\'s hand"; Blizzara/Blizzaga (to:\'Library\', 2026-09-16 widening) now also widened to their own full "\'s owner puts it on..."/"\'s owner shuffles it into..." destination clauses, a closed 2-string alternation confirmed against this one real card', () => {
    const result = recognizeMoveEffectStructural(structuralInput('Ice Magic', iceMagic));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts.length).toBeGreaterThan(0);
    const input = structuralInput('Ice Magic', iceMagic);
    const lines = input.oracleText.split('\n');
    const sourceFacts = result.facts.filter((f) => f.role === 'source');
    expect(sourceFacts).toHaveLength(3);
    const [blizzard, blizzara, blizzaga] = sourceFacts;
    const spanText = (f: (typeof sourceFacts)[number]) => {
      const { line, start, end } = f.fact.annotations![0] as { line: number; start: number; end: number };
      return lines[line]!.slice(start, end);
    };
    expect(spanText(blizzard!)).toBe("Return target creature to its owner's hand");
    expect(spanText(blizzara!)).toBe("Target creature's owner puts it on their choice of the top or bottom of their library");
    expect(spanText(blizzaga!)).toBe("Target creature's owner shuffles it into their library");
  });

  it('accepts BOTH of Phoenix Down\'s own modes (2026-09-16, 3-piece widening) — mode 1\'s own real "from your graveyard"/`maxCmc`/card-vs-permanent carve-out unblocks the whole face, letting mode 2\'s pre-existing subtype-array support finally be reached too', () => {
    const result = recognizeMoveEffectStructural(structuralInput('Phoenix Down', phoenixDown));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const input = structuralInput('Phoenix Down', phoenixDown);
    const lines = input.oracleText.split('\n');
    const sourceFacts = result.facts.filter((f) => f.role === 'source');
    expect(sourceFacts).toHaveLength(2);
    const [mode1, mode2] = sourceFacts;
    const spanText = (f: (typeof sourceFacts)[number]) => {
      const { line, start, end } = f.fact.annotations![0] as { line: number; start: number; end: number };
      return lines[line]!.slice(start, end);
    };
    expect(spanText(mode1!)).toBe('Return target creature card with mana value 4 or less from your graveyard to the battlefield tapped');
    expect(mode1!.fact).toMatchObject({
      from: 'Graveyard',
      to: 'Battlefield',
      event: 'entersBattlefield',
      controller: 'you',
      target: { types: { has: ['Creature'] }, cmc: { max: 4 } },
      targeted: true,
    });
    expect(spanText(mode2!)).toBe('target Skeleton, Spirit, or Zombie');
    expect(mode2!.fact).toMatchObject({ from: 'Battlefield', to: 'Exile', target: { types: { hasAny: ['Skeleton', 'Spirit', 'Zombie'] } }, targeted: true });
    const sinkFacts = result.facts.filter((f) => f.role === 'sink');
    expect(sinkFacts).toHaveLength(2);
    expect(sinkFacts).toContainEqual(expect.objectContaining({ fact: expect.objectContaining({ to: 'Graveyard', controller: 'you', types: { has: ['Creature'] }, cmc: { max: 4 } }) }));
    expect(sinkFacts).toContainEqual(expect.objectContaining({ fact: expect.objectContaining({ to: 'Battlefield', types: { hasAny: ['Skeleton', 'Spirit', 'Zombie'] } }) }));
  });

  it('declines Magic Pot the same way (owner:"you", from:"Graveyard") — kind:"scope", not kind:"mismatch"', () => {
    const result = recognizeMoveEffectStructural(structuralInput('Magic Pot', magicPot));
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.kind).not.toBe('mismatch');
  });

  // 2026-09-16 (recognizer-lane triage) — `typeWordFor`/`buildTargetConstraint`
  // gained real `subtype` array support (Phoenix Down's own real mode 2,
  // "Exile target Skeleton, Spirit, or Zombie" — `move.subtype: string[]`).
  // Exercised via a SYNTHETIC single-effect input, not Phoenix Down's own
  // real 2-mode `modal` Effect, kept as-is even after the same-day follow-up
  // pass that closed mode 1 too (see the "accepts BOTH of Phoenix Down's own
  // modes" test above) — this synthetic case still independently proves the
  // subtype-array widening works in true isolation (a single-effect face,
  // no `modal` wrapper, no interaction with mode 1's own separate gate).
  it('accepts a synthetic 3-word subtype-array move effect ("Exile target Skeleton, Spirit, or Zombie") — proves the widening works in isolation, independent of Phoenix Down\'s own now-passing real card (see the test above)', () => {
    const input: StructuralRecognizerInput = {
      name: 'Synthetic Test Card',
      typeLine: 'Instant',
      oracleText: 'Exile target Skeleton, Spirit, or Zombie.',
      effects: [{ kind: 'move', from: 'Battlefield', to: 'Exile', qty: 1, subtype: ['Skeleton', 'Spirit', 'Zombie'], target: true }],
    };
    const result = recognizeMoveEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const source = result.facts.find((f) => f.role === 'source')!;
    expect(source.fact).toMatchObject({ from: 'Battlefield', to: 'Exile', target: { types: { hasAny: ['Skeleton', 'Spirit', 'Zombie'] } }, targeted: true });
    const { line, start, end } = source.fact.annotations![0] as { line: number; start: number; end: number };
    expect(input.oracleText.split('\n')[line]!.slice(start, end)).toBe('target Skeleton, Spirit, or Zombie');
  });

  it('declines a synthetic 2-word subtype array (no confirmed 2-way join template)', () => {
    const input: StructuralRecognizerInput = {
      name: 'Synthetic Test Card',
      typeLine: 'Instant',
      oracleText: 'Exile target Skeleton or Zombie.',
      effects: [{ kind: 'move', from: 'Battlefield', to: 'Exile', qty: 1, subtype: ['Skeleton', 'Zombie'], target: true }],
    };
    const result = recognizeMoveEffectStructural(input);
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no confirmed structural') });
  });
});
