// Unit tests for `scripts/check-verified-regressions.mjs`'s pure diff
// logic — the physical (structural deep-equality, never AI/semantic
// "looks the same") regression guard behind a human-reviewed card's own
// `verified-snapshot.json`. See that file's own header and
// `.claude/contracts/card-schema.md`'s "Verified-snapshot regression
// guard" section for the full mechanism; the real fs orchestration
// (`checkAllVerifiedSnapshots`, glob + auto-reset `progress.json`) is
// exercised end-to-end via a live pool run, not re-tested here — same
// "the checker itself has real teeth" discipline `annotation-coverage.test.ts`
// already established for its own sibling check.
import { describe, expect, it } from 'vitest';
// Deliberately plain JS, not `.ts` — no vite-node/tsx dependency needed to
// run this script standalone (`node functional-model/scripts/
// check-verified-regressions.mjs`), same convention `annotation-coverage.mjs`
// already established.
import { deepEqual, diffFactList, diffSnapshot } from './scripts/check-verified-regressions.mjs';

describe('check-verified-regressions — deepEqual', () => {
  it('treats differently-ordered object keys as equal', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('treats differently-ordered arrays as NOT equal (order-sensitive)', () => {
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('detects a nested field change', () => {
    const a = { annotations: [{ target: 'oracle', line: 1, start: 22, end: 69 }] };
    const b = { annotations: [{ target: 'oracle', line: 1, start: 22, end: 68 }] };
    expect(deepEqual(a, b)).toBe(false);
  });

  it('real fixture: identical facts round-tripped through JSON are equal', () => {
    const fact = { to: 'Battlefield', event: 'entersBattlefield', controller: 'you', subject: { token: 'c_1_1_hero' }, annotations: [{ target: 'oracle', line: 1, start: 22, end: 69 }], provenance: { origin: 'parser', rule: 'token-creation-structural' } };
    expect(deepEqual(fact, JSON.parse(JSON.stringify(fact)))).toBe(true);
  });
});

describe('check-verified-regressions — diffFactList', () => {
  it('reports no changes for two identical lists', () => {
    const list = [{ event: 'drawCard' }];
    expect(diffFactList(list, JSON.parse(JSON.stringify(list)))).toEqual([]);
  });

  it('reports a CHANGED entry (old vs new) when one fact in place differs — the real, motivating case', () => {
    const oldList = [{ event: 'entersBattlefield', annotations: [{ target: 'oracle', line: 1, start: 22, end: 69 }] }];
    const newList = [{ event: 'entersBattlefield', annotations: [{ target: 'oracle', line: 1, start: 22, end: 68 }] }];
    expect(diffFactList(oldList, newList)).toEqual([{ index: 0, kind: 'changed', old: oldList[0], new: newList[0] }]);
  });

  it('reports an ADDED entry when the new list is longer', () => {
    const oldList = [{ event: 'drawCard' }];
    const newList = [{ event: 'drawCard' }, { event: 'destroy' }];
    expect(diffFactList(oldList, newList)).toEqual([{ index: 1, kind: 'added', new: { event: 'destroy' } }]);
  });

  it('reports a REMOVED entry when the new list is shorter', () => {
    const oldList = [{ event: 'drawCard' }, { event: 'destroy' }];
    const newList = [{ event: 'drawCard' }];
    expect(diffFactList(oldList, newList)).toEqual([{ index: 1, kind: 'removed', old: { event: 'destroy' } }]);
  });

  it('a reordering of the SAME two facts is reported as changes at both indices, never treated as a no-op ("Facts stay text-ordered" — a reorder IS a real regression)', () => {
    const factA = { event: 'drawCard' };
    const factB = { event: 'destroy' };
    const diff = diffFactList([factA, factB], [factB, factA]);
    expect(diff).toEqual([
      { index: 0, kind: 'changed', old: factA, new: factB },
      { index: 1, kind: 'changed', old: factB, new: factA },
    ]);
  });
});

describe('check-verified-regressions — diffSnapshot', () => {
  it('matches when source/sink/annotatedNonFactSpans are all byte-identical to the snapshot', () => {
    const snapshot = { capturedAt: '2026-09-16T00:00:00.000Z', facts: { source: [{ event: 'drawCard' }], sink: [] } };
    const current = { facts: { source: [{ event: 'drawCard' }], sink: [] } };
    expect(diffSnapshot(snapshot, current).matches).toBe(true);
  });

  it('flags a mismatch when a source fact changes, real fixture shape (aerith-rescue-mission-style annotation offset drift)', () => {
    const snapshot = {
      capturedAt: '2026-09-16T00:00:00.000Z',
      facts: {
        source: [{ to: 'Battlefield', event: 'entersBattlefield', controller: 'you', subject: { token: 'c_1_1_hero' }, annotations: [{ target: 'oracle', line: 1, start: 22, end: 69 }], provenance: { origin: 'parser', rule: 'token-creation-structural' } }],
        sink: [],
      },
    };
    const current = {
      facts: {
        source: [{ to: 'Battlefield', event: 'entersBattlefield', controller: 'you', subject: { token: 'c_1_1_hero' }, annotations: [{ target: 'oracle', line: 1, start: 22, end: 68 }], provenance: { origin: 'parser', rule: 'token-creation-structural' } }],
        sink: [],
      },
    };
    const diff = diffSnapshot(snapshot, current);
    expect(diff.matches).toBe(false);
    expect(diff.source).toHaveLength(1);
    expect(diff.source[0].kind).toBe('changed');
    expect(diff.sink).toEqual([]);
  });

  it('flags a mismatch when annotatedNonFactSpans changes even though facts are untouched', () => {
    const snapshot = { facts: { source: [], sink: [] }, annotatedNonFactSpans: [{ target: 'oracle', line: 0, start: 0, end: 10, kind: 'lore', note: 'flavor' }] };
    const current = { facts: { source: [], sink: [] }, annotatedNonFactSpans: [] };
    const diff = diffSnapshot(snapshot, current);
    expect(diff.matches).toBe(false);
    expect(diff.annotatedNonFactSpans).toHaveLength(1);
    expect(diff.annotatedNonFactSpans[0].kind).toBe('removed');
  });

  it('treats a snapshot with no annotatedNonFactSpans and a current card with none either as matching (both absent, not a false mismatch)', () => {
    const snapshot = { facts: { source: [{ event: 'destroy' }], sink: [] } };
    const current = { facts: { source: [{ event: 'destroy' }], sink: [] } };
    expect(diffSnapshot(snapshot, current).matches).toBe(true);
  });
});
