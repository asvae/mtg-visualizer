import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyPipelineReview,
  assertPipelineStatusInvariants,
  pipelineStatusFromGateResult,
  readPipelineStatus,
  type PipelineStatusFile,
} from './pipeline-status';

describe('pipelineStatusFromGateResult', () => {
  it('ok:true -> blue, no reasons, no failureKind/engineGapsContext', () => {
    const entry = pipelineStatusFromGateResult({ ok: true, reasons: [] }, '2026-09-18T00:00:00.000Z');
    expect(entry.status).toBe('blue');
    expect(entry.reasons).toEqual([]);
    expect(entry.failureKind).toBeUndefined();
    expect(entry.engineGapsContext).toBeUndefined();
    expect(entry.computedAt).toBe('2026-09-18T00:00:00.000Z');
  });

  it("failureKind:'capacity-gap' -> purple, carrying the gate's own reasons/engineGapsContext straight through", () => {
    const engineGapsContext = { gray: ['Meld'], purple: ['Combat'] };
    const entry = pipelineStatusFromGateResult(
      { ok: false, failureKind: 'capacity-gap', reasons: ['unknown Effect kind: teleportPermanent'], engineGapsContext },
      '2026-09-18T00:00:00.000Z',
    );
    expect(entry.status).toBe('purple');
    expect(entry.failureKind).toBe('capacity-gap');
    expect(entry.reasons).toEqual(['unknown Effect kind: teleportPermanent']);
    expect(entry.engineGapsContext).toBe(engineGapsContext);
  });

  // The task's own explicit, load-bearing rule: 'other' must NEVER become
  // a status value (never silently 'purple', never anything else) —
  // it must hard-fail loudly, enforced here as a real throw, not
  // documentation.
  it("failureKind:'other' throws — NEVER silently becomes a pipeline status (never 'purple', never anything else)", () => {
    expect(() =>
      pipelineStatusFromGateResult({ ok: false, failureKind: 'other', reasons: ['missing required field: manaCost'] }),
    ).toThrow(/other.*never silently written/i);
  });

  it('defaults `now` to a real ISO timestamp when not supplied', () => {
    const entry = pipelineStatusFromGateResult({ ok: true, reasons: [] });
    expect(entry.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('applyPipelineReview', () => {
  const blueEntry: PipelineStatusFile = { status: 'blue', reasons: [], computedAt: '2026-09-18T00:00:00.000Z' };

  it("'ok' on a blue card -> green with reviewedAt", () => {
    const entry = applyPipelineReview(blueEntry, { verdict: 'ok' }, '2026-09-18T01:00:00.000Z');
    expect(entry.status).toBe('green');
    expect(entry.reviewedAt).toBe('2026-09-18T01:00:00.000Z');
    expect(entry.reviewNote).toBeUndefined();
  });

  it("'ok' honors an explicitly supplied reviewedAt over `now`", () => {
    const entry = applyPipelineReview(blueEntry, { verdict: 'ok', reviewedAt: '2026-01-01T00:00:00.000Z' }, '2026-09-18T01:00:00.000Z');
    expect(entry.reviewedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it("'not-ok' with a real note on a blue card -> yellow with reviewNote", () => {
    const entry = applyPipelineReview(blueEntry, { verdict: 'not-ok', reviewNote: 'sink query looks wrong for the trigger' });
    expect(entry.status).toBe('yellow');
    expect(entry.reviewNote).toBe('sink query looks wrong for the trigger');
    expect(entry.reviewedAt).toBeUndefined();
  });

  it("'not-ok' with an empty/whitespace-only note throws — a required field, not optional", () => {
    expect(() => applyPipelineReview(blueEntry, { verdict: 'not-ok', reviewNote: '   ' })).toThrow(/non-empty reviewNote/);
  });

  it.each(['gray', 'purple', 'yellow', 'green'] as const)('refuses any review action when current status is %s, not blue', (status) => {
    const entry: PipelineStatusFile = { status, reasons: [], computedAt: '2026-09-18T00:00:00.000Z' };
    expect(() => applyPipelineReview(entry, { verdict: 'ok' })).toThrow(/not 'blue'/);
    expect(() => applyPipelineReview(entry, { verdict: 'not-ok', reviewNote: 'x' })).toThrow(/not 'blue'/);
  });
});

describe('assertPipelineStatusInvariants', () => {
  it('accepts a well-formed purple/blue/gray/yellow/green entry', () => {
    const now = '2026-09-18T00:00:00.000Z';
    expect(() => assertPipelineStatusInvariants({ status: 'gray', reasons: [], computedAt: now })).not.toThrow();
    expect(() => assertPipelineStatusInvariants({ status: 'blue', reasons: [], computedAt: now })).not.toThrow();
    expect(() =>
      assertPipelineStatusInvariants({ status: 'purple', reasons: ['x'], failureKind: 'capacity-gap', computedAt: now }),
    ).not.toThrow();
    expect(() => assertPipelineStatusInvariants({ status: 'yellow', reasons: [], reviewNote: 'wrong', computedAt: now })).not.toThrow();
    expect(() => assertPipelineStatusInvariants({ status: 'green', reasons: [], reviewedAt: now, computedAt: now })).not.toThrow();
  });

  it("rejects a 'purple' entry missing failureKind", () => {
    expect(() => assertPipelineStatusInvariants({ status: 'purple', reasons: ['x'], computedAt: '2026-09-18T00:00:00.000Z' })).toThrow(
      /failureKind:'capacity-gap'/,
    );
  });

  it("rejects a 'purple' entry with no real reasons", () => {
    expect(() =>
      assertPipelineStatusInvariants({ status: 'purple', reasons: [], failureKind: 'capacity-gap', computedAt: '2026-09-18T00:00:00.000Z' }),
    ).toThrow(/at least one real reason/);
  });

  it('rejects failureKind stray-set on a non-purple entry', () => {
    expect(() =>
      assertPipelineStatusInvariants({ status: 'blue', reasons: [], failureKind: 'capacity-gap', computedAt: '2026-09-18T00:00:00.000Z' }),
    ).toThrow(/only be set on a 'purple' entry/);
  });

  it("rejects a 'yellow' entry missing reviewNote", () => {
    expect(() => assertPipelineStatusInvariants({ status: 'yellow', reasons: [], computedAt: '2026-09-18T00:00:00.000Z' })).toThrow(
      /real, non-empty reviewNote/,
    );
  });

  it('rejects reviewNote stray-set on a non-yellow entry', () => {
    expect(() =>
      assertPipelineStatusInvariants({ status: 'green', reasons: [], reviewedAt: '2026-09-18T00:00:00.000Z', reviewNote: 'x', computedAt: '2026-09-18T00:00:00.000Z' }),
    ).toThrow(/only be set on a 'yellow' entry/);
  });

  it("rejects a 'green' entry missing reviewedAt", () => {
    expect(() => assertPipelineStatusInvariants({ status: 'green', reasons: [], computedAt: '2026-09-18T00:00:00.000Z' })).toThrow(
      /must carry reviewedAt/,
    );
  });

  it('rejects reviewedAt stray-set on a non-green entry', () => {
    expect(() =>
      assertPipelineStatusInvariants({ status: 'blue', reasons: [], reviewedAt: '2026-09-18T00:00:00.000Z', computedAt: '2026-09-18T00:00:00.000Z' }),
    ).toThrow(/only be set on a 'green' entry/);
  });
});

describe('readPipelineStatus — "(no folder)" and unreadable cases fall back to `undefined`, never guess a color', () => {
  const makeRoot = () => mkdtempSync(join(tmpdir(), 'pipeline-status-test-'));

  it('no card folder at all -> undefined', () => {
    const root = makeRoot();
    try {
      expect(readPipelineStatus('nope', root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('card folder exists but has no pipeline-status.json yet -> undefined', () => {
    const root = makeRoot();
    try {
      mkdirSync(join(root, 'functional-model', 'cards', 'some-fdn-card'), { recursive: true });
      expect(readPipelineStatus('some-fdn-card', root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a real, well-formed file round-trips', () => {
    const root = makeRoot();
    try {
      const dir = join(root, 'functional-model', 'cards', 'some-fdn-card');
      mkdirSync(dir, { recursive: true });
      const entry: PipelineStatusFile = { status: 'blue', reasons: [], computedAt: '2026-09-18T00:00:00.000Z' };
      writeFileSync(join(dir, 'pipeline-status.json'), JSON.stringify(entry));
      expect(readPipelineStatus('some-fdn-card', root)).toEqual(entry);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('malformed JSON -> undefined, never throws (an unreadable file conveys no reliable color, never guessed)', () => {
    const root = makeRoot();
    try {
      const dir = join(root, 'functional-model', 'cards', 'some-fdn-card');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'pipeline-status.json'), '{ not valid json');
      expect(readPipelineStatus('some-fdn-card', root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('valid JSON but not a real PipelineStatusFile shape (no `status` field) -> undefined', () => {
    const root = makeRoot();
    try {
      const dir = join(root, 'functional-model', 'cards', 'some-fdn-card');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'pipeline-status.json'), JSON.stringify({ reasons: [] }));
      expect(readPipelineStatus('some-fdn-card', root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
