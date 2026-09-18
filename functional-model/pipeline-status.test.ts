import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyPipelineReview,
  assertPipelineStatusInvariants,
  computePipelineDefinitionFingerprint,
  effectivePipelineStatus,
  pipelineStatusFromGateResult,
  readPipelineStatus,
  type PipelineStatusFile,
} from './pipeline-status';
import { markSinkAttachmentReviewed, writeSinkAttachment } from './sink-attachment';

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

  it("'ok' with a caller-supplied reviewedFingerprint stamps it straight through (pure — no fs read inside this function)", () => {
    const entry = applyPipelineReview(blueEntry, { verdict: 'ok', reviewedFingerprint: 'abc123' }, '2026-09-18T01:00:00.000Z');
    expect(entry.status).toBe('green');
    expect(entry.reviewedFingerprint).toBe('abc123');
  });

  it("'ok' with no reviewedFingerprint supplied leaves it undefined, not a guessed value", () => {
    const entry = applyPipelineReview(blueEntry, { verdict: 'ok' }, '2026-09-18T01:00:00.000Z');
    expect(entry.reviewedFingerprint).toBeUndefined();
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

  it("rejects a stored status of 're-review' — computed at-read-time-only, never a real stored value", () => {
    expect(() =>
      assertPipelineStatusInvariants({ status: 're-review', reasons: [], computedAt: '2026-09-18T00:00:00.000Z' } as PipelineStatusFile),
    ).toThrow(/computed, at-read-time-only status/);
  });

  it('accepts a green entry carrying reviewedFingerprint', () => {
    expect(() =>
      assertPipelineStatusInvariants({
        status: 'green',
        reasons: [],
        reviewedAt: '2026-09-18T00:00:00.000Z',
        reviewedFingerprint: 'abc123',
        computedAt: '2026-09-18T00:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('accepts a green entry WITHOUT reviewedFingerprint (old, pre-fingerprint entries are tolerated, not malformed)', () => {
    expect(() =>
      assertPipelineStatusInvariants({ status: 'green', reasons: [], reviewedAt: '2026-09-18T00:00:00.000Z', computedAt: '2026-09-18T00:00:00.000Z' }),
    ).not.toThrow();
  });

  it('rejects reviewedFingerprint stray-set on a non-green entry', () => {
    expect(() =>
      assertPipelineStatusInvariants({ status: 'blue', reasons: [], reviewedFingerprint: 'abc123', computedAt: '2026-09-18T00:00:00.000Z' }),
    ).toThrow(/reviewedFingerprint must only be set on a 'green' entry/);
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
      mkdirSync(join(root, 'functional-model', 'fdn-cards', 'some-fdn-card'), { recursive: true });
      expect(readPipelineStatus('some-fdn-card', root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a real, well-formed file round-trips', () => {
    const root = makeRoot();
    try {
      const dir = join(root, 'functional-model', 'fdn-cards', 'some-fdn-card');
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
      const dir = join(root, 'functional-model', 'fdn-cards', 'some-fdn-card');
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
      const dir = join(root, 'functional-model', 'fdn-cards', 'some-fdn-card');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'pipeline-status.json'), JSON.stringify({ reasons: [] }));
      expect(readPipelineStatus('some-fdn-card', root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('computePipelineDefinitionFingerprint', () => {
  const makeRoot = () => mkdtempSync(join(tmpdir(), 'pipeline-status-fingerprint-test-'));

  it('no definition.ts at all -> null', () => {
    const root = makeRoot();
    try {
      expect(computePipelineDefinitionFingerprint('nope', root)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a real definition.ts hashes deterministically, and changes when its content changes', () => {
    const root = makeRoot();
    try {
      const dir = join(root, 'functional-model', 'fdn-cards', 'some-fdn-card');
      mkdirSync(dir, { recursive: true });
      const defPath = join(dir, 'definition.ts');
      writeFileSync(defPath, 'export const definition = { name: "Some FDN Card" };\n');
      const first = computePipelineDefinitionFingerprint('some-fdn-card', root);
      expect(first).toMatch(/^[0-9a-f]{64}$/);
      expect(computePipelineDefinitionFingerprint('some-fdn-card', root)).toBe(first);

      writeFileSync(defPath, 'export const definition = { name: "Some FDN Card", changed: true };\n');
      const second = computePipelineDefinitionFingerprint('some-fdn-card', root);
      expect(second).not.toBe(first);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("effectivePipelineStatus — the real, drift-aware status a consumer should trust, never a stored 'green' blindly", () => {
  const makeRoot = () => mkdtempSync(join(tmpdir(), 'pipeline-status-effective-test-'));

  function setUpCard(root: string, slug: string, definitionContent: string, pipeline: PipelineStatusFile): void {
    const dir = join(root, 'functional-model', 'fdn-cards', slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'definition.ts'), definitionContent);
    writeFileSync(join(dir, 'pipeline-status.json'), JSON.stringify(pipeline));
  }

  it('no folder at all -> undefined, same as readPipelineStatus', () => {
    const root = makeRoot();
    try {
      expect(effectivePipelineStatus('nope', root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(['gray', 'purple', 'yellow'] as const)('a stored %s entry passes through unchanged (drift/attachment only matter for green/blue)', (status) => {
    const root = makeRoot();
    try {
      const entry: PipelineStatusFile =
        status === 'purple'
          ? { status, reasons: ['x'], failureKind: 'capacity-gap', computedAt: '2026-09-18T00:00:00.000Z' }
          : status === 'yellow'
            ? { status, reasons: [], reviewNote: 'wrong', computedAt: '2026-09-18T00:00:00.000Z' }
            : { status, reasons: [], computedAt: '2026-09-18T00:00:00.000Z' };
      setUpCard(root, 'some-fdn-card', 'export const definition = {};\n', entry);
      expect(effectivePipelineStatus('some-fdn-card', root)).toBe(status);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // `blue` redefinition (2026-09-18, later same day) — see pipeline-status
  // .ts's own header + effectivePipelineStatus's own doc comment.
  it("a stored 'blue' entry with NO sinks.json at all regresses to 'gray' — the sink-attachment step hasn't been completed yet", () => {
    const root = makeRoot();
    try {
      setUpCard(root, 'some-fdn-card', 'export const definition = {};\n', { status: 'blue', reasons: [], computedAt: '2026-09-18T00:00:00.000Z' });
      expect(effectivePipelineStatus('some-fdn-card', root)).toBe('gray');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a stored 'blue' entry with a real, reviewed, ZERO-sink attachment (Serra Angel's own shape) stays 'blue' — zero attached sinks is a legitimate complete outcome", () => {
    const root = makeRoot();
    try {
      const definitionContent = 'export const definition = { name: "Serra Angel" };\n';
      setUpCard(root, 'serra-angel', definitionContent, { status: 'blue', reasons: [], computedAt: '2026-09-18T00:00:00.000Z' });
      writeSinkAttachment('serra-angel', markSinkAttachmentReviewed('serra-angel', [], root), root);
      expect(effectivePipelineStatus('serra-angel', root)).toBe('blue');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a stored 'blue' entry whose attachment references an unknown catalog slug still regresses to 'gray' even though it's marked reviewed", () => {
    const root = makeRoot();
    try {
      const definitionContent = 'export const definition = { name: "Some Card" };\n';
      setUpCard(root, 'some-fdn-card', definitionContent, { status: 'blue', reasons: [], computedAt: '2026-09-18T00:00:00.000Z' });
      writeSinkAttachment('some-fdn-card', markSinkAttachmentReviewed('some-fdn-card', ['not-a-real-sink'], root), root);
      expect(effectivePipelineStatus('some-fdn-card', root)).toBe('gray');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a green entry whose reviewedFingerprint matches the current definition.ts stays green', () => {
    const root = makeRoot();
    try {
      const definitionContent = 'export const definition = { name: "Serra Angel" };\n';
      setUpCard(root, 'serra-angel', definitionContent, {
        status: 'blue',
        reasons: [],
        computedAt: '2026-09-18T00:00:00.000Z',
      });
      const fingerprint = computePipelineDefinitionFingerprint('serra-angel', root);
      setUpCard(root, 'serra-angel', definitionContent, {
        status: 'green',
        reasons: [],
        reviewedAt: '2026-09-18T01:00:00.000Z',
        reviewedFingerprint: fingerprint!,
        computedAt: '2026-09-18T01:00:00.000Z',
      });
      expect(effectivePipelineStatus('serra-angel', root)).toBe('green');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a green entry whose definition.ts changed SINCE confirmation flips to 're-review'", () => {
    const root = makeRoot();
    try {
      const originalContent = 'export const definition = { name: "Serra Angel" };\n';
      const fingerprint = (() => {
        setUpCard(root, 'serra-angel', originalContent, { status: 'blue', reasons: [], computedAt: '2026-09-18T00:00:00.000Z' });
        return computePipelineDefinitionFingerprint('serra-angel', root)!;
      })();
      setUpCard(root, 'serra-angel', originalContent, {
        status: 'green',
        reasons: [],
        reviewedAt: '2026-09-18T01:00:00.000Z',
        reviewedFingerprint: fingerprint,
        computedAt: '2026-09-18T01:00:00.000Z',
      });
      expect(effectivePipelineStatus('serra-angel', root)).toBe('green');

      // Hand-edit definition.ts (e.g. touching a comment) WITHOUT touching pipeline-status.json.
      const dir = join(root, 'functional-model', 'fdn-cards', 'serra-angel');
      writeFileSync(join(dir, 'definition.ts'), originalContent + '// a real, later edit\n');

      expect(effectivePipelineStatus('serra-angel', root)).toBe('re-review');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a green entry with NO reviewedFingerprint at all (an old, pre-fingerprint entry) is treated as a mismatch -> 're-review'", () => {
    const root = makeRoot();
    try {
      setUpCard(root, 'serra-angel', 'export const definition = { name: "Serra Angel" };\n', {
        status: 'green',
        reasons: [],
        reviewedAt: '2026-09-18T01:00:00.000Z',
        computedAt: '2026-09-18T01:00:00.000Z',
      });
      expect(effectivePipelineStatus('serra-angel', root)).toBe('re-review');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
