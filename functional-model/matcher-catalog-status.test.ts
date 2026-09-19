import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  computeMatcherCatalogStatus,
  computeMatcherCatalogColor,
  computeMatcherCatalogFingerprint,
  isMatcherCatalogEntryUsable,
  resetMatcherCatalogColorCacheForTests,
} from './matcher-catalog-status';
import { MATCHER_CATALOG } from './matcher-model/catalog/index';

describe('computeMatcherCatalogStatus — real catalog GROUPS (family-scoped, 2026-09-18)', () => {
  it('has exactly the real, statically-registered GROUPS — the 2 real families (battlefield-presence, counters) plus 3 real singletons (lifegain, graveyard-fodder, etb)', () => {
    const entries = computeMatcherCatalogStatus();
    expect(entries.map((e) => e.slug).sort()).toEqual(['battlefield-presence', 'counters', 'etb', 'graveyard-fodder', 'lifegain']);
  });

  it('every real group is blue against the real repo root — every member instance\'s own real corpus manifest fully agrees', () => {
    for (const e of computeMatcherCatalogStatus()) {
      expect(e.baseline).toBe('blue');
      expect(e.evidence.corpusManifestExists).toBe(true);
      expect(e.evidence.corpusTotal).toBeGreaterThan(0);
      expect(e.evidence.corpusPassing).toBe(e.evidence.corpusTotal);
    }
  });

  it('a real family group carries its own real instanceSlugs + per-instance evidence.members breakdown; a singleton carries neither instanceSlugs nor a >1-length members array', () => {
    const bySlug = Object.fromEntries(computeMatcherCatalogStatus().map((e) => [e.slug, e]));

    expect(bySlug['battlefield-presence']!.instanceSlugs?.slice().sort()).toEqual(['battlefield-presence-cats', 'battlefield-presence-creatures', 'battlefield-presence-hare-apparent']);
    expect(bySlug['battlefield-presence']!.evidence.members.map((m) => m.slug).sort()).toEqual(['battlefield-presence-cats', 'battlefield-presence-creatures', 'battlefield-presence-hare-apparent']);
    expect(bySlug['battlefield-presence']!.category).toBe('Battlefield presence');

    expect(bySlug['counters']!.instanceSlugs).toEqual(['counters-plus1plus1']);
    expect(bySlug['counters']!.evidence.members.map((m) => m.slug)).toEqual(['counters-plus1plus1']);
    expect(bySlug['counters']!.category).toBe('Counters');

    expect(bySlug['lifegain']!.instanceSlugs).toBeUndefined();
    expect(bySlug['lifegain']!.evidence.members).toHaveLength(1);
    expect(bySlug['lifegain']!.category).toBe('Lifegain');
    expect(bySlug['graveyard-fodder']!.category).toBe('Graveyard fodder');
    expect(bySlug['etb']!.category).toBe('ETB');
  });

  it('a real family group\'s aggregated evidence is the real SUM of every member instance\'s own corpus total/passing', () => {
    const bySlug = Object.fromEntries(computeMatcherCatalogStatus().map((e) => [e.slug, e]));
    const bfp = bySlug['battlefield-presence']!;
    const summed = bfp.evidence.members.reduce((sum, m) => sum + m.corpusTotal, 0);
    expect(bfp.evidence.corpusTotal).toBe(summed);
    expect(bfp.evidence.corpusTotal).toBeGreaterThan(bfp.evidence.members[0]!.corpusTotal); // genuinely more than any 1 instance alone
  });

  it('evidence.members paths point at the documented functional-model/matcher-model/catalog/<instance-slug> convention (unchanged by family grouping)', () => {
    for (const e of computeMatcherCatalogStatus()) {
      for (const m of e.evidence.members) {
        expect(m.corpusManifestPath).toBe(`functional-model/matcher-model/catalog/${m.slug}.corpus.json`);
      }
    }
  });

  it('a real, single catalog entry slug still maps to a real MATCHER_CATALOG instance for every group member', () => {
    const allInstanceSlugs = computeMatcherCatalogStatus().flatMap((e) => e.evidence.members.map((m) => m.slug));
    expect(allInstanceSlugs.sort()).toEqual(MATCHER_CATALOG.map((e) => e.slug).sort());
  });

  it('gray: a fake root with no corpus.json for a real singleton at all', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'matcher-catalog-status-test-'));
    try {
      const e = computeMatcherCatalogStatus(fakeRoot).find((x) => x.slug === 'lifegain')!;
      expect(e.baseline).toBe('gray');
      expect(e.evidence.corpusManifestExists).toBe(false);
      expect(e.evidence.corpusTotal).toBe(0);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('gray: a fake root with no corpus.json for ANY member of a real family — the whole group stays gray, not just missing members', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'matcher-catalog-status-test-'));
    try {
      const e = computeMatcherCatalogStatus(fakeRoot).find((x) => x.slug === 'battlefield-presence')!;
      expect(e.baseline).toBe('gray');
      expect(e.evidence.corpusManifestExists).toBe(false);
      expect(e.evidence.corpusTotal).toBe(0);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('purple: a real family group where only SOME member instances have a passing corpus — the whole group is purple, not blue', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'matcher-catalog-status-test-'));
    try {
      const catalogDir = join(fakeRoot, 'functional-model', 'matcher-model', 'catalog');
      mkdirSync(catalogDir, { recursive: true });
      writeFileSync(join(catalogDir, 'battlefield-presence-cats.corpus.json'), JSON.stringify({ total: 4, passing: 4 }));
      writeFileSync(join(catalogDir, 'battlefield-presence-creatures.corpus.json'), JSON.stringify({ total: 3, passing: 2 })); // NOT fully passing
      writeFileSync(join(catalogDir, 'battlefield-presence-hare-apparent.corpus.json'), JSON.stringify({ total: 2, passing: 2 }));

      const purple = computeMatcherCatalogStatus(fakeRoot).find((e) => e.slug === 'battlefield-presence')!;
      expect(purple.baseline).toBe('purple');
      expect(purple.evidence.corpusTotal).toBe(9);
      expect(purple.evidence.corpusPassing).toBe(8);

      writeFileSync(join(catalogDir, 'battlefield-presence-creatures.corpus.json'), JSON.stringify({ total: 3, passing: 3 }));
      const blue = computeMatcherCatalogStatus(fakeRoot).find((e) => e.slug === 'battlefield-presence')!;
      expect(blue.baseline).toBe('blue');
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('a corpus.json with total:0 stays gray, not blue (an empty/vacuous manifest is not a real pass)', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'matcher-catalog-status-test-'));
    try {
      const catalogDir = join(fakeRoot, 'functional-model', 'matcher-model', 'catalog');
      mkdirSync(catalogDir, { recursive: true });
      writeFileSync(join(catalogDir, 'lifegain.corpus.json'), JSON.stringify({ total: 0, passing: 0 }));
      const e = computeMatcherCatalogStatus(fakeRoot).find((x) => x.slug === 'lifegain')!;
      expect(e.baseline).toBe('gray');
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });
});

