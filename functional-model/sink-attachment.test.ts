import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readSinkAttachment,
  validateSinkAttachment,
  effectiveSinkAttachmentStatus,
  isSinkAttachmentComplete,
  computeDefinitionFingerprint,
  markSinkAttachmentReviewed,
  writeSinkAttachment,
  type SinkAttachmentFile,
} from './sink-attachment';

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), 'sink-attachment-test-'));
}

function setUpCard(root: string, slug: string, definitionContent: string): void {
  const dir = join(root, 'functional-model', 'fdn-cards', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'definition.ts'), definitionContent);
}

describe('readSinkAttachment — "(no folder/file)" and unreadable cases fall back to undefined', () => {
  it('no card folder at all -> undefined', () => {
    const root = makeRoot();
    try {
      expect(readSinkAttachment('nope', root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('card folder exists but has no sinks.json yet -> undefined', () => {
    const root = makeRoot();
    try {
      setUpCard(root, 'serra-angel', 'export const definition = {};\n');
      expect(readSinkAttachment('serra-angel', root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a real, well-formed file round-trips', () => {
    const root = makeRoot();
    try {
      setUpCard(root, 'serra-angel', 'export const definition = {};\n');
      const file: SinkAttachmentFile = { attachedSlugs: [], reviewed: true, reviewedAt: '2026-09-18T00:00:00.000Z', computedAt: '2026-09-18T00:00:00.000Z' };
      writeFileSync(join(root, 'functional-model', 'fdn-cards', 'serra-angel', 'sinks.json'), JSON.stringify(file));
      expect(readSinkAttachment('serra-angel', root)).toEqual(file);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('malformed JSON -> undefined, never throws', () => {
    const root = makeRoot();
    try {
      setUpCard(root, 'serra-angel', 'export const definition = {};\n');
      writeFileSync(join(root, 'functional-model', 'fdn-cards', 'serra-angel', 'sinks.json'), '{ not valid json');
      expect(readSinkAttachment('serra-angel', root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('valid JSON missing required fields -> undefined', () => {
    const root = makeRoot();
    try {
      setUpCard(root, 'serra-angel', 'export const definition = {};\n');
      writeFileSync(join(root, 'functional-model', 'fdn-cards', 'serra-angel', 'sinks.json'), JSON.stringify({ reviewed: true }));
      expect(readSinkAttachment('serra-angel', root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('validateSinkAttachment — known-slug reference check', () => {
  it('zero-slug attachment is trivially valid', () => {
    expect(validateSinkAttachment({ attachedSlugs: [], reviewed: true, computedAt: '2026-09-18T00:00:00.000Z' })).toEqual([]);
  });

  it('real known slugs (lifegain, graveyard-fodder) are valid', () => {
    expect(
      validateSinkAttachment({ attachedSlugs: ['lifegain', 'graveyard-fodder'], reviewed: true, computedAt: '2026-09-18T00:00:00.000Z' }),
    ).toEqual([]);
  });

  it('an unknown slug is flagged, not silently accepted', () => {
    const problems = validateSinkAttachment({ attachedSlugs: ['lifegain', 'not-a-real-sink'], reviewed: true, computedAt: '2026-09-18T00:00:00.000Z' });
    expect(problems).toEqual(["unknown catalog slug: 'not-a-real-sink'"]);
  });
});

describe('effectiveSinkAttachmentStatus / isSinkAttachmentComplete', () => {
  it("no sinks.json at all -> 'not-started', not complete", () => {
    const root = makeRoot();
    try {
      setUpCard(root, 'serra-angel', 'export const definition = {};\n');
      expect(effectiveSinkAttachmentStatus('serra-angel', root)).toBe('not-started');
      expect(isSinkAttachmentComplete('serra-angel', root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reviewed:false -> 'incomplete'", () => {
    const root = makeRoot();
    try {
      setUpCard(root, 'serra-angel', 'export const definition = {};\n');
      writeFileSync(
        join(root, 'functional-model', 'fdn-cards', 'serra-angel', 'sinks.json'),
        JSON.stringify({ attachedSlugs: [], reviewed: false, computedAt: '2026-09-18T00:00:00.000Z' }),
      );
      expect(effectiveSinkAttachmentStatus('serra-angel', root)).toBe('incomplete');
      expect(isSinkAttachmentComplete('serra-angel', root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reviewed:true but referencing an unknown slug -> 'incomplete', even though it's marked reviewed", () => {
    const root = makeRoot();
    try {
      const definitionContent = 'export const definition = { name: "X" };\n';
      setUpCard(root, 'some-card', definitionContent);
      const fingerprint = computeDefinitionFingerprint('some-card', root)!;
      writeFileSync(
        join(root, 'functional-model', 'fdn-cards', 'some-card', 'sinks.json'),
        JSON.stringify({ attachedSlugs: ['not-a-real-sink'], reviewed: true, reviewedFingerprint: fingerprint, computedAt: '2026-09-18T00:00:00.000Z' }),
      );
      expect(effectiveSinkAttachmentStatus('some-card', root)).toBe('incomplete');
      expect(isSinkAttachmentComplete('some-card', root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reviewed:true, zero attachedSlugs, matching fingerprint -> 'complete' (Serra Angel's own real shape)", () => {
    const root = makeRoot();
    try {
      const definitionContent = 'export const definition = { name: "Serra Angel" };\n';
      setUpCard(root, 'serra-angel', definitionContent);
      const fingerprint = computeDefinitionFingerprint('serra-angel', root)!;
      writeFileSync(
        join(root, 'functional-model', 'fdn-cards', 'serra-angel', 'sinks.json'),
        JSON.stringify({ attachedSlugs: [], reviewed: true, reviewedFingerprint: fingerprint, computedAt: '2026-09-18T00:00:00.000Z' }),
      );
      expect(effectiveSinkAttachmentStatus('serra-angel', root)).toBe('complete');
      expect(isSinkAttachmentComplete('serra-angel', root)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a definition.ts change AFTER attachment review flips the effective status to 're-review', not 'complete'", () => {
    const root = makeRoot();
    try {
      const originalContent = 'export const definition = { name: "Ajani\'s Pridemate" };\n';
      setUpCard(root, 'ajani-s-pridemate', originalContent);
      const fingerprint = computeDefinitionFingerprint('ajani-s-pridemate', root)!;
      writeFileSync(
        join(root, 'functional-model', 'fdn-cards', 'ajani-s-pridemate', 'sinks.json'),
        JSON.stringify({ attachedSlugs: ['lifegain'], reviewed: true, reviewedFingerprint: fingerprint, computedAt: '2026-09-18T00:00:00.000Z' }),
      );
      expect(effectiveSinkAttachmentStatus('ajani-s-pridemate', root)).toBe('complete');

      writeFileSync(join(root, 'functional-model', 'fdn-cards', 'ajani-s-pridemate', 'definition.ts'), originalContent + '// a later edit\n');
      expect(effectiveSinkAttachmentStatus('ajani-s-pridemate', root)).toBe('re-review');
      expect(isSinkAttachmentComplete('ajani-s-pridemate', root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reviewed:true with NO reviewedFingerprint at all (an old, pre-fingerprint entry) is treated as a mismatch -> re-review', () => {
    const root = makeRoot();
    try {
      setUpCard(root, 'serra-angel', 'export const definition = { name: "Serra Angel" };\n');
      writeFileSync(
        join(root, 'functional-model', 'fdn-cards', 'serra-angel', 'sinks.json'),
        JSON.stringify({ attachedSlugs: [], reviewed: true, computedAt: '2026-09-18T00:00:00.000Z' }),
      );
      expect(effectiveSinkAttachmentStatus('serra-angel', root)).toBe('re-review');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('markSinkAttachmentReviewed / writeSinkAttachment', () => {
  it('builds a reviewed:true file stamped with the real current definition.ts fingerprint, and round-trips through a real write+read', () => {
    const root = makeRoot();
    try {
      setUpCard(root, 'ajani-s-pridemate', 'export const definition = { name: "Ajani\'s Pridemate" };\n');
      const file = markSinkAttachmentReviewed('ajani-s-pridemate', ['lifegain'], root, '2026-09-18T00:00:00.000Z');
      expect(file.attachedSlugs).toEqual(['lifegain']);
      expect(file.reviewed).toBe(true);
      expect(file.reviewedFingerprint).toBe(computeDefinitionFingerprint('ajani-s-pridemate', root));

      writeSinkAttachment('ajani-s-pridemate', file, root);
      expect(readSinkAttachment('ajani-s-pridemate', root)).toEqual(file);
      expect(isSinkAttachmentComplete('ajani-s-pridemate', root)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('supports a real, legitimate zero-sink attachment (Serra Angel’s own shape)', () => {
    const root = makeRoot();
    try {
      setUpCard(root, 'serra-angel', 'export const definition = { name: "Serra Angel" };\n');
      const file = markSinkAttachmentReviewed('serra-angel', [], root, '2026-09-18T00:00:00.000Z');
      writeSinkAttachment('serra-angel', file, root);
      expect(isSinkAttachmentComplete('serra-angel', root)).toBe(true);
      const onDisk = readFileSync(join(root, 'functional-model', 'fdn-cards', 'serra-angel', 'sinks.json'), 'utf8');
      expect(JSON.parse(onDisk).attachedSlugs).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
