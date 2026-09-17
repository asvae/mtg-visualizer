import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeEngineStatus } from './engine-status';

describe('computeEngineStatus — parses ENGINE_GAPS.md\'s own "Real gaps — prioritized" numbered list', () => {
  const entries = computeEngineStatus();

  it('finds every real numbered gap (29 as of 2026-09-17 — this number is expected to GROW over time as new gaps are added; it should never silently shrink)', () => {
    expect(entries.length).toBeGreaterThanOrEqual(29);
  });

  it('every entry has a stable, unique key and a real gap number', () => {
    const keys = new Set(entries.map((e) => e.key));
    expect(keys.size).toBe(entries.length);
    for (const e of entries) {
      expect(e.key).toMatch(new RegExp(`^gap-${e.gapNumber}-`));
      expect(e.gapNumber).toBeGreaterThan(0);
    }
  });

  it('every baseline is one of gray/purple/blue (never yellow/green — those are review-overlay only, computed in the server route, not here)', () => {
    for (const e of entries) {
      expect(['gray', 'purple', 'blue']).toContain(e.baseline);
    }
  });

  // Real, spot-checkable invariants tying the computed baseline back to the
  // exact textual signals this file's own header documents — not just
  // "some entries exist," but "the classification logic actually works."
  it('gray baseline entries have no CLOSED marker at all (real, still-open gaps)', () => {
    const grayEntries = entries.filter((e) => e.baseline === 'gray');
    expect(grayEntries.length).toBeGreaterThan(0);
    for (const e of grayEntries) {
      expect(e.evidence.hasClosedMarker).toBe(false);
    }
  });

  it('blue baseline entries have a CLOSED marker, at least one real *.test.ts citation, and no named remainder', () => {
    const blueEntries = entries.filter((e) => e.baseline === 'blue');
    expect(blueEntries.length).toBeGreaterThan(0);
    for (const e of blueEntries) {
      expect(e.evidence.hasClosedMarker).toBe(true);
      expect(e.evidence.testFiles.length).toBeGreaterThan(0);
      expect(e.evidence.hasNamedRemainder).toBe(false);
    }
  });

  it('purple baseline entries are CLOSED but either cite no test file or name a real remainder', () => {
    const purpleEntries = entries.filter((e) => e.baseline === 'purple');
    expect(purpleEntries.length).toBeGreaterThan(0);
    for (const e of purpleEntries) {
      expect(e.evidence.hasClosedMarker).toBe(true);
      expect(e.evidence.testFiles.length === 0 || e.evidence.hasNamedRemainder).toBe(true);
    }
  });

  // Spot-checks against specific, real, currently-known gap numbers — pins
  // this test to ENGINE_GAPS.md's OWN real content, not just this file's
  // own internal consistency. If ENGINE_GAPS.md's own prose for one of
  // these gaps changes (a remainder gets closed, a new test lands), this
  // is expected to need updating — that's a real, deliberate signal this
  // dashboard tracks change, not a flaky test.
  it('gap #19 (Mill) is blue — closed, with real state.ts/engine.ts test coverage, no remainder', () => {
    const mill = entries.find((e) => e.gapNumber === 19)!;
    expect(mill.baseline).toBe('blue');
    expect(mill.evidence.testFiles).toEqual(expect.arrayContaining(['state.test.ts']));
  });

  it('gap #26 (Meld) is gray — real, documented, explicitly not built', () => {
    const meld = entries.find((e) => e.gapNumber === 26)!;
    expect(meld.baseline).toBe('gray');
    expect(meld.title).toMatch(/Meld/);
  });

  it('gap #27 (grantKeywordAll attacking-creatures predicate) is purple — genuinely closed per-card, but not demonstrated by any shared *.test.ts, only a per-card scenario ENGINE_GAPS.md itself says was NOT re-run', () => {
    const g27 = entries.find((e) => e.gapNumber === 27)!;
    expect(g27.baseline).toBe('purple');
    expect(g27.evidence.hasClosedMarker).toBe(true);
    expect(g27.evidence.testFiles).toEqual([]);
  });

  it('gap #2 (state-based actions) is purple — closed for a narrow subset, with an explicit real remainder (704.5a/704.5i/attachment SBAs) named in the same item', () => {
    const sba = entries.find((e) => e.gapNumber === 2)!;
    expect(sba.baseline).toBe('purple');
    expect(sba.evidence.hasNamedRemainder).toBe(true);
  });

  it('every entry\'s sourceLine actually points at a real numbered-item line in ENGINE_GAPS.md', () => {
    const lines = readFileSync(join(process.cwd(), 'functional-model', 'ENGINE_GAPS.md'), 'utf8').split('\n');
    for (const e of entries) {
      expect(lines[e.evidence.sourceLine - 1]).toMatch(new RegExp(`^${e.gapNumber}\\.\\s`));
    }
  });
});
