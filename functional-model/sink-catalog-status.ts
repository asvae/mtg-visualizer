// Sink CATALOG entry status — a review axis for `functional-model/
// sink-model/catalog/<slug>.ts` entries (the shared, curated `SinkQuery`
// catalog — see `catalog/entry.ts`'s own doc comment for the "catalog, not
// per-card, not bespoke storage" design). Genuinely different from (and NOT
// a fold into) `sink-derivation-status.ts`, which tracks a different,
// narrower question — whether a hand-written PREDICATE exists for a
// mechanism whose gameplay consequence comes from generic ENGINE AUTOMATION
// (Saga/Crew) rather than from a `CardDefinition`'s own effects/triggers.
// This file instead tracks whether a CATALOG ENTRY's own curated `SinkQuery`
// has been proven correct against a real, mocked-fixture structural gate —
// mirrors that file's OWN 5(6)-state shape and computation pattern closely
// (per this task's own explicit "mirror whichever of the two is the closer
// analog" instruction — `sink-derivation-status.ts` is the closer analog
// here, since both compute a LIST of entries each with their own
// baseline+review-overlay color, unlike `pipeline-status.ts`'s single-flat-
// file-per-card shape):
//
//   gray   — the catalog entry exists (real `catalog/<slug>.ts` module,
//            listed in `SINK_CATALOG`) but its own structural-gate corpus
//            manifest (`catalog/<slug>.corpus.json`) is missing or empty —
//            drafted, not yet gated.
//   purple — a corpus manifest exists but doesn't show every real fixture
//            case agreeing (`passing < total`) — built, not fully verified.
//   blue   — the corpus manifest shows every real fixture case agreeing
//            (`total > 0 && passing === total`) — the structural gate
//            passed for real.
//   yellow — (overlay, not computed here) a human reviewed a blue baseline
//            and found a real disagreement/wrong verdict (required note).
//   green  — (overlay, not computed here) a human reviewed and confirmed it.
//   re-review — (computed, never stored) a human confirmed `green`, then
//            this entry's own `<slug>.ts`/`<slug>.corpus.json` content
//            changed since — same drift concept `pipeline-status.ts`'s own
//            `re-review` and `sink-derivation-status.ts`'s own `re-review`
//            already establish.
//
// **Discovery is the real, statically-imported `SINK_CATALOG` array**
// (`sink-model/catalog/index.ts`), NOT a second hand-seeded metadata array
// and NOT a filesystem directory scan. Every entry in that array already
// has a real `catalog/<slug>.ts` module by construction (it's a value
// import) — so there is no "gray, module doesn't exist yet" case the way
// `sink-derivation-status.ts` has for a not-yet-built predicate; a
// not-yet-authored catalog entry simply isn't in `SINK_CATALOG` at all yet
// (same "absence is its own signal" treatment `pipeline-status.ts`'s own
// "(no folder at all)" case already establishes) — this file's own `gray`
// state instead means "listed, but its OWN structural-gate corpus hasn't
// been run/recorded yet," one tier narrower than `sink-derivation-status
// .ts`'s `gray`. Deliberately NOT a hand-seeded metadata array either (the
// catalog is expected to grow much faster/more organically than the small,
// fixed set of engine-automation mechanisms that file tracks — a bespoke,
// low-reuse sink is still just a normal catalog entry, per the user's own
// explicit correction) — adding a new file under `catalog/` plus one import
// line in `catalog/index.ts` is the whole "register a new entry" act, no
// second array to keep in sync by hand.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { SINK_CATALOG } from './sink-model/catalog/index';
import { readFunctionalModelFile } from './source-files';

export type SinkCatalogBaseline = 'gray' | 'purple' | 'blue';
export type SinkCatalogColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green' | 're-review';

export interface SinkCatalogCorpusManifest {
  total: number;
  passing: number;
}

export interface SinkCatalogEvidence {
  corpusManifestPath: string;
  corpusManifestExists: boolean;
  corpusTotal: number;
  corpusPassing: number;
}

export interface SinkCatalogStatusEntry {
  slug: string;
  category: string;
  baseline: SinkCatalogBaseline;
  evidence: SinkCatalogEvidence;
}

const CATALOG_DIR = join('functional-model', 'sink-model', 'catalog');

function loadCorpusManifest(path: string): SinkCatalogCorpusManifest {
  if (!existsSync(path)) return { total: 0, passing: 0 };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    const total = typeof parsed?.total === 'number' ? parsed.total : 0;
    const passing = typeof parsed?.passing === 'number' ? parsed.passing : 0;
    return { total, passing };
  } catch {
    return { total: 0, passing: 0 };
  }
}

/**
 * Computes the real gray/purple/blue baseline for every real catalog entry
 * (`SINK_CATALOG`), off real filesystem presence of `<slug>.corpus.json` —
 * `root` defaults to `process.cwd()`, matching `computeSinkDerivationStatus`
 * /`computeEngineStatus`'s own contract.
 */
