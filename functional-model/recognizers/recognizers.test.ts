// Verifies the two `PRD_AUTOMATED_AUTHORING.md` prototype recognizers
// against REAL FIN cards' own printed text (`data/fin/fin_scryfall.json` —
// the same real Scryfall source `scripts/compute-annotations.mjs` reads
// from, not a hand-typed fixture), including at least one real edge case
// each recognizer correctly DECLINES — see each recognizer's own module doc
// comment for the full reasoning trail behind every case below.
import { describe, expect, it } from 'vitest';
import { recognizeInstantSorceryResolvesToGraveyard } from './instant-sorcery-resolves-to-graveyard';
// `.mjs`, not `.ts` — see that file's own header for why (a real, harmless
// TS7016 "implicitly any" import, same convention `annotation-coverage.test
// .ts`/`scenario-card-names.test.ts` already accept for their own `.mjs`
// imports).
import { loadFinCards } from './load-fin-cards.mjs';
import { recognizePermanentEntersBattlefieldNormally } from './permanent-enters-battlefield-normally';
import type { RecognizerInput } from './types';

const finCards = loadFinCards();

function faceOf(cardName: string, face: 'front' | 'back' = 'front'): RecognizerInput {
  const card = finCards.get(cardName);
  if (!card) throw new Error(`fixture setup bug: "${cardName}" not found in data/fin/fin_scryfall.json`);
  const f = face === 'back' ? card.back : card.front;
  if (!f) throw new Error(`fixture setup bug: "${cardName}" has no ${face} face`);
  // A face's own printed name for a two-faced card is its OWN half's name,
  // not the combined "Front // Back" Scryfall key this map is indexed by —
  // mirrors `compute-annotations.mjs`'s own real DFC-name-reconstruction
  // comment (`lookupName`), just in the opposite direction.
  const ownName = cardName.includes(' // ') ? cardName.split(' // ')[face === 'back' ? 1 : 0]!.trim() : cardName;
  return { name: ownName, typeLine: f.typeLine, oracleText: f.oracleText, isBackFace: face === 'back' };
}

