// Sink CATALOG entry status suite — GET /api/sink-catalog.
// Read-only reporting mirror of GET /api/sink-derivations
// (server/api/sink-derivations/index.get.ts), but for a genuinely
// different axis: one row per REVIEWED, SHARED catalog entry
// (`functional-model/sink-model/catalog/<slug>.ts`) rather than per
// engine-automation mechanism — see
// `functional-model/sink-catalog-status.ts`'s own header for the full
// gray/purple/blue/yellow/green/re-review design, and
// `.claude/contracts/card-schema.md`'s "Sink CATALOG..." section for the
// full contract this route serves.
//
// Baseline (`gray`/`purple`/`blue`) is computed fresh off real filesystem
// presence of a catalog entry's own structural-gate corpus manifest, by
// `computeSinkCatalogStatus()`. `yellow`/`green` are a human-review OVERLAY
// on top, loaded from `functional-model/sink-catalog-reviews.json` (same
// split `server/api/sink-derivations/index.get.ts`'s own
// `sink-derivation-reviews.json` overlay already establishes) — written by
// this route's own sibling, `./review.post.ts`.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { computeSinkCatalogStatus, computeSinkCatalogColor } from '../../../functional-model/sink-catalog-status';
import type { SinkCatalogBaseline, SinkCatalogColor, SinkCatalogEvidence } from '../../../functional-model/sink-catalog-status';
import { SINK_CATALOG } from '../../../functional-model/sink-model/catalog/index';
import type { SinkQuery } from '../../../functional-model/sink-model/sink-query';
import { readFunctionalModelFile, type SourceFileResult } from '../../../functional-model/source-files';
import { matchSink, matchesConsumerTriggerNames, matchesConsumerTriggerOn } from '../../../functional-model/sink-model/match-sink';
import { loadFdnDefinitionPool } from '../../utils/fdnDefinitionPool';
import type { CardDefinition } from '../../../functional-model/card';

const REVIEWS_PATH = join(process.cwd(), 'functional-model', 'sink-catalog-reviews.json');
const CATALOG_DIR = join('functional-model', 'sink-model', 'catalog');

/**
 * Real, on-disk content for the 3 files backing one catalog entry's own
 * status — same "a reviewer needs the actual per-case cases array/real
 * predicate logic, not just the summarized {total,passing}" rationale
 * `server/api/sink-derivations/index.get.ts`'s own `loadSourceFiles`
 * doc comment already establishes.
 */
export interface SinkCatalogSourceFiles {
  entry: SourceFileResult;
  corpusManifest: SourceFileResult;
  corpusTest: SourceFileResult;
}

function loadSourceFiles(slug: string, evidence: SinkCatalogEvidence): SinkCatalogSourceFiles {
  const root = process.cwd();
  return {
    entry: readFunctionalModelFile(root, join(CATALOG_DIR, `${slug}.ts`)),
    corpusManifest: readFunctionalModelFile(root, evidence.corpusManifestPath),
    corpusTest: readFunctionalModelFile(root, join(CATALOG_DIR, `${slug}.test.ts`)),
  };
}

export interface SinkCatalogReview {
  verdict: 'confirm' | 'reject';
  /** Required (by `./review.post.ts`) for a `'reject'` verdict — same
   * "that's the whole point of yellow" rule `SinkDerivationReview.note`
   * already enforces. Optional, but welcome, for `'confirm'`. */
  note?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  /** Snapshotted by `./review.post.ts` only for a `'confirm'` verdict —
   * `computeSinkCatalogFingerprint(slug)`'s own value at the moment of
   * confirmation. Compared against the CURRENT fingerprint on every read;
   * a mismatch downgrades the served `color` from `green` to `re-review`
   * instead of trusting a now-stale confirmation. Unused for `'reject'`. */
  fingerprint?: string;
}

