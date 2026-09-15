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
});
