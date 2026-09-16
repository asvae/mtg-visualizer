// Unit tests for `scripts/text-coverage.mjs`'s pure `computeTextCoverage` —
// the informational "does this card's own real oracle text have a
// substantial clause with zero fact/annotation anywhere" signal (see that
// file's own header for the full rationale, and `.claude/contracts/
// card-schema.md`'s "factsTextCoverage" section for the resulting
// `progress.json` field this feeds). Deliberately NOT wired to hard-fail
// the pool (see `verify-text-coverage.mjs`'s own header) — this test file
// only exercises the pure function's own real behavior, same "the checker
// itself has real teeth" discipline `annotation-coverage.test.ts` already
// established for its own sibling check.
import { describe, expect, it } from 'vitest';
import { computeTextCoverage } from './scripts/text-coverage.mjs';

describe('text-coverage — computeTextCoverage', () => {
  it('flags Ashe, Princess of Dalmasca\'s own real, confirmed gap (the "look at the top five..."/"Put the rest on the bottom..." clauses)', () => {
    const oracleText = 'Whenever Ashe attacks, look at the top five cards of your library. You may reveal an artifact card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.';
    const facts = {
      source: [{ to: 'Hand', from: 'Library', controller: 'you', types: { has: ['Artifact'] }, annotations: [{ target: 'oracle', line: 0, start: 75, end: 140 }] }],
      sink: [
        { to: 'Library', controller: 'you', types: { has: ['Artifact'] }, annotations: [{ target: 'oracle', line: 0, start: 75, end: 98 }] },
        { event: 'attacks', target: 'self', annotations: [{ target: 'oracle', line: 0, start: 0, end: 21 }] },
      ],
    };
    const { ratio, gaps } = computeTextCoverage(facts, { front: oracleText });
    expect(ratio).toBeLessThan(0.5);
    expect(gaps.map((g: any) => g.text)).toEqual([', look at the top five cards of your library. You may', '. Put the rest on the bottom of your library in a random order.']);
  });

  it('reports full (1.0) coverage when every real character is covered', () => {
    const oracleText = 'Draw a card.';
    const facts = { source: [{ event: 'drawCard', controller: 'you', annotations: [{ target: 'oracle', line: 0, start: 0, end: 12 }] }], sink: [] };
    const { ratio, gaps } = computeTextCoverage(facts, { front: oracleText });
    expect(ratio).toBe(1);
    expect(gaps).toEqual([]);
  });

  it('treats parenthetical reminder text as always-covered, never a reported gap', () => {
    const oracleText = 'Flying (This creature can only be blocked by creatures with flying or reach.)';
    const facts = { source: [], sink: [] };
    const { gaps } = computeTextCoverage(facts, { front: oracleText });
    // "Flying" itself (6 chars, real, unannotated, but under the 20-char
    // post-label threshold — see that threshold's own doc comment) stays
    // unflagged; the reminder text is masked out entirely regardless of
    // length.
    expect(gaps).toEqual([]);
  });

  it('does not merge two DIFFERENT real gaps separated by a covered span into one', () => {
    const oracleText = 'AAAAAAAAAAAAAAAAAAAA covered BBBBBBBBBBBBBBBBBBBB';
    const facts = { source: [{ event: 'x', annotations: [{ target: 'oracle', line: 0, start: 21, end: 29 }] }], sink: [] };
    const { gaps } = computeTextCoverage(facts, { front: oracleText });
    expect(gaps.map((g: any) => g.text)).toEqual(['AAAAAAAAAAAAAAAAAAAA', 'BBBBBBBBBBBBBBBBBBBB']);
  });

  it('ignores a face with no oracle text supplied (undefined) rather than throwing', () => {
    const facts = { source: [{ event: 'drawCard', controller: 'you', annotations: [{ target: 'oracle', line: 0, start: 0, end: 12 }] }], sink: [] };
    const { ratio, gaps } = computeTextCoverage(facts, { front: 'Draw a card.', back: undefined });
    expect(ratio).toBe(1);
    expect(gaps).toEqual([]);
  });

  describe('nonFactAnnotations (2026-09-16, annotation-taxonomy plumbing)', () => {
    // Ultima, Origin of Oblivion's own real, motivating gap: "For as long as
    // that land has a blight counter on it, it loses all land types and
    // abilities and has "{T}: Add {C}."" is real, mechanically-enforced
    // (CounterConditionalGrant/hasCounterConditionalLandTypeLoss, card.ts/
    // state.ts) but deliberately carries no Fact of its own — see
    // ENGINE_GAPS.md's "Counter-conditional continuous effects" entry.
    const oracleText =
      'Whenever Ultima attacks, put a blight counter on target land. For as long as that land has a blight counter on it, it loses all land types and abilities and has "{T}: Add {C}."';
    // Real annotation spans from cards/ultima-origin-of-oblivion/synergy.json
    // itself ('attacks' sink 0-23, 'putCounter' source 25-60) — not invented
    // for this test.
    const facts = {
      source: [{ event: 'putCounter', counterType: 'blight', annotations: [{ target: 'oracle', line: 0, start: 25, end: 60 }] }],
      sink: [{ event: 'attacks', target: 'self', annotations: [{ target: 'oracle', line: 0, start: 0, end: 23 }] }],
    };

    it('reports the real gap when no nonFactAnnotations are supplied (baseline, matches the pre-fix live behavior)', () => {
      const { gaps } = computeTextCoverage(facts, { front: oracleText });
      expect(gaps).toHaveLength(1);
      expect(gaps[0]!.text).toContain('For as long as that land has a blight counter on it');
    });

    it('closes the gap when a definition-path nonFactAnnotation covers the same span, with zero Fact involved', () => {
      const nonFactAnnotations = [{ target: 'oracle', line: 0, start: 62, end: 176, kind: 'definition-path', note: 'CounterConditionalGrant/hasCounterConditionalLandTypeLoss' }];
      const { gaps } = computeTextCoverage(facts, { front: oracleText }, nonFactAnnotations);
      expect(gaps).toEqual([]);
    });

    it('a `face` mismatch (defaults to \'front\') still leaves the gap open — same scoping a real Fact.face already gets', () => {
      const nonFactAnnotations = [{ target: 'oracle', line: 0, start: 62, end: 176, face: 'back', kind: 'definition-path', note: 'wrong face on purpose' }];
      const { gaps } = computeTextCoverage(facts, { front: oracleText }, nonFactAnnotations);
      expect(gaps).toHaveLength(1);
    });

    it('a `target:\'typeLine\'` nonFactAnnotation is a legitimate no-op here (this function never scans a type line at all)', () => {
      const nonFactAnnotations = [{ target: 'typeLine', start: 0, end: 5, kind: 'lore', note: 'irrelevant to oracle-text coverage' }];
      const { gaps } = computeTextCoverage(facts, { front: oracleText }, nonFactAnnotations);
      expect(gaps).toHaveLength(1); // unchanged — the real oracle-text gap is still open
    });
  });
});