describe('Recognizer A — instant/sorcery resolves to its owner\'s graveyard normally', () => {
  const accept = [
    'Battle Menu',
    "Auron's Inspiration", // Flashback — normal cast still resolves to graveyard as usual
    'Dreams of Laguna', // Flashback
    'Syncopate', // "exile it" refers to the COUNTERED spell, not itself
    'Retrieve the Esper', // "cast from a graveyard" bonus clause, not an override of the normal case
    'From Father to Son', // same
    "Relm's Sketching",
    "Moogles' Valor",
  ];

  it.each(accept)('accepts real card: %s', (name) => {
    const result = recognizeInstantSorceryResolvesToGraveyard(faceOf(name));
    expect(result.matched, `expected a match for "${name}", got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      { role: 'source', fact: { event: 'cast', from: 'Hand', target: 'self', annotations: [{ target: 'typeLine', start: 0, end: expect.any(Number) }] }, provenance: { origin: 'parser', rule: 'instant-sorcery-resolves-to-graveyard' } },
      { role: 'source', fact: { to: 'Graveyard', controller: 'you', subject: 'self', annotations: [{ target: 'typeLine', start: 0, end: expect.any(Number) }] }, provenance: { origin: 'parser', rule: 'instant-sorcery-resolves-to-graveyard' } },
    ]);
    // Annotation-as-byproduct: the claimed span, sliced straight out of the
    // real printed typeLine, really does read "Instant" or "Sorcery" — no
    // separately-authored string involved anywhere in this path.
    const input = faceOf(name);
    const { start, end } = result.facts[0]!.fact.annotations[0] as { start: number; end: number };
    expect(['Instant', 'Sorcery']).toContain(input.typeLine.slice(start, end));
  });

  it('declines a real Adventure instant/sorcery half (CR 715.3d — exiled, not put into the graveyard)', () => {
    const result = recognizeInstantSorceryResolvesToGraveyard(faceOf('Ishgard, the Holy See // Faith & Grief', 'back'));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('Adventure') });
  });

  it('declines Ultima — its own reminder text says "including this card" is exiled, not put into the graveyard', () => {
    const result = recognizeInstantSorceryResolvesToGraveyard(faceOf('Ultima'));
    expect(result.matched).toBe(false);
  });

  it('declines a non-instant/sorcery permanent', () => {
    const result = recognizeInstantSorceryResolvesToGraveyard(faceOf('Ahriman'));
    expect(result.matched).toBe(false);
  });
});

describe('Recognizer B — permanent enters the battlefield normally when cast', () => {
  const accept = [
    'Ahriman',
    'Dwarven Castle Guard',
    'Cloudbound Moogle', // has a plain ETB trigger — does NOT disqualify
    'Ice Flan', // same
    'Adelbert Steiner', // Legendary — supertype must not leak into the span
    "Astrologian's Planisphere", // Artifact — Equipment
    'Cargo Ship', // Artifact — Vehicle
    'Summon: Bahamut', // a Saga — "As this Saga enters..." is a real trigger, not a replacement effect
    'Torgal, A Fine Hound', // "that creature enters with..." is about ANOTHER creature, not itself
  ];

  it.each(accept)('accepts real card: %s', (name) => {
    const result = recognizePermanentEntersBattlefieldNormally(faceOf(name));
    expect(result.matched, `expected a match for "${name}", got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts[0]!.fact).toMatchObject({ event: 'cast', from: 'Hand', target: 'self' });
    expect(result.facts[1]!.fact).toMatchObject({ event: 'entersBattlefield', to: 'Battlefield', controller: 'you', subject: 'self', target: 'self' });
    for (const rf of result.facts) expect(rf.provenance).toEqual({ origin: 'parser', rule: 'permanent-enters-battlefield-normally' });
  });

  it('declines "enters tapped" (Shambling Cie\'th) — matches today\'s existing hand-authored data (no self-cast/self-enters pair)', () => {
    const result = recognizePermanentEntersBattlefieldNormally(faceOf("Shambling Cie'th"));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('replacement effect') });
  });

  it('declines "enters tapped with a stun counter" (Tonberry) — matches today\'s existing hand-authored data', () => {
    const result = recognizePermanentEntersBattlefieldNormally(faceOf('Tonberry'));
    expect(result.matched).toBe(false);
  });

  it('declines "enters with a counter" named by its own card name (Zack Fair) — CR 614.12 replacement effect, per the task\'s own stated criteria (a deliberate, documented divergence from today\'s existing hand-authored data for this one card)', () => {
    const result = recognizePermanentEntersBattlefieldNormally(faceOf('Zack Fair'));
    expect(result.matched).toBe(false);
  });

  it('declines a Land (played, not cast — recognizer is scoped to permanents entering VIA casting)', () => {
    const result = recognizePermanentEntersBattlefieldNormally(faceOf('Ishgard, the Holy See // Faith & Grief', 'front'));
    expect(result.matched).toBe(false);
  });

  it('declines a plain Instant/Sorcery (not a permanent at all)', () => {
    const result = recognizePermanentEntersBattlefieldNormally(faceOf('Battle Menu'));
    expect(result.matched).toBe(false);
  });

  it('declines a real transforming DFC\'s own back face (CR 712/711 — 2026-09-13 overclaim-bug fix): the back face never gets independently cast/enters, only via transforming the already-on-battlefield front face', () => {
    const result = recognizePermanentEntersBattlefieldNormally(faceOf("Jill, Shiva's Dominant // Shiva, Warden of Ice", 'back'));
    expect(result).toEqual({ matched: false, reason: expect.stringContaining('back face') });
  });

  it('still accepts that SAME transform DFC\'s own front face — the back-face exemption above is front/back-scoped, not whole-card', () => {
    const result = recognizePermanentEntersBattlefieldNormally(faceOf("Jill, Shiva's Dominant // Shiva, Warden of Ice", 'front'));
    expect(result.matched, `expected a match, got: ${!result.matched && result.reason}`).toBe(true);
  });
});
