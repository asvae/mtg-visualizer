import { describe, expect, it } from 'vitest';
import { computeSinkDerivationStatus, SINK_DERIVATION_MECHANISMS } from './sink-derivation-status';

describe('computeSinkDerivationStatus — seeded sink-derivation-predicate mechanism index', () => {
  const entries = computeSinkDerivationStatus();

  it('has exactly the 4 real, already-identified seeded mechanisms — saga, stun-counters, finality-counters, crew', () => {
    expect(entries.map((e) => e.slug).sort()).toEqual(['crew', 'finality-counters', 'saga', 'stun-counters']);
    expect(entries.length).toBe(SINK_DERIVATION_MECHANISMS.length);
  });

  it('every entry has a stable key equal to its slug, and non-empty label/motivation/expectedSinkShapes', () => {
    for (const e of entries) {
      expect(e.key).toBe(e.slug);
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.motivation.length).toBeGreaterThan(0);
      expect(e.expectedSinkShapes.length).toBeGreaterThan(0);
      for (const shape of e.expectedSinkShapes) {
        expect(shape.event.length).toBeGreaterThan(0);
        expect(shape.note.length).toBeGreaterThan(0);
      }
    }
  });

  it('every baseline is one of gray/purple/blue (never yellow/green — those are review-overlay only, computed in the server route, not here)', () => {
    for (const e of entries) {
      expect(['gray', 'purple', 'blue']).toContain(e.baseline);
    }
  });

  it('every entry is currently gray — no predicate module exists on disk for any mechanism yet, which is real, not a placeholder', () => {
    for (const e of entries) {
      expect(e.baseline).toBe('gray');
      expect(e.evidence.predicateModuleExists).toBe(false);
      expect(e.evidence.corpusManifestExists).toBe(false);
      expect(e.evidence.corpusTotal).toBe(0);
      expect(e.evidence.corpusPassing).toBe(0);
    }
  });

  it('evidence paths point at the documented functional-model/sink-model/predicates/<slug> convention', () => {
    for (const e of entries) {
      expect(e.evidence.predicateModulePath).toBe(`functional-model/sink-model/predicates/${e.slug}.ts`);
      expect(e.evidence.corpusManifestPath).toBe(`functional-model/sink-model/predicates/${e.slug}.corpus.json`);
    }
  });

  it('a mechanism becomes purple once its predicate module exists but no corpus manifest shows full agreement (simulated via a fake root)', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-derivation-status-test-'));
    try {
      const predicatesDir = join(fakeRoot, 'functional-model', 'sink-model', 'predicates');
      mkdirSync(predicatesDir, { recursive: true });
      writeFileSync(join(predicatesDir, 'saga.ts'), '// stub predicate, not yet checked\n');

      const purpleEntries = computeSinkDerivationStatus(fakeRoot);
      const saga = purpleEntries.find((e) => e.slug === 'saga')!;
      expect(saga.baseline).toBe('purple');
      expect(saga.evidence.predicateModuleExists).toBe(true);
      expect(saga.evidence.corpusManifestExists).toBe(false);

      // Other 3 mechanisms are untouched in this fake root — still gray.
      for (const e of purpleEntries.filter((x) => x.slug !== 'saga')) {
        expect(e.baseline).toBe('gray');
      }

      // Now add a corpus manifest with a real, positive, fully-passing count -> blue.
      writeFileSync(join(predicatesDir, 'saga.corpus.json'), JSON.stringify({ total: 3, passing: 3 }));
      const blueEntries = computeSinkDerivationStatus(fakeRoot);
      const sagaBlue = blueEntries.find((e) => e.slug === 'saga')!;
      expect(sagaBlue.baseline).toBe('blue');
      expect(sagaBlue.evidence.corpusTotal).toBe(3);
      expect(sagaBlue.evidence.corpusPassing).toBe(3);

      // A manifest that doesn't fully agree stays purple, not blue.
      writeFileSync(join(predicatesDir, 'saga.corpus.json'), JSON.stringify({ total: 3, passing: 2 }));
      const partialEntries = computeSinkDerivationStatus(fakeRoot);
      const sagaPartial = partialEntries.find((e) => e.slug === 'saga')!;
      expect(sagaPartial.baseline).toBe('purple');
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });
});
