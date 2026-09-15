// Verifies Recognizer E (`saga-lore-and-sacrifice-structural.ts`) against
// real FIN Sagas' own already-typed `CardDefinition`s (imported directly,
// same "read THIS APP'S OWN structure" convention Recognizers C/D's own test
// files already establish), paired with real printed `typeLine` off
// `data/fin/fin_scryfall.json` purely to build this recognizer's own input
// (this recognizer never reads `oracleText` at all — see its own module doc
// comment — but the shared `StructuralRecognizerInput` shape still carries
// one, same as every other recognizer in this family).
import { describe, expect, it } from 'vitest';
import { ahriman } from '../cards/ahriman/definition';
import { crystalFragmentsSummonAlexander } from '../cards/crystal-fragments-summon-alexander/definition';
import { dionBahamutsDominant } from '../cards/dion-bahamut-s-dominant-bahamut-warden-of-light/definition';
import { jechtReluctantGuardian } from '../cards/jecht-reluctant-guardian-braska-s-final-aeon/definition';
import { jillShivasDominant } from '../cards/jill-shiva-s-dominant-shiva-warden-of-ice/definition';
import { summonBahamut } from '../cards/summon-bahamut/definition';
import { summonBrynhildr } from '../cards/summon-brynhildr/definition';
import { summonLeviathan } from '../cards/summon-leviathan/definition';
import type { CardDefinition } from '../card';
// `.mjs`, not `.ts` — see `load-fin-cards.mjs`'s own header for why (same
// convention every other recognizer test file in this directory accepts for
// this same import).
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizeSagaLoreAndSacrificeStructural, type StructuralRecognizerInput } from './saga-lore-and-sacrifice-structural';

const finCards = loadFinCards();

/** Builds this recognizer's own `StructuralRecognizerInput` for one face:
 * the real printed `typeLine` off Scryfall (`loadFinCards`, same source every
 * other recognizer's own tests use) PLUS the real `triggers` straight off the
 * given `CardDefinition` half (the front object itself, or its own
 * `backFace`) — never a hand-typed stand-in for either half. `oracleText` is
 * carried through only because `StructuralRecognizerInput` requires it; this
 * recognizer never reads it (see its own module doc comment). */
function structuralInput(scryfallName: string, def: CardDefinition, face: 'front' | 'back' = 'front'): StructuralRecognizerInput {
  const card = finCards.get(scryfallName);
  if (!card) throw new Error(`fixture setup bug: "${scryfallName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${scryfallName}" has no ${face} face`);
  return { name: def.name, typeLine: f.typeLine, oracleText: f.oracleText, effects: def.effects, triggers: def.triggers, abilities: def.abilities };
}

