// New test file (2026-09-15, fin/16-25 pass) — closes a real pre-existing
// gap: `pumpTarget-effect-structural.ts` had NO test file at all despite
// being wired into the real pool since its own creation. Written now
// because this same pass changed its own core matching logic (real
// `untilEndOfTurn`/compound-clause tolerance fix, `d`-flag capture-group
// indices) — see that file's own module doc comment for the full story.
//
// **2026-09-16 REVISED** — the SOURCE/SINK annotation convention flipped
// (user-reported, Battle Menu the motivating real card; see the
// recognizer's own module doc comment for the full reasoning, same flip as
// `putCounterTarget-effect-structural.ts`/`pumpAllAttacking-effect-
// structural.ts` the same day): SOURCE now anchors the FULL matched clause,
// SINK now anchors only the narrow subject/target phrase. Every accepted
// card below now asserts BOTH spans by exact offset (string-sliced against
// each card's own real Scryfall oracle text, not `toMatchObject`) — plus
// two real cards this file's own recognizer doc comment had missed from its
// whole-pool tally (`tifa-s-limit-break`'s "Somersault" mode,
// `galuf-s-final-act`) are now covered too.
import { describe, expect, it } from 'vitest';
import { battleMenu } from '../cards/battle-menu/definition';
import { overkill } from '../cards/overkill/definition';
import { blitzballShot } from '../cards/blitzball-shot/definition';
import { hasteMagic } from '../cards/haste-magic/definition';
import { gladiolusAmicitia } from '../cards/gladiolus-amicitia/definition';
import { magicDamper } from '../cards/magic-damper/definition';
import { sidequestPlayBlitzball } from '../cards/sidequest-play-blitzball-world-champion-celestial-weapon/definition';
import { summonPrimalGaruda } from '../cards/summon-primal-garuda/definition';
import { tifasLimitBreak } from '../cards/tifa-s-limit-break/definition';
import { galufsFinalAct } from '../cards/galuf-s-final-act/definition';
import { cloudOfDarkness } from '../cards/cloud-of-darkness/definition';
import { summonTitan } from '../cards/summon-titan/definition';
import type { CardDefinition } from '../card';
import type { Fact } from '../synergy';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizePumpTargetEffectStructural, type StructuralRecognizerInput } from './pumpTarget-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

/** Real string-slice against the oracle text an annotation claims to point
 * at — same discipline every span assertion in this file uses, never a
 * hand-typed offset trusted on faith. */
function annotationText(input: StructuralRecognizerInput, fact: Fact): string {
  const ann = fact.annotations?.[0];
  if (!ann) throw new Error('expected at least one annotation');
  if (ann.target !== 'oracle') throw new Error('expected an oracle-text annotation');
  const line = input.oracleText.split('\n')[ann.line];
  if (line === undefined) throw new Error(`annotation line ${ann.line} out of range`);
  return line.slice(ann.start, ann.end);
}

