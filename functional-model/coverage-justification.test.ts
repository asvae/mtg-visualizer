// Unit tests for `coverage-justification.ts`'s pure, fs-free verification
// core — `validateCoverageJustification(definition, entries, texts)` — the
// real, span-verified successor to the old inline-field
// `validateCoverageJustification(definition)` whose own tests used to live
// in `validate-card-definition.test.ts` (see that file's own header for the
// pointer). Real, fs-backed end-to-end coverage (loading a real
// `justification.json` + the real, checked-in `data/fdn/fdn_scryfall.json`)
// is exercised live via `gate-and-write-status.mjs --all` against the 5 real
// POC cards, not re-tested here — this file is scoped to the pure
// character-level/pointer-resolution logic against synthetic fixtures (same
// "predicate corpus uses mocks" convention `validate-card-definition.test.ts`
// itself already follows).
import { describe, expect, it } from 'vitest';
import { validateCoverageJustification, type CoverageJustificationEntry, type JustificationTexts } from './coverage-justification';
import type { CardDefinition } from './card';

function mockDefinition(overrides: Partial<CardDefinition>): CardDefinition {
  return { name: 'Mock Card', manaCost: '{1}', typeLine: 'Creature — Mock', ...overrides } as CardDefinition;
}

function entry(overrides: Partial<CoverageJustificationEntry>): CoverageJustificationEntry {
  return {
    type: 'definition',
    textLocation: 'oracle_text',
    spans: [{ from: 0, to: 8, text: 'Test ability' }],
    definitionKeys: [{ kind: 'keyword', keyword: 'Flying' }],
    reasoning: 'real reasoning',
    ...overrides,
  } as CoverageJustificationEntry;
}