function loadReviews(): Record<string, SinkCatalogReview> {
  if (!existsSync(REVIEWS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(REVIEWS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Real FDN cards (dev pool, `functional-model/fdn-cards/`, via the shared
 * `loadFdnDefinitionPool`) that actually match this entry TODAY — the
 * mocked-fixture corpus manifest (`evidence`/`sourceFiles.corpusManifest`
 * above) answers "does the curated query/consumer signal behave correctly
 * against a hand-picked fixture set," this answers the separate, real-world
 * question "who in the CURRENT pool actually satisfies it." Computed
 * UNCONDITIONALLY (not gated on this entry's own review `color`) — a
 * reviewer needs to see real matches for a not-yet-verified (`gray`/
 * `purple`) entry too, to help decide whether it's even right; this is a
 * different concern from `card-interactions.ts`'s own `isSinkCatalogEntryUsable`
 * gate, which protects the PRODUCTION card page from an unverified entry,
 * not this review tool.
 *
 * `producerMatches` — every pool card whose own structural occurrences
 * (`matchSink`, same producer-shaped check the corpus test itself uses)
 * satisfy `entry.query` ("who CAUSES this event"). `consumerMatches` —
 * every pool card recognized via EITHER real consumer-side signal an entry
 * may declare (`entry.consumerTriggerNames` via `matchesConsumerTriggerNames`,
 * a free-text `Trigger.name` check; `entry.consumerTriggerOn` via
 * `matchesConsumerTriggerOn`, the engine's own closed `Trigger.on` enum —
 * see `catalog/entry.ts`'s own doc comments for why both exist and why
 * `consumerTriggerOn` is the safer of the two) — merged into one list
 * (union, not two further sub-lists) since both answer the exact same
 * "who OWNS/REACTS to this event" question, just via different structural
 * evidence; omitted entirely (not just empty) when the entry declares
 * NEITHER consumer-side mechanism, per this task's own explicit "no empty
 * consumer section needed" instruction. Kept separate from
 * `producerMatches` rather than merged with it — a card can appear in
 * both, and collapsing that distinction would hide exactly the producer-
 * vs-consumer role confusion this task exists to make visible (e.g.
 * Felidar Savior: producer of Lifegain; Ajani's Pridemate: consumer of it,
 * never a producer).
 */
export interface SinkCatalogRealMatches {
  producerMatches: string[];
  consumerMatches?: string[];
}

export interface SinkCatalogPageEntry {
  /** Stable identity key — a catalog entry has no separate `key`/`slug`
   * split the way sink-derivation mechanisms do (`sink-catalog-status.ts`'s
   * own `SinkCatalogStatusEntry` carries only `slug`) — reused directly as
   * both the served identity and the review-overlay key. */
  slug: string;
  category: string;
  /** The entry's own real, full curated query — the QUESTION this catalog
   * entry answers (`sink-model/catalog/entry.ts`'s own `SinkCatalogEntry
   * .query`). Read straight off `SINK_CATALOG` (not derived from
   * `computeSinkCatalogStatus`, which only surfaces `category`). */
  query: SinkQuery;
  /** The real, computed gray/purple/blue call — UNCHANGED by review (kept
   * alongside `color` so a consumer can always see what the reviewer
   * actually overrode, and why `color` differs from it). */
  baseline: SinkCatalogBaseline;
  evidence: SinkCatalogEvidence;
  /** Real, on-disk content for the 3 files backing this entry — see
   * `SinkCatalogSourceFiles`'s own doc comment. */
  sourceFiles: SinkCatalogSourceFiles;
  /** `baseline`, unless a human review overlay upgrades it to
   * `yellow`/`green`/`re-review` — see `SinkCatalogReview` above. This is
   * the field a consumer should render/filter on. */
  color: SinkCatalogColor;
  review?: SinkCatalogReview;
  /** `undefined` in production (see `loadFdnDefinitionPool`'s own doc
   * comment — the dev-only FDN pool never survives a Netlify Function
   * bundle); a real entry list otherwise, `producerMatches: []` (not
   * omitted) when the pool is genuinely empty (no `fdn-cards/` folders
   * yet) — an honest "nothing to match against yet," not hidden. */
  realMatches?: SinkCatalogRealMatches;
}

function computeRealMatches(entry: (typeof SINK_CATALOG)[number], pool: CardDefinition[], root: string): SinkCatalogRealMatches {
  const producerMatches = pool.filter((c) => matchSink(entry.query, c, root).matched).map((c) => c.name).sort();
  const result: SinkCatalogRealMatches = { producerMatches };
  const hasConsumerSignal = (entry.consumerTriggerNames && entry.consumerTriggerNames.length > 0) || (entry.consumerTriggerOn && entry.consumerTriggerOn.length > 0);
  if (hasConsumerSignal) {
    const consumerNames = new Set(
      pool
        .filter((c) => matchesConsumerTriggerNames(entry.consumerTriggerNames, c) || matchesConsumerTriggerOn(entry.consumerTriggerOn, c))
        .map((c) => c.name),
    );
    result.consumerMatches = [...consumerNames].sort();
  }
  return result;
}

export default defineEventHandler(async (): Promise<SinkCatalogPageEntry[]> => {
  const root = process.cwd();
  const baselineEntries = computeSinkCatalogStatus(root);
  const reviews = loadReviews();
  // Dev-only real FDN pool (see `loadFdnDefinitionPool`'s own doc comment):
  // loaded ONCE per request, shared across every entry below, rather than
  // once per entry — the whole point of the shared, process-cached loader.
  const pool = process.env.NODE_ENV === 'production' ? [] : await loadFdnDefinitionPool(root);

  return baselineEntries.map((entry): SinkCatalogPageEntry => {
    const catalogEntry = SINK_CATALOG.find((e) => e.slug === entry.slug);
    const review = reviews[entry.slug];
    // Color computation (baseline-gating a review overlay to `blue`-only,
    // plus the `re-review` fingerprint-drift check) lives in
    // `functional-model/sink-catalog-status.ts`'s own
    // `computeSinkCatalogColor` — reused here directly rather than
    // re-duplicated, same as `server/api/sink-derivations/index.get.ts`'s
    // own `computeSinkDerivationColor` reuse.
    const color: SinkCatalogColor = computeSinkCatalogColor(entry.slug, root);
    return {
      slug: entry.slug,
      category: entry.category,
      // Every real `SINK_CATALOG` slug (this list is built directly off
      // that same array — `entry.slug` above) always has a matching
      // module by construction; the `?? { category }` fallback only
      // guards a same-request race with a hot-reloaded catalog, never a
      // real steady-state path.
      query: catalogEntry?.query ?? ({ category: entry.category } as SinkQuery),
      baseline: entry.baseline,
      evidence: entry.evidence,
      sourceFiles: loadSourceFiles(entry.slug, entry.evidence),
      color,
      review,
      realMatches: catalogEntry && process.env.NODE_ENV !== 'production' ? computeRealMatches(catalogEntry, pool, root) : undefined,
    };
  });
});