describe('computeMatcherCatalogColor / isMatcherCatalogEntryUsable — the real-matching usability gate, family-scoped', () => {
  it('real repo root: both real singleton entries are blue -> usable', () => {
    expect(computeMatcherCatalogColor('lifegain')).toBe('blue');
    expect(computeMatcherCatalogColor('graveyard-fodder')).toBe('blue');
    expect(isMatcherCatalogEntryUsable('lifegain')).toBe(true);
    expect(isMatcherCatalogEntryUsable('graveyard-fodder')).toBe(true);
  });

  it('real repo root: a real INSTANCE slug resolves to its own FAMILY\'s color — every battlefield-presence instance agrees, matching the family group\'s own color', () => {
    const familyColor = computeMatcherCatalogColor('battlefield-presence');
    expect(familyColor).toBe('blue');
    expect(computeMatcherCatalogColor('battlefield-presence-cats')).toBe(familyColor);
    expect(computeMatcherCatalogColor('battlefield-presence-creatures')).toBe(familyColor);
    expect(computeMatcherCatalogColor('battlefield-presence-hare-apparent')).toBe(familyColor);
    expect(isMatcherCatalogEntryUsable('battlefield-presence-cats')).toBe(true);
  });

  it('an unknown slug (never registered) is treated as gray -> not usable, never throws', () => {
    expect(computeMatcherCatalogColor('not-a-real-sink')).toBe('gray');
    expect(isMatcherCatalogEntryUsable('not-a-real-sink')).toBe(false);
  });

  it('a human "reject" review verdict keyed on the FAMILY overlays every real member instance to yellow -> NOT usable', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-catalog-color-test-'));
    try {
      const catalogDir = join(fakeRoot, 'functional-model', 'matcher-model', 'catalog');
      mkdirSync(catalogDir, { recursive: true });
      writeFileSync(join(catalogDir, 'battlefield-presence-cats.corpus.json'), JSON.stringify({ total: 4, passing: 4 }));
      writeFileSync(join(catalogDir, 'battlefield-presence-creatures.corpus.json'), JSON.stringify({ total: 4, passing: 4 }));
      writeFileSync(join(catalogDir, 'battlefield-presence-hare-apparent.corpus.json'), JSON.stringify({ total: 4, passing: 4 }));
      writeFileSync(
        join(fakeRoot, 'functional-model', 'matcher-catalog-reviews.json'),
        JSON.stringify({ 'battlefield-presence': { verdict: 'reject', note: 'simulated disagreement for this test' } }),
      );

      expect(computeMatcherCatalogColor('battlefield-presence', fakeRoot)).toBe('yellow');
      expect(computeMatcherCatalogColor('battlefield-presence-creatures', fakeRoot)).toBe('yellow');
      expect(isMatcherCatalogEntryUsable('battlefield-presence-cats', fakeRoot)).toBe(false);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('a "confirm" verdict sitting on a NOT-yet-blue baseline is ignored, not carried forward as green', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-catalog-color-test-'));
    try {
      mkdirSync(join(fakeRoot, 'functional-model'), { recursive: true });
      writeFileSync(
        join(fakeRoot, 'functional-model', 'matcher-catalog-reviews.json'),
        JSON.stringify({ lifegain: { verdict: 'confirm', reviewedAt: '2026-09-18' } }),
      );

      expect(computeMatcherCatalogStatus(fakeRoot).find((e) => e.slug === 'lifegain')!.baseline).toBe('gray');
      expect(computeMatcherCatalogColor('lifegain', fakeRoot)).toBe('gray');
      expect(isMatcherCatalogEntryUsable('lifegain', fakeRoot)).toBe(false);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('a stale confirm on a blue FAMILY group whose shared source has since changed reads back as re-review for every member instance, not green', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-catalog-color-test-'));
    try {
      const catalogDir = join(fakeRoot, 'functional-model', 'matcher-model', 'catalog');
      const familiesDir = join(catalogDir, 'families');
      mkdirSync(familiesDir, { recursive: true });
      writeFileSync(join(familiesDir, 'counters.ts'), '// stub family source v1\n');
      writeFileSync(join(catalogDir, 'counters-plus1plus1.corpus.json'), JSON.stringify({ total: 4, passing: 4 }));

      const fingerprintAtConfirm = computeMatcherCatalogFingerprint('counters', fakeRoot)!;
      expect(fingerprintAtConfirm).toBeTruthy();
      writeFileSync(
        join(fakeRoot, 'functional-model', 'matcher-catalog-reviews.json'),
        JSON.stringify({ counters: { verdict: 'confirm', reviewedAt: '2026-09-18', fingerprint: fingerprintAtConfirm } }),
      );

      resetMatcherCatalogColorCacheForTests();
      expect(computeMatcherCatalogColor('counters', fakeRoot)).toBe('green');
      expect(computeMatcherCatalogColor('counters-plus1plus1', fakeRoot)).toBe('green');
      expect(isMatcherCatalogEntryUsable('counters-plus1plus1', fakeRoot)).toBe(true);

      writeFileSync(join(familiesDir, 'counters.ts'), '// stub family source v2 — real content changed\n');
      resetMatcherCatalogColorCacheForTests();
      expect(computeMatcherCatalogColor('counters', fakeRoot)).toBe('re-review');
      expect(computeMatcherCatalogColor('counters-plus1plus1', fakeRoot)).toBe('re-review');
      expect(isMatcherCatalogEntryUsable('counters-plus1plus1', fakeRoot)).toBe(false);

      const freshFingerprint = computeMatcherCatalogFingerprint('counters', fakeRoot)!;
      writeFileSync(
        join(fakeRoot, 'functional-model', 'matcher-catalog-reviews.json'),
        JSON.stringify({ counters: { verdict: 'confirm', reviewedAt: '2026-09-18', fingerprint: freshFingerprint } }),
      );
      resetMatcherCatalogColorCacheForTests();
      expect(computeMatcherCatalogColor('counters', fakeRoot)).toBe('green');
      expect(isMatcherCatalogEntryUsable('counters-plus1plus1', fakeRoot)).toBe(true);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
      resetMatcherCatalogColorCacheForTests();
    }
  });

  it('a stale confirm on a blue FAMILY group whose PER-INSTANCE config (not the shared factory) has since changed also reads back as re-review — instance files are real fingerprint inputs too, not just the shared family file', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-catalog-color-test-'));
    try {
      const catalogDir = join(fakeRoot, 'functional-model', 'matcher-model', 'catalog');
      const familiesDir = join(catalogDir, 'families');
      mkdirSync(familiesDir, { recursive: true });
      writeFileSync(join(familiesDir, 'counters.ts'), '// stub family source\n');
      writeFileSync(join(catalogDir, 'counters-plus1plus1.ts'), '// stub instance config v1\n');
      writeFileSync(join(catalogDir, 'counters-plus1plus1.corpus.json'), JSON.stringify({ total: 4, passing: 4 }));

      const fingerprintAtConfirm = computeMatcherCatalogFingerprint('counters', fakeRoot)!;
      writeFileSync(
        join(fakeRoot, 'functional-model', 'matcher-catalog-reviews.json'),
        JSON.stringify({ counters: { verdict: 'confirm', reviewedAt: '2026-09-18', fingerprint: fingerprintAtConfirm } }),
      );
      resetMatcherCatalogColorCacheForTests();
      expect(computeMatcherCatalogColor('counters', fakeRoot)).toBe('green');

      writeFileSync(join(catalogDir, 'counters-plus1plus1.ts'), '// stub instance config v2 — real content changed\n');
      resetMatcherCatalogColorCacheForTests();
      expect(computeMatcherCatalogColor('counters', fakeRoot)).toBe('re-review');
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
      resetMatcherCatalogColorCacheForTests();
    }
  });

  it('caches per root — a filesystem change under an already-queried root is NOT picked up until reset', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-catalog-color-test-'));
    try {
      expect(isMatcherCatalogEntryUsable('lifegain', fakeRoot)).toBe(false);

      const catalogDir = join(fakeRoot, 'functional-model', 'matcher-model', 'catalog');
      mkdirSync(catalogDir, { recursive: true });
      writeFileSync(join(catalogDir, 'lifegain.corpus.json'), JSON.stringify({ total: 1, passing: 1 }));
      expect(isMatcherCatalogEntryUsable('lifegain', fakeRoot)).toBe(false);

      resetMatcherCatalogColorCacheForTests();
      expect(isMatcherCatalogEntryUsable('lifegain', fakeRoot)).toBe(true);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
      resetMatcherCatalogColorCacheForTests();
    }
  });
});
