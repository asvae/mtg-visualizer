// Sink-derivation-predicate status suite — GET /api/sink-derivations.
// Read-only reporting mirror of GET /api/engine-status
// (server/api/engine-status/index.get.ts), but for a genuinely different
// axis: one row per mechanism whose real gameplay consequences are
// emergent from generic engine automation (Saga, Stun counters, Finality
// counters, Crew) rather than visible via `CardDefinition` effect-walking
// — see `functional-model/sink-derivation-status.ts`'s own header for the
// full design writeup and the real finding that motivated tracking these.
//
// See `.claude/contracts/sink-derivation-status-schema.md` for the full
// served-shape contract (owner: `engine` agent; consumer: `ui` agent's
// not-yet-built status page).
//
// Baseline (`gray`/`purple`/`blue`) is computed fresh off real filesystem
// presence of a predicate module + its corpus-verification manifest, by
// `computeSinkDerivationStatus()` — see that function's own module doc
// comment. `yellow`/`green` are a human-review OVERLAY on top, loaded from
// `functional-model/sink-derivation-reviews.json` (same split
// `server/api/engine-status/index.get.ts`'s own `engine-status-reviews.json`
// overlay already establishes) — written by this route's own sibling,
// `./review.post.ts`.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { computeSinkDerivationStatus, computeSinkDerivationColor } from '../../../functional-model/sink-derivation-status';
import type {
  SinkDerivationBaseline,
  SinkDerivationColor,
  SinkDerivationEvidence,
  SinkDerivationExpectedShape,
} from '../../../functional-model/sink-derivation-status';
import { readFunctionalModelFile, type SourceFileResult } from '../../../functional-model/source-files';

const REVIEWS_PATH = join(process.cwd(), 'functional-model', 'sink-derivation-reviews.json');

/**
 * Real, on-disk content for the 3 files backing one mechanism's predicate
 * status — so a reviewer can actually read the predicate's own logic, the
 * corpus manifest's real per-case verdicts (`SourceFileResult.content` here
 * is the manifest's RAW file text, deliberately not just the `{total,
 * passing}` summary `evidence.corpusTotal`/`corpusPassing` already carry —
 * a reviewer needs the actual per-card `cases` array to judge anything),
 * and the corpus test file itself. Every one of the 4 seeded mechanisms
 * has a real, deterministic path for all three (`functional-model/
 * sink-model/predicates/<slug>.ts` / `<slug>.corpus.json` / `<slug>.test.ts`)
 * whether or not the file actually exists yet — `stun-counters`/
 * `finality-counters` (still `gray`, no predicate built) correctly come
 * back with `exists: false` on all three, not an error.
 */
export interface SinkDerivationSourceFiles {
  predicate: SourceFileResult;
  corpusManifest: SourceFileResult;
  corpusTest: SourceFileResult;
}

function loadSourceFiles(slug: string, evidence: SinkDerivationEvidence): SinkDerivationSourceFiles {
  const root = process.cwd();
  const testPath = evidence.predicateModulePath.replace(/\.ts$/, '.test.ts');
  return {
    predicate: readFunctionalModelFile(root, evidence.predicateModulePath),
    corpusManifest: readFunctionalModelFile(root, evidence.corpusManifestPath),
    corpusTest: readFunctionalModelFile(root, testPath),
  };
}

export interface SinkDerivationReview {
  verdict: 'confirm' | 'reject';
  /** Required (by `./review.post.ts`) for a `'reject'` verdict — the whole point of yellow is "reviewed AND here's the real disagreement found," not a bare downgrade. Optional, but welcome, for `'confirm'`. */
  note?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  /** Snapshotted by `./review.post.ts` only for a `'confirm'` verdict —
   * `computeSinkDerivationFingerprint(slug)`'s own value at the moment of
   * confirmation (hashes the predicate module's + corpus manifest's real
   * current content). Compared against the CURRENT fingerprint below on
   * every read; a mismatch downgrades the served `color` from `green` to
   * `re-review` (2026-09-18) instead of trusting a now-stale confirmation.
   * Unused for `'reject'`. */
  fingerprint?: string;
}

function loadReviews(): Record<string, SinkDerivationReview> {
  if (!existsSync(REVIEWS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(REVIEWS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export interface SinkDerivationPageEntry {
  key: string;
  slug: string;
  label: string;
  motivation: string;
  expectedSinkShapes: SinkDerivationExpectedShape[];
  /** The real, computed gray/purple/blue call — UNCHANGED by review (kept alongside `color` so a consumer can always see what the reviewer actually overrode, and why `color` differs from it). */
  baseline: SinkDerivationBaseline;
  evidence: SinkDerivationEvidence;
  /** Real, on-disk content for the 3 files backing this mechanism — see `SinkDerivationSourceFiles`'s own doc comment. */
  sourceFiles: SinkDerivationSourceFiles;
  /** `baseline`, unless a human review overlay upgrades it to `yellow`/`green` — see `SinkDerivationReview` above. This is the field a consumer should render/filter on. */
  color: SinkDerivationColor;
  review?: SinkDerivationReview;
}

export default defineEventHandler((): SinkDerivationPageEntry[] => {
  const root = process.cwd();
  const baselineEntries = computeSinkDerivationStatus(root);
  const reviews = loadReviews();

  return baselineEntries.map((entry): SinkDerivationPageEntry => {
    const review = reviews[entry.key];
    // Color computation (baseline-gating a review overlay to `blue`-only,
    // plus the `re-review` fingerprint-drift check) lives in
    // `functional-model/sink-derivation-status.ts`'s own
    // `computeSinkDerivationColor` — the SAME real-matching-usability-gate
    // logic `isSinkDerivationMechanismUsable` consults, reused here directly
    // rather than re-duplicated a second time in this route (unlike
    // `server/api/engine-status/index.get.ts`, which has no equivalent
    // core-module function to call and so keeps its own small
    // `colorFor` copy — see that file's own comment for why).
    const color: SinkDerivationColor = computeSinkDerivationColor(entry.slug, root);
    return { ...entry, sourceFiles: loadSourceFiles(entry.slug, entry.evidence), color, review };
  });
});