describe('validateCoverageJustification', () => {
  it('fails when entries is missing entirely', () => {
    const result = validateCoverageJustification(mockDefinition({}), null, { front: {} });
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toContain('missing/empty justification manifest');
  });

  it('fails when entries is an explicitly empty array', () => {
    const result = validateCoverageJustification(mockDefinition({}), [], { front: {} });
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toContain('missing/empty justification manifest');
  });

  it('passes for a single, fully-covering, exact-matching span', () => {
    const def = mockDefinition({ keywords: ['Flying'] });
    const texts: JustificationTexts = { front: { oracle_text: 'Flying' } };
    const entries: CoverageJustificationEntry[] = [
      entry({ spans: [{ from: 0, to: 6, text: 'Flying' }], definitionKeys: [{ kind: 'keyword', keyword: 'Flying' }] }),
    ];
    expect(validateCoverageJustification(def, entries, texts)).toEqual({ ok: true, reasons: [] });
  });

  it('fails loudly when a span text does not exactly match the real text at that offset', () => {
    const def = mockDefinition({ keywords: ['Flying'] });
    const texts: JustificationTexts = { front: { oracle_text: 'Flying' } };
    const entries: CoverageJustificationEntry[] = [entry({ spans: [{ from: 0, to: 6, text: 'Flyingg' }] })];
    const result = validateCoverageJustification(def, entries, texts);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('does not match the real text'))).toBe(true);
  });

  it('fails on a real uncovered gap (non-punctuation/non-whitespace text with no claiming span)', () => {
    const def = mockDefinition({ keywords: ['Flying'] });
    const texts: JustificationTexts = { front: { oracle_text: 'Flying and Haste' } };
    const entries: CoverageJustificationEntry[] = [entry({ spans: [{ from: 0, to: 6, text: 'Flying' }] })];
    const result = validateCoverageJustification(def, entries, texts);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('not claimed by any entry') && r.includes('Haste'))).toBe(true);
  });

  it('tolerates punctuation/whitespace falling outside any span', () => {
    const def = mockDefinition({ keywords: ['Flying', 'Haste'] });
    const texts: JustificationTexts = { front: { oracle_text: 'Flying, haste.' } };
    const entries: CoverageJustificationEntry[] = [
      entry({ spans: [{ from: 0, to: 6, text: 'Flying' }], definitionKeys: [{ kind: 'keyword', keyword: 'Flying' }] }),
      entry({ spans: [{ from: 8, to: 13, text: 'haste' }], definitionKeys: [{ kind: 'keyword', keyword: 'Haste' as never }] }),
    ];
    expect(validateCoverageJustification(def, entries, texts)).toEqual({ ok: true, reasons: [] });
  });

  it('fails on overlapping spans (a character double-claimed by two entries)', () => {
    const def = mockDefinition({ keywords: ['Flying'] });
    const texts: JustificationTexts = { front: { oracle_text: 'Flying' } };
    const entries: CoverageJustificationEntry[] = [
      entry({ spans: [{ from: 0, to: 6, text: 'Flying' }] }),
      entry({ spans: [{ from: 3, to: 6, text: 'ing' }] }),
    ];
    const result = validateCoverageJustification(def, entries, texts);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('overlap'))).toBe(true);
  });

  it('supports a real multi-span entry — two disjoint spans under one coverage claim, with the uncovered middle declared separately (Arahbo-class case)', () => {
    const def = mockDefinition({
      triggers: [{ name: 'onEnter', on: 'enter', effects: [{ kind: 'drawCard', amount: 1 }] }],
      missingSchemaFunctionality: [{ clause: 'the gap half', demand: 'a real demand' }],
    } as Partial<CardDefinition>);
    const text = 'Whenever Arahbo or another Cat enters, make a token.';
    const texts: JustificationTexts = { front: { oracle_text: text } };
    const entries: CoverageJustificationEntry[] = [
      entry({
        spans: [
          { from: 0, to: 15, text: 'Whenever Arahbo' },
          { from: 31, to: 51, text: 'enters, make a token' },
        ],
        definitionKeys: [{ kind: 'trigger', name: 'onEnter' }],
      }),
      entry({
        type: 'rules',
        spans: [{ from: 16, to: 30, text: 'or another Cat' }],
        definitionKeys: [{ kind: 'missingSchemaFunctionality', index: 0 }],
      }),
    ];
    expect(validateCoverageJustification(def, entries, texts)).toEqual({ ok: true, reasons: [] });
  });

  it('does not require type_line coverage to be complete (a partial type_line entry set is fine)', () => {
    const def = mockDefinition({ typeLine: 'Legendary Creature — Cat Avatar' });
    const texts: JustificationTexts = { front: { oracle_text: '', type_line: def.typeLine } };
    const entries: CoverageJustificationEntry[] = [
      entry({ type: 'lore', textLocation: 'type_line', spans: [{ from: 0, to: 9, text: 'Legendary' }], definitionKeys: undefined }),
    ];
    expect(validateCoverageJustification(def, entries, texts)).toEqual({ ok: true, reasons: [] });
  });

  it('still overlap-checks type_line spans even though full coverage is not required there', () => {
    const def = mockDefinition({ typeLine: 'Legendary Creature' });
    const texts: JustificationTexts = { front: { oracle_text: '', type_line: def.typeLine } };
    const entries: CoverageJustificationEntry[] = [
      entry({ type: 'lore', textLocation: 'type_line', spans: [{ from: 0, to: 9, text: 'Legendary' }], definitionKeys: undefined }),
      entry({ type: 'lore', textLocation: 'type_line', spans: [{ from: 5, to: 18, text: 'ary Creature' }], definitionKeys: undefined }),
    ];
    const result = validateCoverageJustification(def, entries, texts);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('overlap'))).toBe(true);
  });

  it('fails when a definition/rules entry has no real, non-empty definitionKeys', () => {
    const def = mockDefinition({ keywords: ['Flying'] });
    const texts: JustificationTexts = { front: { oracle_text: 'Flying' } };
    const entries: CoverageJustificationEntry[] = [entry({ spans: [{ from: 0, to: 6, text: 'Flying' }], definitionKeys: [] })];
    const result = validateCoverageJustification(def, entries, texts);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('has no real, non-empty `definitionKeys`'))).toBe(true);
  });

  it('fails when a lore entry declares non-empty definitionKeys', () => {
    const def = mockDefinition({});
    const texts: JustificationTexts = { front: { oracle_text: '(reminder text)' } };
    const entries: CoverageJustificationEntry[] = [
      entry({ type: 'lore', spans: [{ from: 0, to: 15, text: '(reminder text)' }], definitionKeys: [{ kind: 'keyword', keyword: 'Flying' }] }),
    ];
    const result = validateCoverageJustification(def, entries, texts);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes("type:'lore' but declares non-empty"))).toBe(true);
  });

  it('fails when a definitionKeys pointer names a keyword the card does not actually have', () => {
    const def = mockDefinition({ keywords: ['Haste'] });
    const texts: JustificationTexts = { front: { oracle_text: 'Flying' } };
    const entries: CoverageJustificationEntry[] = [entry({ spans: [{ from: 0, to: 6, text: 'Flying' }], definitionKeys: [{ kind: 'keyword', keyword: 'Flying' }] })];
    const result = validateCoverageJustification(def, entries, texts);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes("not present in this card's own"))).toBe(true);
  });

  it('resolves every real CoverageReference kind: trigger, ability, effect, field, missingSchemaFunctionality, staticAbilities', () => {
    const def = mockDefinition({
      triggers: [{ name: 'onEnter', on: 'enter', effects: [{ kind: 'drawCard', amount: 1 }] }],
      abilities: [{ name: 'tapAbility', cost: '{T}', effects: [{ kind: 'drawCard', amount: 1 }] }],
      effects: [{ kind: 'drawCard', amount: 1 }],
      continuousPTGrants: [{ power: 1, toughness: 1 }],
      missingSchemaFunctionality: [{ clause: 'a gap', demand: 'a demand' }],
    } as Partial<CardDefinition>);
    const text = 'trigger ability effect field gap';
    const texts: JustificationTexts = { front: { oracle_text: text } };
    const entries: CoverageJustificationEntry[] = [
      entry({ spans: [{ from: 0, to: 7, text: 'trigger' }], definitionKeys: [{ kind: 'trigger', name: 'onEnter' }] }),
      entry({ spans: [{ from: 8, to: 15, text: 'ability' }], definitionKeys: [{ kind: 'ability', name: 'tapAbility' }] }),
      entry({ spans: [{ from: 16, to: 22, text: 'effect' }], definitionKeys: [{ kind: 'effect', effectKind: 'drawCard' }] }),
      entry({ spans: [{ from: 23, to: 28, text: 'field' }], definitionKeys: [{ kind: 'field', field: 'continuousPTGrants' }] }),
      entry({ type: 'rules', spans: [{ from: 29, to: 32, text: 'gap' }], definitionKeys: [{ kind: 'missingSchemaFunctionality', index: 0 }] }),
    ];
    expect(validateCoverageJustification(def, entries, texts)).toEqual({ ok: true, reasons: [] });
  });

  it('fails when a real missingSchemaFunctionality entry has no justification entry referencing it', () => {
    const def = mockDefinition({ keywords: ['Ward'], missingSchemaFunctionality: [{ clause: 'Ward—Pay 7 life.', demand: 'cost-payload field' }] });
    const texts: JustificationTexts = { front: { oracle_text: 'Ward' } };
    const entries: CoverageJustificationEntry[] = [entry({ spans: [{ from: 0, to: 4, text: 'Ward' }], definitionKeys: [{ kind: 'keyword', keyword: 'Ward' }] })];
    const result = validateCoverageJustification(def, entries, texts);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('has no justification entry referencing it'))).toBe(true);
  });

  it("fails when no real oracle_text is available for a face an entry claims (card not yet synced into data/fdn/fdn_scryfall.json)", () => {
    const def = mockDefinition({ keywords: ['Flying'] });
    const texts: JustificationTexts = { front: {} };
    const entries: CoverageJustificationEntry[] = [entry({ spans: [{ from: 0, to: 6, text: 'Flying' }] })];
    const result = validateCoverageJustification(def, entries, texts);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('no real "oracle_text" text available'))).toBe(true);
  });

  it("rejects a face:'back' entry on a card with no real backFace", () => {
    const def = mockDefinition({ keywords: ['Flying'] });
    const texts: JustificationTexts = { front: { oracle_text: 'Flying' } };
    const entries: CoverageJustificationEntry[] = [
      entry({ face: 'back', spans: [{ from: 0, to: 6, text: 'Flying' }] }),
    ];
    const result = validateCoverageJustification(def, entries, texts);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes("claims face:'back' but this card has no real backFace"))).toBe(true);
  });

  it('requires an independent, fully-covering manifest per face on a real two-faced card', () => {
    const def = mockDefinition({
      keywords: ['Flying'],
      backFace: mockDefinition({ name: 'Mock Back', keywords: ['Menace'] }),
    });
    const texts: JustificationTexts = { front: { oracle_text: 'Flying' }, back: { oracle_text: 'Menace' } };
    // Only the front face is covered — the back face's own real oracle text
    // has zero claiming entries.
    const entries: CoverageJustificationEntry[] = [entry({ spans: [{ from: 0, to: 6, text: 'Flying' }], definitionKeys: [{ kind: 'keyword', keyword: 'Flying' }] })];
    const result = validateCoverageJustification(def, entries, texts);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.startsWith('back/oracle_text:') && r.includes('Menace'))).toBe(true);

    const complete: CoverageJustificationEntry[] = [
      ...entries,
      entry({ face: 'back', spans: [{ from: 0, to: 6, text: 'Menace' }], definitionKeys: [{ kind: 'keyword', keyword: 'Menace' }] }),
    ];
    expect(validateCoverageJustification(def, complete, texts)).toEqual({ ok: true, reasons: [] });
  });
});