describe('Recognizer E — Saga lore-counter + sacrifice/dies, read structurally off typeLine + triggers (not oracle text)', () => {
  it('accepts Summon: Bahamut — a plain Saga, chapter IV (final) has no custom effect: full lore + sacrifice + dies triple', () => {
    const result = recognizeSagaLoreAndSacrificeStructural(structuralInput('Summon: Bahamut', summonBahamut));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const annotations = [{ target: 'typeLine', start: 23, end: 27 }];
    expect(result.facts).toEqual([
      { role: 'source', fact: { event: 'putCounter', counterType: 'LORE', target: 'self', annotations }, provenance: { origin: 'parser', rule: 'saga-lore-and-sacrifice-structural' } },
      { role: 'source', fact: { event: 'sacrifice', target: 'self', annotations }, provenance: { origin: 'parser', rule: 'saga-lore-and-sacrifice-structural' } },
      {
        role: 'source',
        fact: { event: 'dies', from: 'Battlefield', to: 'Graveyard', controller: 'you', subject: 'self', target: 'self', annotations },
        provenance: { origin: 'parser', rule: 'saga-lore-and-sacrifice-structural' },
      },
    ]);
    // Real byproduct check, same discipline every other recognizer's own
    // test uses: the claimed span really does read the literal word "Saga".
    const input = structuralInput('Summon: Bahamut', summonBahamut);
    expect(input.typeLine.slice(23, 27)).toBe('Saga');
  });

  it('accepts Summon: Brynhildr — a plain Saga, chapter III (final) is a real no-op `custom` (no delayed-cast-watching mechanism in this engine): lore-only, no sacrifice/dies', () => {
    const result = recognizeSagaLoreAndSacrificeStructural(structuralInput('Summon: Brynhildr', summonBrynhildr));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: { event: 'putCounter', counterType: 'LORE', target: 'self', annotations: [{ target: 'typeLine', start: 23, end: 27 }] },
        provenance: { origin: 'parser', rule: 'saga-lore-and-sacrifice-structural' },
      },
    ]);
  });

  it('declines the sacrifice+dies pair for Summon: Leviathan — chapter III (final) is a real `custom` granted-delayed-trigger no-op for an UNRELATED reason (not a transform-back); a real, deliberate divergence from this card\'s own existing hand-authored sacrifice+dies facts, per this recognizer\'s own conservative rule', () => {
    const result = recognizeSagaLoreAndSacrificeStructural(structuralInput('Summon: Leviathan', summonLeviathan));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact).toMatchObject({ event: 'putCounter', counterType: 'LORE', target: 'self' });
  });

  it("accepts Braska's Final Aeon (Jecht's own back face) — a transforming Saga whose final chapter III is a plain `sacrifice` Effect (no custom at all) — does NOT transform back (saga.ts's own header names this exact card): full triple, not a false negative", () => {
    const backDef = jechtReluctantGuardian.backFace!;
    const result = recognizeSagaLoreAndSacrificeStructural(structuralInput("Jecht, Reluctant Guardian // Braska's Final Aeon", backDef, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(3);
    expect(result.facts.map((f) => f.fact.event)).toEqual(['putCounter', 'sacrifice', 'dies']);
    const annotations = [{ target: 'typeLine', start: 33, end: 37 }];
    expect(result.facts[0]!.fact.annotations).toEqual(annotations);
  });

  it('declines the sacrifice+dies pair for Shiva, Warden of Ice (Jill\'s own back face) — a transforming Saga that REALLY transforms back (chapter III exiles then returns it): lore-only', () => {
    const backDef = jillShivasDominant.backFace!;
    const result = recognizeSagaLoreAndSacrificeStructural(structuralInput('Jill, Shiva\'s Dominant // Shiva, Warden of Ice', backDef, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
  });

  it('declines the sacrifice+dies pair for Bahamut, Warden of Light (Dion\'s own back face) — same real transform-back shape as Shiva: lore-only', () => {
    const backDef = dionBahamutsDominant.backFace!;
    const result = recognizeSagaLoreAndSacrificeStructural(structuralInput('Dion, Bahamut\'s Dominant // Bahamut, Warden of Light', backDef, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(1);
  });

  it('accepts the sacrifice+dies pair for Summon: Alexander (Crystal Fragments\' own back face) — chapter III\'s real `program` (`Each` over `opponents.creaturesInPlay()`, "tap all creatures your opponents control") is a real, structurally-distinguishable NON-Sequence program, not a transform-back, so 2026-09-15\'s `chapterHasCustomEffect` refinement no longer blocks it', () => {
    const backDef = crystalFragmentsSummonAlexander.backFace!;
    const result = recognizeSagaLoreAndSacrificeStructural(structuralInput('Crystal Fragments // Summon: Alexander', backDef, 'back'));
    expect(result.matched, `got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toHaveLength(3);
  });

  it('declines the front face of a transforming Saga (Jecht, Reluctant Guardian himself) — the FRONT face is not itself a Saga at all, only the back face is', () => {
    const result = recognizeSagaLoreAndSacrificeStructural(structuralInput('Jecht, Reluctant Guardian // Braska\'s Final Aeon', jechtReluctantGuardian, 'front'));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no "Saga" subtype') });
  });

  it('declines a real non-Saga permanent (Ahriman)', () => {
    const result = recognizeSagaLoreAndSacrificeStructural(structuralInput('Ahriman', ahriman));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no "Saga" subtype') });
  });

  it('declines a synthetic "Saga" typeLine with no recognized chapter trigger at all (defensive — no real card in the pool hits this)', () => {
    const input: StructuralRecognizerInput = { name: 'Fake Saga', typeLine: 'Enchantment Creature — Saga Test', oracleText: '', triggers: [{ name: 'onEnter', effects: [] }] };
    const result = recognizeSagaLoreAndSacrificeStructural(input);
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('no named chapterI..chapterV trigger') });
  });
});