export function computeSinkCatalogStatus(root: string = process.cwd()): SinkCatalogStatusEntry[] {
  return SINK_CATALOG.map((entry): SinkCatalogStatusEntry => {
    const corpusManifestPath = join(CATALOG_DIR, `${entry.slug}.corpus.json`);
    const corpusManifestExists = existsSync(join(root, corpusManifestPath));
    const { total: corpusTotal, passing: corpusPassing } = corpusManifestExists
      ? loadCorpusManifest(join(root, corpusManifestPath))
      : { total: 0, passing: 0 };

    let baseline: SinkCatalogBaseline;
    if (!corpusManifestExists || corpusTotal === 0) baseline = 'gray';
    else if (corpusPassing < corpusTotal) baseline = 'purple';
    else baseline = 'blue';

    return {
      slug: entry.slug,
      category: entry.query.category,
      baseline,
      evidence: { corpusManifestPath, corpusManifestExists, corpusTotal, corpusPassing },
    };
  });
}

// ---------------------------------------------------------------------------
// Review overlay + fingerprint drift — same shape `sink-derivation-status
// .ts`'s own "Real-matching usability gate"/"Confirmation drift fingerprint"
// sections already establish, duplicated here (not imported) for the exact
// same reason that file's own header documents: small, unlikely to drift,
// and this module should stay import-light (no runtime dependency on a Nuxt
// server route).
const REVIEWS_RELATIVE_PATH = join('functional-model', 'sink-catalog-reviews.json');

interface SinkCatalogReviewVerdictOnly {
  verdict?: 'confirm' | 'reject';
  fingerprint?: string;
}

function loadReviewVerdicts(root: string): Record<string, SinkCatalogReviewVerdictOnly> {
  const path = join(root, REVIEWS_RELATIVE_PATH);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * sha256 of THIS entry's own real, current `<slug>.ts` + `<slug>.corpus
 * .json` content — the two real, checkable inputs `computeSinkCatalogStatus`
 * itself reads to decide gray/purple/blue for this entry (mirrors
 * `computeSinkDerivationFingerprint`'s own identical two-input hash).
 */
export function computeSinkCatalogFingerprint(slug: string, root: string = process.cwd()): string | null {
  const found = SINK_CATALOG.find((e) => e.slug === slug);
  if (!found) return null;

  const entryResult = readFunctionalModelFile(root, join(CATALOG_DIR, `${slug}.ts`));
  const corpusResult = readFunctionalModelFile(root, join(CATALOG_DIR, `${slug}.corpus.json`));

  const hash = createHash('sha256');
  hash.update(`entry:${entryResult.exists ? (entryResult.content ?? '') : '<missing>'}`);
  hash.update(`corpus:${corpusResult.exists ? (corpusResult.content ?? '') : '<missing>'}`);
  return hash.digest('hex');
}

/** Live color for ONE catalog entry — baseline, or the yellow/green/
 * re-review human-review overlay on top of it. Uncached — see
 * `isSinkCatalogEntryUsable` below for the cached, gate-facing entry point.
 * A review overlay is only ever meaningful on a `blue` baseline (same
 * "confirm/reject presupposes a real verified baseline" rule
 * `sink-derivation-status.ts`'s own `computeSinkDerivationColor` already
 * enforces) — a stale/hand-authored review record sitting on a
 * `gray`/`purple` entry is silently ignored, falling back to the plain
 * baseline, never trusted into `green`/`yellow`. */
export function computeSinkCatalogColor(slug: string, root: string = process.cwd()): SinkCatalogColor {
  const entry = computeSinkCatalogStatus(root).find((e) => e.slug === slug);
  const baseline: SinkCatalogBaseline = entry?.baseline ?? 'gray';
  if (baseline !== 'blue') return baseline;

  const review = loadReviewVerdicts(root)[slug];
  if (review?.verdict === 'reject') return 'yellow';
  if (review?.verdict === 'confirm') {
    const currentFingerprint = computeSinkCatalogFingerprint(slug, root);
    if (!review.fingerprint || !currentFingerprint || review.fingerprint !== currentFingerprint) return 're-review';
    return 'green';
  }
  return baseline;
}

// Per-root memoization — same rationale/shape `sink-derivation-status.ts`'s
// own cache establishes (real, benchmarked fs-read cost, called once per
// tracked entry on every consultation of `isSinkCatalogEntryUsable`, static
// for the life of one process run).
const colorCache = new Map<string, Map<string, SinkCatalogColor>>();

function cachedColor(slug: string, root: string): SinkCatalogColor {
  let cache = colorCache.get(root);
  if (!cache) {
    cache = new Map();
    colorCache.set(root, cache);
  }
  let color = cache.get(slug);
  if (color === undefined) {
    color = computeSinkCatalogColor(slug, root);
    cache.set(slug, color);
  }
  return color;
}

/** Test-only escape hatch: clears the per-root color cache. Never called by
 * production code. */
export function resetSinkCatalogColorCacheForTests(): void {
  colorCache.clear();
}

/**
 * Is catalog entry `slug`'s LIVE status usable — i.e. trustworthy enough to
 * actually attach to a card (`sink-attachment.ts`) or otherwise rely on for
 * real matching? Only `blue`/`green` are; `gray`/`purple`/`yellow`/
 * `re-review` return `false` — the caller must treat the entry as not
 * (yet, or no longer) trustworthy, never throw. Cached per `root`.
 */
export function isSinkCatalogEntryUsable(slug: string, root: string = process.cwd()): boolean {
  const color = cachedColor(slug, root);
  return color === 'blue' || color === 'green';
}
