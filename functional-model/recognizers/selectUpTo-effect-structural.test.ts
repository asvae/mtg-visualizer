// New test file (2026-09-16, causal-links "widen populate" pass) — this
// recognizer had no dedicated test file at all before this pass, despite
// being real, wired, production code (`apply-recognizers.mjs`'s own
// registry) — see its own module doc comment for the whole-pool check this
// covers (`aerith-rescue-mission` is the ONE real `kind:'program'`/
// `SelectUpTo` card in the pool). Covers the one real accept, a real
// decline, and `Fact.triggeredBy` (2026-09-16 widening): this card's own
// qualifying effect sits inside a top-level `modal` mode, NOT a `Trigger`,
// so `triggeredBy` is correctly absent — a real, honest negative case, not
// just a theoretical one.
//
// **2026-09-16 SECOND widening (same day)** — the accept case now asserts 3
// facts, not 2: the `each(bound, tap())` step's own new `{event:'tap',...}`
// SOURCE fact. Exact offsets computed directly off the real oracle text
// substring, not guessed (`line2.slice(30,62)` === "Tap up to three target
// creatures", `line2.slice(64,97)` === "Put a stun counter on one of them").
//
// **2026-09-17 revision (real user-reported bug)** — the SINK used to reuse
// the tap SOURCE's own whole-clause span (including the "Tap" verb). Fixed:
// SINK now anchors to just the narrower object-phrase, `line2.slice(34,62)`
// === "up to three target creatures" — same "source keeps the whole clause,
// sink narrows to the object-phrase only" split this catalog's other fixes
// already establish.
import { describe, expect, it } from 'vitest';
import { aerithRescueMission } from '../cards/aerith-rescue-mission/definition';
import { zackFair } from '../cards/zack-fair/definition';
import type { CardDefinition } from '../card';
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeSelectUpToEffectStructural, type StructuralRecognizerInput } from './selectUpTo-effect-structural';

const finCards = loadFinCards();

function structuralInput(scryfallName: string, def: CardDefinition): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  return { name: def.name, typeLine: card.front.typeLine, oracleText: card.front.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('selectUpTo-effect-structural', () => {
  it('accepts Aerith Rescue Mission — "tap up to three target creatures, put a stun counter on one of them" — no triggeredBy (this effect sits in a top-level modal mode, not a Trigger)', () => {
    const result = recognizeSelectUpToEffectStructural(structuralInput('Aerith Rescue Mission', aerithRescueMission));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(3);
    const [tapFact, counterFact, sinkFact] = result.facts;
    expect(tapFact!.role).toBe('source');
    expect(tapFact!.fact).toMatchObject({
      event: 'tap',
      target: { types: { has: ['Creature'] } },
      targeted: true,
      annotations: [{ target: 'oracle', line: 2, start: 30, end: 62 }],
    });
    expect(tapFact!.fact.triggeredBy).toBeUndefined();
    expect(counterFact!.role).toBe('source');
    expect(counterFact!.fact).toMatchObject({
      event: 'putCounter',
      counterType: 'stun',
      target: { types: { has: ['Creature'] } },
      targeted: true,
      annotations: [{ target: 'oracle', line: 2, start: 64, end: 97 }],
    });
    expect(counterFact!.fact.triggeredBy).toBeUndefined();
    expect(sinkFact!.role).toBe('sink');
    expect(sinkFact!.fact).toMatchObject({
      to: 'Battlefield',
      types: { has: ['Creature'] },
      annotations: [{ target: 'oracle', line: 2, start: 34, end: 62 }],
    });
    expect(sinkFact!.fact.triggeredBy).toBeUndefined();
    const line = structuralInput('Aerith Rescue Mission', aerithRescueMission).oracleText.split('\n')[2]!;
    expect(line.slice(30, 62)).toBe('Tap up to three target creatures');
    expect(line.slice(34, 62)).toBe('up to three target creatures');
  });

  it('declines Zack Fair — a real kind:"program" effect exists on this face, but its own program is not a SelectUpTo shape this recognizer covers', () => {
    const result = recognizeSelectUpToEffectStructural(structuralInput('Zack Fair', zackFair));
    expect(result.matched).toBe(false);
  });
});
