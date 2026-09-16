// Verifies `untapTarget-effect-structural.ts` against the real match/
// declines its own module doc comment names.
import { describe, expect, it } from 'vitest';
import { magicDamper } from '../cards/magic-damper/definition';
import { sagesNouliths } from '../cards/sage-s-nouliths/definition';
import type { CardDefinition, Effect } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeUntapTargetEffectStructural, type StructuralRecognizerInput } from './untapTarget-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('untapTarget-effect-structural — real "Untap it." chained-pronoun template', () => {
  it('accepts Magic Damper — untapTarget immediately preceded by grantKeywordTarget with the identical owner/validType', () => {
    const result = recognizeUntapTargetEffectStructural(structuralInput('Magic Damper', magicDamper));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'untap', controller: 'you', target: { types: { has: ['Creature'] } }, targeted: true, annotations: [{ target: 'oracle', line: 0, start: 77, end: 85 }] },
        provenance: { origin: 'parser', rule: 'untapTarget-effect-structural' },
      },
    ]);
  });

  it('declines an untapTarget effect not preceded by a matching pumpTarget/grantKeywordTarget effect', () => {
    const def: CardDefinition = {
      name: 'Test Card',
      effects: [{ kind: 'untapTarget', validType: 'creature', owner: 'you' } satisfies Effect],
    };
    const result = recognizeUntapTargetEffectStructural(structuralInput('Magic Damper', def));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('not immediately preceded') });
  });

  it("declines validType other than 'creature'", () => {
    const def: CardDefinition = {
      name: 'Test Card',
      effects: [
        { kind: 'pumpTarget', power: 1, toughness: 1, owner: 'you' } satisfies Effect,
        { kind: 'untapTarget', validType: 'any', owner: 'you' } satisfies Effect,
      ],
    };
    const result = recognizeUntapTargetEffectStructural(structuralInput('Magic Damper', def));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no confirmed real English template") });
  });

  it('declines a card with no untapTarget effect at all on this face', () => {
    const result = recognizeUntapTargetEffectStructural(structuralInput('Magic Damper', { name: 'Ahriman' } as CardDefinition));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining("no kind:'untapTarget'") });
  });
});

describe("untapTarget-effect-structural — real \"untap target attacking creature\" non-chained template (2026-09-16, recognizer-lane escalation)", () => {
  it("accepts Sage's Nouliths — validType:'attacking', no chaining required, paired sink emitted; 2026-09-16 SOURCE/SINK split fix: source narrows to \"untap,\" sink narrows to \"target attacking creature\"", () => {
    const result = recognizeUntapTargetEffectStructural(structuralInput("Sage's Nouliths", sagesNouliths));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const untapFacts = result.facts.filter((f) => f.fact.event === 'untap' || (f.role === 'sink' && (f.fact as { attacking?: boolean }).attacking));
    expect(untapFacts).toHaveLength(2);
    const source = untapFacts.find((f) => f.role === 'source')!;
    const sink = untapFacts.find((f) => f.role === 'sink')!;
    // Oracle text (line 1): 'Equipped creature gets +1/+0, has "Whenever
    // this creature attacks, untap target attacking creature," and is a
    // Cleric in addition to its other types.' — [67,72)="untap" (source),
    // [73,98)="target attacking creature" (sink) — verified by direct
    // string-slice.
    expect(source.fact).toMatchObject({
      event: 'untap',
      target: { types: { has: ['Creature'] }, attacking: true },
      targeted: true,
      annotations: [{ target: 'oracle', line: 1, start: 67, end: 72 }],
    });
    expect((source.fact as { controller?: string }).controller).toBeUndefined();
    expect(sink.fact).toMatchObject({
      to: 'Battlefield',
      types: { has: ['Creature'] },
      attacking: true,
      annotations: [{ target: 'oracle', line: 1, start: 73, end: 98 }],
    });
  });
});
