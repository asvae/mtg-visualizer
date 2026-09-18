import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  computeSinkDerivationStatus,
  computeSinkDerivationColor,
  computeSinkDerivationFingerprint,
  isSinkDerivationMechanismUsable,
  resetSinkDerivationColorCacheForTests,
  SINK_DERIVATION_MECHANISMS,
} from './sink-derivation-status';

describe('computeSinkDerivationStatus — seeded sink-derivation-predicate mechanism index', () => {
  const entries = computeSinkDerivationStatus();

  it('has exactly the 5 real, already-identified seeded mechanisms — saga, stun-counters, finality-counters, crew, lifelink (2026-09-18, added for Felidar Savior/FDN #12)', () => {
    expect(entries.map((e) => e.slug).sort()).toEqual(['crew', 'finality-counters', 'lifelink', 'saga', 'stun-counters']);
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

  it('saga and crew are now blue — real predicate modules + fully-agreeing corpus manifests landed for both (2026-09-17); stun-counters/finality-counters stay gray (untouched, out of scope for that pass), reflecting real filesystem presence, not a hardcoded value', () => {
    const bySlug = Object.fromEntries(entries.map((e) => [e.slug, e]));

    for (const slug of ['saga', 'crew'] as const) {
      const e = bySlug[slug]!;
      expect(e.baseline).toBe('blue');
      expect(e.evidence.predicateModuleExists).toBe(true);
      expect(e.evidence.corpusManifestExists).toBe(true);
      expect(e.evidence.corpusTotal).toBeGreaterThan(0);
      expect(e.evidence.corpusPassing).toBe(e.evidence.corpusTotal);
    }

    for (const slug of ['stun-counters', 'finality-counters'] as const) {
      const e = bySlug[slug]!;
      expect(e.baseline).toBe('gray');
      expect(e.evidence.predicateModuleExists).toBe(false);
      expect(e.evidence.corpusManifestExists).toBe(false);
      expect(e.evidence.corpusTotal).toBe(0);
      expect(e.evidence.corpusPassing).toBe(0);
    }
  });

  it('lifelink is also blue (2026-09-18, added for Felidar Savior/FDN #12) — its own real predicate module + fully-agreeing corpus manifest landed alongside its seed entry, not as a later follow-up', () => {
    const e = computeSinkDerivationStatus().find((entry) => entry.slug === 'lifelink')!;
    expect(e.baseline).toBe('blue');
    expect(e.evidence.predicateModuleExists).toBe(true);
    expect(e.evidence.corpusManifestExists).toBe(true);
    expect(e.evidence.corpusTotal).toBeGreaterThan(0);
    expect(e.evidence.corpusPassing).toBe(e.evidence.corpusTotal);
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

describe('computeSinkDerivationColor / isSinkDerivationMechanismUsable — the real-matching usability gate (2026-09-18)', () => {
  it('real repo root: saga and crew are blue -> usable; stun-counters and finality-counters are gray (no predicate module built yet) -> NOT usable', () => {
    expect(computeSinkDerivationColor('saga')).toBe('blue');
    expect(computeSinkDerivationColor('crew')).toBe('blue');
    expect(isSinkDerivationMechanismUsable('saga')).toBe(true);
    expect(isSinkDerivationMechanismUsable('crew')).toBe(true);

    expect(computeSinkDerivationColor('stun-counters')).toBe('gray');
    expect(computeSinkDerivationColor('finality-counters')).toBe('gray');
    expect(isSinkDerivationMechanismUsable('stun-counters')).toBe(false);
    expect(isSinkDerivationMechanismUsable('finality-counters')).toBe(false);
  });

  it('an unknown slug (never seeded) is treated as gray -> not usable, never throws', () => {
    expect(computeSinkDerivationColor('not-a-real-mechanism')).toBe('gray');
    expect(isSinkDerivationMechanismUsable('not-a-real-mechanism')).toBe(false);
  });

  it('purple (predicate module exists, no fully-agreeing corpus manifest) is NOT usable', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-derivation-color-test-'));
    try {
      const predicatesDir = join(fakeRoot, 'functional-model', 'sink-model', 'predicates');
      mkdirSync(predicatesDir, { recursive: true });
      writeFileSync(join(predicatesDir, 'saga.ts'), '// stub predicate, not yet checked\n');

      expect(computeSinkDerivationColor('saga', fakeRoot)).toBe('purple');
      expect(isSinkDerivationMechanismUsable('saga', fakeRoot)).toBe(false);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('blue (predicate module + fully-agreeing corpus manifest) IS usable', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-derivation-color-test-'));
    try {
      const predicatesDir = join(fakeRoot, 'functional-model', 'sink-model', 'predicates');
      mkdirSync(predicatesDir, { recursive: true });
      writeFileSync(join(predicatesDir, 'saga.ts'), '// stub predicate\n');
      writeFileSync(join(predicatesDir, 'saga.corpus.json'), JSON.stringify({ total: 2, passing: 2 }));

      expect(computeSinkDerivationColor('saga', fakeRoot)).toBe('blue');
      expect(isSinkDerivationMechanismUsable('saga', fakeRoot)).toBe(true);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('a human "reject" review verdict overlays gray/purple/blue to yellow -> still NOT usable (yellow means a human found a real disagreement)', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-derivation-color-test-'));
    try {
      const predicatesDir = join(fakeRoot, 'functional-model', 'sink-model', 'predicates');
      mkdirSync(predicatesDir, { recursive: true });
      writeFileSync(join(predicatesDir, 'saga.ts'), '// stub predicate\n');
      writeFileSync(join(predicatesDir, 'saga.corpus.json'), JSON.stringify({ total: 2, passing: 2 }));
      writeFileSync(
        join(fakeRoot, 'functional-model', 'sink-derivation-reviews.json'),
        JSON.stringify({ saga: { verdict: 'reject', note: 'simulated disagreement for this test' } }),
      );

      expect(computeSinkDerivationColor('saga', fakeRoot)).toBe('yellow');
      expect(isSinkDerivationMechanismUsable('saga', fakeRoot)).toBe(false);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('a human "confirm" review verdict sitting on a NOT-yet-blue (gray/purple) baseline is IGNORED, not carried forward as green (2026-09-18) — confirm/reject is only ever meaningful once a mechanism has actually reached the blue/corpus-verified baseline; `./review.post.ts` now refuses to write this in the first place, but this is the read-time defense-in-depth half (a stale/hand-authored review record must never be trusted)', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-derivation-color-test-'));
    try {
      const predicatesDir = join(fakeRoot, 'functional-model', 'sink-model', 'predicates');
      mkdirSync(predicatesDir, { recursive: true });
      writeFileSync(join(predicatesDir, 'saga.ts'), '// stub predicate, not corpus-verified\n');
      writeFileSync(
        join(fakeRoot, 'functional-model', 'sink-derivation-reviews.json'),
        JSON.stringify({ saga: { verdict: 'confirm', reviewedAt: '2026-09-18' } }),
      );

      // Baseline alone (no review) would be purple (no corpus manifest at all) —
      // confirmed via the plain computeSinkDerivationStatus baseline call, not
      // the overlaid color, so this test doesn't just restate its own setup.
      expect(computeSinkDerivationStatus(fakeRoot).find((e) => e.slug === 'saga')!.baseline).toBe('purple');

      expect(computeSinkDerivationColor('saga', fakeRoot)).toBe('purple');
      expect(isSinkDerivationMechanismUsable('saga', fakeRoot)).toBe(false);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('a stale confirm on a blue baseline whose predicate/corpus content has since changed reads back as re-review, not green (drift detection)', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-derivation-color-test-'));
    try {
      const predicatesDir = join(fakeRoot, 'functional-model', 'sink-model', 'predicates');
      mkdirSync(predicatesDir, { recursive: true });
      writeFileSync(join(predicatesDir, 'saga.ts'), '// stub predicate v1\n');
      writeFileSync(join(predicatesDir, 'saga.corpus.json'), JSON.stringify({ total: 2, passing: 2 }));

      const fingerprintAtConfirm = computeSinkDerivationFingerprint('saga', fakeRoot)!;
      expect(fingerprintAtConfirm).toBeTruthy();
      writeFileSync(
        join(fakeRoot, 'functional-model', 'sink-derivation-reviews.json'),
        JSON.stringify({ saga: { verdict: 'confirm', reviewedAt: '2026-09-18', fingerprint: fingerprintAtConfirm } }),
      );

      // Fresh confirm, unchanged predicate source -> green, usable.
      // `computeSinkDerivationColor` itself is uncached (always fresh), but
      // `isSinkDerivationMechanismUsable` goes through the per-root
      // `cachedColor` memoization — reset before every check in this test so
      // each assertion re-reads the real, current filesystem state instead
      // of serving an earlier call's cached verdict (see
      // `resetSinkDerivationColorCacheForTests`'s own doc comment; the
      // pre-existing cache-behavior test below this one covers the caching
      // itself, this test is about drift detection).
      resetSinkDerivationColorCacheForTests();
      expect(computeSinkDerivationColor('saga', fakeRoot)).toBe('green');
      expect(isSinkDerivationMechanismUsable('saga', fakeRoot)).toBe(true);

      // Predicate source content drifts (a real edit lands after the human
      // confirmed) — the stored fingerprint no longer matches the current
      // one, so the color must downgrade to re-review, and re-review must
      // NOT be usable for real matching (a stale confirmation is not a
      // trustworthy one).
      writeFileSync(join(predicatesDir, 'saga.ts'), '// stub predicate v2 — real logic changed\n');
      resetSinkDerivationColorCacheForTests();
      expect(computeSinkDerivationColor('saga', fakeRoot)).toBe('re-review');
      expect(isSinkDerivationMechanismUsable('saga', fakeRoot)).toBe(false);

      // A fresh re-confirm (new fingerprint) restores green/usable.
      const freshFingerprint = computeSinkDerivationFingerprint('saga', fakeRoot)!;
      writeFileSync(
        join(fakeRoot, 'functional-model', 'sink-derivation-reviews.json'),
        JSON.stringify({ saga: { verdict: 'confirm', reviewedAt: '2026-09-18', fingerprint: freshFingerprint } }),
      );
      resetSinkDerivationColorCacheForTests();
      expect(computeSinkDerivationColor('saga', fakeRoot)).toBe('green');
      expect(isSinkDerivationMechanismUsable('saga', fakeRoot)).toBe(true);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
      resetSinkDerivationColorCacheForTests();
    }
  });

  it('isSinkDerivationMechanismUsable caches per root — a filesystem change under an already-queried root is NOT picked up until resetSinkDerivationColorCacheForTests() clears it', () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), 'sink-derivation-color-test-'));
    try {
      // Empty fake root: saga starts gray -> not usable, and this call
      // populates the cache for this exact root/slug pair.
      expect(isSinkDerivationMechanismUsable('saga', fakeRoot)).toBe(false);

      // Now make it a real blue mechanism on disk — WITHOUT resetting the
      // cache first. A naive uncached read would flip to true immediately;
      // the cache must keep serving the stale (but real, previously computed)
      // gray/false verdict.
      const predicatesDir = join(fakeRoot, 'functional-model', 'sink-model', 'predicates');
      mkdirSync(predicatesDir, { recursive: true });
      writeFileSync(join(predicatesDir, 'saga.ts'), '// stub predicate\n');
      writeFileSync(join(predicatesDir, 'saga.corpus.json'), JSON.stringify({ total: 1, passing: 1 }));
      expect(isSinkDerivationMechanismUsable('saga', fakeRoot)).toBe(false);

      // Reset -> the cache is cleared, so the next call re-reads the
      // filesystem and correctly reports the now-real blue/usable state.
      resetSinkDerivationColorCacheForTests();
      expect(isSinkDerivationMechanismUsable('saga', fakeRoot)).toBe(true);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
      resetSinkDerivationColorCacheForTests();
    }
  });
});
