import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  computeSinkCatalogStatus,
  computeSinkCatalogColor,
  computeSinkCatalogFingerprint,
  isSinkCatalogEntryUsable,
  resetSinkCatalogColorCacheForTests,
} from './sink-catalog-status';
import { SINK_CATALOG } from './sink-model/catalog/index';

describe('computeSinkCatalogStatus — real catalog entries', () => {
  it('has exactly the real, statically-registered SINK_CATALOG entries — lifegain, graveyard-fodder, etb, battlefield-presence-cats, battlefield-presence-creatures, counters-plus1plus1', () => {
    const entries = computeSinkCatalogStatus();
    expect(entries.map((e) => e.slug).sort()).toEqual(['battlefield-presence-cats', 'battlefield-presence-creatures', 'counters-plus1plus1', 'etb', 'graveyard-fodder', 'lifegain']);
    expect(entries.length).toBe(SINK_CATALOG.length);
  });

  it('every real entry is blue against the real repo root — both real corpus manifests fully agree', () => {
    for (const e of computeSinkCatalogStatus()) {
      expect(e.baseline).toBe('blue');
      expect(e.evidence.corpusManifestExists).toBe(true);
      expect(e.evidence.corpusTotal).toBeGreaterThan(0);
      expect(e.evidence.corpusPassing).toBe(e.evidence.corpusTotal);
    }
  });

  it('every entry carries its own real category label straight from SINK_CATALOG', () => {
    const bySlug = Object.fromEntries(computeSinkCatalogStatus().map((e) => [e.slug, e]));
    expect(bySlug['lifegain']!.category).toBe('Lifegain');
    expect(bySlug['graveyard-fodder']!.category).toBe('Graveyard fodder');
    expect(bySlug['etb']!.category).toBe('ETB');
    expect(bySlug['battlefield-presence-cats']!.category).toBe('Cats');
    expect(bySlug['battlefield-presence-creatures']!.category).toBe('Creatures');
    expect(bySlug['counters-plus1plus1']!.category).toBe('Counters (+1/+1)');
  });

  it('evidence path points at the documented functional-model/sink-model/catalog/<slug> convention', () => {
    for (const e of computeSinkCatalogStatus()) {
      expect(e.evidence.corpusManifestPath).toBe(`functional-model/sink-model/catalog/${e.slug}.corpus.json`);
    }
  });

  it('gray: a fake root with no corpus.json for a real entry at all', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-catalog-status-test-'));
    try {
      const e = computeSinkCatalogStatus(fakeRoot).find((x) => x.slug === 'lifegain')!;
      expect(e.baseline).toBe('gray');
      expect(e.evidence.corpusManifestExists).toBe(false);
      expect(e.evidence.corpusTotal).toBe(0);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('purple: a corpus.json exists but not every fixture agrees; blue once passing===total', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-catalog-status-test-'));
    try {
      const catalogDir = join(fakeRoot, 'functional-model', 'sink-model', 'catalog');
      mkdirSync(catalogDir, { recursive: true });
      writeFileSync(join(catalogDir, 'lifegain.corpus.json'), JSON.stringify({ total: 4, passing: 3 }));

      const purple = computeSinkCatalogStatus(fakeRoot).find((x) => x.slug === 'lifegain')!;
      expect(purple.baseline).toBe('purple');

      writeFileSync(join(catalogDir, 'lifegain.corpus.json'), JSON.stringify({ total: 4, passing: 4 }));
      const blue = computeSinkCatalogStatus(fakeRoot).find((x) => x.slug === 'lifegain')!;
      expect(blue.baseline).toBe('blue');
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('a corpus.json with total:0 stays gray, not blue (an empty/vacuous manifest is not a real pass)', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-catalog-status-test-'));
    try {
      const catalogDir = join(fakeRoot, 'functional-model', 'sink-model', 'catalog');
      mkdirSync(catalogDir, { recursive: true });
      writeFileSync(join(catalogDir, 'lifegain.corpus.json'), JSON.stringify({ total: 0, passing: 0 }));
      const e = computeSinkCatalogStatus(fakeRoot).find((x) => x.slug === 'lifegain')!;
      expect(e.baseline).toBe('gray');
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });
});

describe('computeSinkCatalogColor / isSinkCatalogEntryUsable — the real-matching usability gate', () => {
  it('real repo root: both real entries are blue -> usable', () => {
    expect(computeSinkCatalogColor('lifegain')).toBe('blue');
    expect(computeSinkCatalogColor('graveyard-fodder')).toBe('blue');
    expect(isSinkCatalogEntryUsable('lifegain')).toBe(true);
    expect(isSinkCatalogEntryUsable('graveyard-fodder')).toBe(true);
  });

  it('an unknown slug (never registered) is treated as gray -> not usable, never throws', () => {
    expect(computeSinkCatalogColor('not-a-real-sink')).toBe('gray');
    expect(isSinkCatalogEntryUsable('not-a-real-sink')).toBe(false);
  });

  it('a human "reject" review verdict overlays blue to yellow -> NOT usable', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-catalog-color-test-'));
    try {
      const catalogDir = join(fakeRoot, 'functional-model', 'sink-model', 'catalog');
      mkdirSync(catalogDir, { recursive: true });
      writeFileSync(join(catalogDir, 'lifegain.corpus.json'), JSON.stringify({ total: 4, passing: 4 }));
      writeFileSync(
        join(fakeRoot, 'functional-model', 'sink-catalog-reviews.json'),
        JSON.stringify({ lifegain: { verdict: 'reject', note: 'simulated disagreement for this test' } }),
      );

      expect(computeSinkCatalogColor('lifegain', fakeRoot)).toBe('yellow');
      expect(isSinkCatalogEntryUsable('lifegain', fakeRoot)).toBe(false);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('a "confirm" verdict sitting on a NOT-yet-blue baseline is ignored, not carried forward as green', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-catalog-color-test-'));
    try {
      mkdirSync(join(fakeRoot, 'functional-model'), { recursive: true });
      writeFileSync(
        join(fakeRoot, 'functional-model', 'sink-catalog-reviews.json'),
        JSON.stringify({ lifegain: { verdict: 'confirm', reviewedAt: '2026-09-18' } }),
      );

      expect(computeSinkCatalogStatus(fakeRoot).find((e) => e.slug === 'lifegain')!.baseline).toBe('gray');
      expect(computeSinkCatalogColor('lifegain', fakeRoot)).toBe('gray');
      expect(isSinkCatalogEntryUsable('lifegain', fakeRoot)).toBe(false);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('a stale confirm on a blue baseline whose entry/corpus content has since changed reads back as re-review, not green', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-catalog-color-test-'));
    try {
      const catalogDir = join(fakeRoot, 'functional-model', 'sink-model', 'catalog');
      mkdirSync(catalogDir, { recursive: true });
      writeFileSync(join(catalogDir, 'lifegain.ts'), '// stub catalog entry v1\n');
      writeFileSync(join(catalogDir, 'lifegain.corpus.json'), JSON.stringify({ total: 4, passing: 4 }));

      const fingerprintAtConfirm = computeSinkCatalogFingerprint('lifegain', fakeRoot)!;
      expect(fingerprintAtConfirm).toBeTruthy();
      writeFileSync(
        join(fakeRoot, 'functional-model', 'sink-catalog-reviews.json'),
        JSON.stringify({ lifegain: { verdict: 'confirm', reviewedAt: '2026-09-18', fingerprint: fingerprintAtConfirm } }),
      );

      resetSinkCatalogColorCacheForTests();
      expect(computeSinkCatalogColor('lifegain', fakeRoot)).toBe('green');
      expect(isSinkCatalogEntryUsable('lifegain', fakeRoot)).toBe(true);

      writeFileSync(join(catalogDir, 'lifegain.ts'), '// stub catalog entry v2 — real content changed\n');
      resetSinkCatalogColorCacheForTests();
      expect(computeSinkCatalogColor('lifegain', fakeRoot)).toBe('re-review');
      expect(isSinkCatalogEntryUsable('lifegain', fakeRoot)).toBe(false);

      const freshFingerprint = computeSinkCatalogFingerprint('lifegain', fakeRoot)!;
      writeFileSync(
        join(fakeRoot, 'functional-model', 'sink-catalog-reviews.json'),
        JSON.stringify({ lifegain: { verdict: 'confirm', reviewedAt: '2026-09-18', fingerprint: freshFingerprint } }),
      );
      resetSinkCatalogColorCacheForTests();
      expect(computeSinkCatalogColor('lifegain', fakeRoot)).toBe('green');
      expect(isSinkCatalogEntryUsable('lifegain', fakeRoot)).toBe(true);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
      resetSinkCatalogColorCacheForTests();
    }
  });

  it('caches per root — a filesystem change under an already-queried root is NOT picked up until reset', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-catalog-color-test-'));
    try {
      expect(isSinkCatalogEntryUsable('lifegain', fakeRoot)).toBe(false);

      const catalogDir = join(fakeRoot, 'functional-model', 'sink-model', 'catalog');
      mkdirSync(catalogDir, { recursive: true });
      writeFileSync(join(catalogDir, 'lifegain.corpus.json'), JSON.stringify({ total: 1, passing: 1 }));
      expect(isSinkCatalogEntryUsable('lifegain', fakeRoot)).toBe(false);

      resetSinkCatalogColorCacheForTests();
      expect(isSinkCatalogEntryUsable('lifegain', fakeRoot)).toBe(true);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
      resetSinkCatalogColorCacheForTests();
    }
  });
});