describe('pumpTarget-effect-structural', () => {
  it('accepts Battle Menu (plain "Target creature gets +0/+4 until end of turn", no connector)', () => {
    const input = structuralInput('Battle Menu', battleMenu);
    const result = recognizePumpTargetEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const pumpFacts = result.facts.filter((f) => f.role === 'source');
    expect(pumpFacts).toHaveLength(1);
    expect(pumpFacts[0]!.fact).toMatchObject({ event: 'pump', target: { types: { has: ['Creature'] } } });
    // SOURCE = full clause, SINK = narrow subject phrase (2026-09-16 revised
    // convention, user-reported off this exact card).
    expect(annotationText(input, pumpFacts[0]!.fact)).toBe('Target creature gets +0/+4 until end of turn');
    const sinkFact = result.facts.find((f) => f.role === 'sink')!;
    expect(annotationText(input, sinkFact.fact)).toBe('Target creature');
  });

  it('accepts Overkill ("-0/-9999" real sign-symmetry templating)', () => {
    const input = structuralInput('Overkill', overkill);
    const result = recognizePumpTargetEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const sourceFact = result.facts.find((f) => f.role === 'source')!;
    const sinkFact = result.facts.find((f) => f.role === 'sink')!;
    expect(annotationText(input, sourceFact.fact)).toBe('Target creature gets -0/-9999 until end of turn');
    expect(annotationText(input, sinkFact.fact)).toBe('Target creature');
  });

  it('accepts Blitzball Shot (compound clause, "gets +3/+3 AND GAINS TRAMPLE until end of turn" — real untilEndOfTurn + connector-tolerance fix)', () => {
    const input = structuralInput('Blitzball Shot', blitzballShot);
    const result = recognizePumpTargetEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const sourceFact = result.facts.find((f) => f.role === 'source')!;
    const sinkFact = result.facts.find((f) => f.role === 'sink')!;
    // SOURCE now covers the WHOLE compound clause (not just "gets +3/+3") —
    // confirmed against the real oracle text below.
    expect(annotationText(input, sourceFact.fact)).toBe('Target creature gets +3/+3 and gains trample until end of turn');
    expect(annotationText(input, sinkFact.fact)).toBe('Target creature');
  });

  it('accepts Haste Magic (same compound-clause shape, different keyword)', () => {
    const input = structuralInput('Haste Magic', hasteMagic);
    const result = recognizePumpTargetEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const sourceFact = result.facts.find((f) => f.role === 'source')!;
    const sinkFact = result.facts.find((f) => f.role === 'sink')!;
    expect(annotationText(input, sourceFact.fact)).toBe('Target creature gets +3/+1 and gains haste until end of turn');
    expect(annotationText(input, sinkFact.fact)).toBe('Target creature');
  });

  it('accepts Gladiolus Amicitia ("another target creature you control gets +2/+2 and gains trample until end of turn" — owner:"you", notSelf:true)', () => {
    const input = structuralInput('Gladiolus Amicitia', gladiolusAmicitia);
    const result = recognizePumpTargetEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const pumpFact = result.facts.find((f) => f.role === 'source')!;
    expect(pumpFact.fact).toMatchObject({ event: 'pump', controller: 'you', target: { types: { has: ['Creature'] }, excludeSelf: true } });
    const sinkFact = result.facts.find((f) => f.role === 'sink')!;
    expect(sinkFact.fact).toMatchObject({ to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, excludeSelf: true });
    expect(annotationText(input, pumpFact.fact)).toBe('another target creature you control gets +2/+2 and gains trample until end of turn');
    expect(annotationText(input, sinkFact.fact)).toBe('another target creature you control');
  });

  it('accepts Magic Damper ("Target creature you control gets +1/+1 and gains hexproof until end of turn" — owner:"you", no notSelf)', () => {
    const input = structuralInput('Magic Damper', magicDamper);
    const result = recognizePumpTargetEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const pumpFact = result.facts.find((f) => f.role === 'source')!;
    expect(pumpFact.fact).toMatchObject({ event: 'pump', controller: 'you', target: { types: { has: ['Creature'] } } });
    expect((pumpFact.fact.target as { excludeSelf?: boolean })?.excludeSelf).toBeUndefined();
    const sinkFact = result.facts.find((f) => f.role === 'sink')!;
    expect(annotationText(input, pumpFact.fact)).toBe('Target creature you control gets +1/+1 and gains hexproof until end of turn');
    expect(annotationText(input, sinkFact.fact)).toBe('Target creature you control');
  });

  it('accepts Sidequest: Play Blitzball ("target creature you control gets +2/+0 until end of turn" — owner:"you", no notSelf)', () => {
    const input = structuralInput('Sidequest: Play Blitzball // World Champion, Celestial Weapon', sidequestPlayBlitzball);
    const result = recognizePumpTargetEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const sourceFact = result.facts.find((f) => f.role === 'source')!;
    const sinkFact = result.facts.find((f) => f.role === 'sink')!;
    expect(annotationText(input, sourceFact.fact)).toBe('target creature you control gets +2/+0 until end of turn');
    expect(annotationText(input, sinkFact.fact)).toBe('target creature you control');
  });

  it('accepts Summon: Primal Garuda ("Another target creature you control gets +1/+0 and gains flying until end of turn" — Saga chapter trigger, owner:"you", notSelf:true)', () => {
    const input = structuralInput('Summon: Primal Garuda', summonPrimalGaruda);
    const result = recognizePumpTargetEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const pumpFact = result.facts.find((f) => f.role === 'source')!;
    expect(pumpFact.fact).toMatchObject({ event: 'pump', controller: 'you', target: { types: { has: ['Creature'] }, excludeSelf: true } });
    const sinkFact = result.facts.find((f) => f.role === 'sink')!;
    expect(annotationText(input, pumpFact.fact)).toBe('Another target creature you control gets +1/+0 and gains flying until end of turn');
    expect(annotationText(input, sinkFact.fact)).toBe('Another target creature you control');
  });

  it('accepts Tifa\'s Limit Break ("Somersault" mode, "Target creature gets +2/+2 until end of turn" — a plain literal-P/T pumpTarget nested inside a modal container; real card missed by this recognizer\'s own earlier whole-pool tally)', () => {
    const input = structuralInput("Tifa's Limit Break", tifasLimitBreak);
    const result = recognizePumpTargetEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const sourceFact = result.facts.find((f) => f.role === 'source')!;
    const sinkFact = result.facts.find((f) => f.role === 'sink')!;
    expect(annotationText(input, sourceFact.fact)).toBe('Target creature gets +2/+2 until end of turn');
    expect(annotationText(input, sinkFact.fact)).toBe('Target creature');
  });

  it('accepts Galuf\'s Final Act ("Until end of turn, target creature gets +1/+0 and gains ..." — a LEADING "until end of turn," not the trailing shape this recognizer\'s untilEndOfTurn tail supports; effect.untilEndOfTurn is unset so no trailing-tail requirement is built, and the bare "target creature gets +1/+0" clause still matches once)', () => {
    const input = structuralInput("Galuf's Final Act", galufsFinalAct);
    const result = recognizePumpTargetEffectStructural(input);
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const sourceFact = result.facts.find((f) => f.role === 'source')!;
    const sinkFact = result.facts.find((f) => f.role === 'sink')!;
    expect(annotationText(input, sourceFact.fact)).toBe('target creature gets +1/+0');
    expect(annotationText(input, sinkFact.fact)).toBe('target creature');
  });

  it('declines Cloud of Darkness (owner:"opponents" — no confirmed template for that owner value; also moot, Computed power)', () => {
    const result = recognizePumpTargetEffectStructural(structuralInput('Cloud of Darkness', cloudOfDarkness));
    expect(result.matched).toBe(false);
  });

  it('declines Summon: Titan (notSelf:true chapter III — moot, Computed X power/toughness)', () => {
    const result = recognizePumpTargetEffectStructural(structuralInput('Summon: Titan', summonTitan));
    expect(result.matched).toBe(false);
  });

  it('declines a card with no pumpTarget effect at all on this face', () => {
    const result = recognizePumpTargetEffectStructural({ name: 'Ahriman', typeLine: 'Creature', oracleText: '' });
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'pumpTarget'") });
  });
});
