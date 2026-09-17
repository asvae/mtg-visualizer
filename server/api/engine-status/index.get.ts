// Engine-capability status suite — GET /api/engine-status. Read-only
// reporting mirror of GET /api/keywords (server/api/keywords/index.get.ts)
// and GET /api/recognizers (server/api/recognizers/index.get.ts), but for a
// genuinely different, SPARSE, organically-growing axis: one row per real
// gap/capability already tracked in `functional-model/ENGINE_GAPS.md`'s own
// "Real gaps — prioritized" numbered list — NOT an a-priori enumeration of
// every historical MTG keyword (see `functional-model/engine-status.ts`'s
// own header for the full design writeup and why that was the corrected
// approach).
//
// See `.claude/contracts/engine-status-schema.md` for the full served-shape
// contract (owner: `engine` agent; consumer: `ui` agent's not-yet-built
// status page).
//
// Baseline (`gray`/`purple`/`blue`) is computed fresh off `ENGINE_GAPS.md`
// every request by `computeEngineStatus()` — see that function's own module
// doc comment for exactly what real, checkable signal decides each
// baseline. `yellow`/`green` are a human-review OVERLAY on top, loaded from
// `functional-model/engine-status-reviews.json` (same split
// `server/api/keywords/index.get.ts`'s own `review-status.json` overlay
// already establishes for that page's own, different, 3-way status) —
// written by this route's own sibling, `./review.post.ts`.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { computeEngineStatus, computeEngineStatusFingerprint } from '../../../functional-model/engine-status';
import type { EngineStatusBaseline, EngineStatusColor, EngineStatusEvidence } from '../../../functional-model/engine-status';
import { findFunctionalModelFilesByBasename } from '../../../functional-model/source-files';

const REVIEWS_PATH = join(process.cwd(), 'functional-model', 'engine-status-reviews.json');

/**
 * One real, on-disk citation from `evidence.testFiles` — resolved (not just
 * named) against the actual repo tree, so a consumer can go straight to
 * `GET /api/engine-status/source?path=...` instead of guessing a path from
 * a bare filename. `matches` is an ARRAY, not a single path: this repo has
 * a real, checked-in basename collision (`engine.test.ts` exists both at
 * `functional-model/engine.test.ts` AND
 * `functional-model/cards/jill-shiva-s-dominant-shiva-warden-of-ice/engine.test.ts`)
 * — collapsing that to one guessed path would silently misattribute
 * evidence. Empty `matches` (ENGINE_GAPS.md's own real gap #19, which cites
 * a `card.test.ts` that does not exist anywhere in this repo) is reported
 * as-is, not hidden.
 */
export interface EngineStatusTestFileRef {
  file: string;
  matches: string[];
}

function resolveTestFileRefs(testFiles: string[]): EngineStatusTestFileRef[] {
  const root = process.cwd();
  return testFiles.map((file) => ({ file, matches: findFunctionalModelFilesByBasename(root, file) }));
}

export interface EngineStatusReview {
  verdict: 'confirm' | 'reject';
  /** Required (by `./review.post.ts`) for a `'reject'` verdict — the whole point of yellow is "reviewed AND here's why it's wrong," not a bare downgrade. Optional, but welcome, for `'confirm'`. */
  note?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  /** Snapshotted by `./review.post.ts` only for a `'confirm'` verdict —
   * `computeEngineStatusFingerprint(gapNumber)`'s own value at the moment of
   * confirmation. Compared against the CURRENT fingerprint below on every
   * read; a mismatch downgrades the served `color` from `green` to
   * `re-review` (2026-09-18) instead of trusting a now-stale confirmation.
   * Unused for `'reject'`. */
  fingerprint?: string;
}

function loadReviews(): Record<string, EngineStatusReview> {
  if (!existsSync(REVIEWS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(REVIEWS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export interface EngineStatusPageEntry {
  key: string;
  gapNumber: number;
  title: string;
  /** The real, computed gray/purple/blue call — UNCHANGED by review (kept alongside `color` so a consumer can always see what the reviewer actually overrode, and why `color` differs from it). */
  baseline: EngineStatusBaseline;
  evidence: EngineStatusEvidence;
  /** Real on-disk resolution of every `evidence.testFiles` citation — see `EngineStatusTestFileRef`'s own doc comment for why this is an array of matches, not one guessed path, and why an empty array is a real, reportable outcome (a citation to a file that doesn't exist), not an error. Fetch actual content for one via `GET /api/engine-status/source?path=<one of these matches>`. */
  testFileRefs: EngineStatusTestFileRef[];
  /** `baseline`, unless a human review overlay upgrades it to `yellow`/`green` — see `EngineStatusReview` above. This is the field a consumer should render/filter on. */
  color: EngineStatusColor;
  review?: EngineStatusReview;
}

// A review overlay (confirm/reject) is only ever meaningful on a `blue`
// baseline (2026-09-18) — "was this gap ever actually verified" is a
// precondition for either "a human confirmed it" or "a human rejected it";
// this dashboard's own confirm/reject write path (`./review.post.ts`) now
// refuses a `gray`/`purple` entry outright, but `engine-status-reviews.json`
// is still a flat, hand-editable file (not exclusively written through that
// gated route) — so this is enforced HERE too, at read time, as defense in
// depth: a stale/hand-authored review sitting on a `gray`/`purple` gap is
// silently ignored (falls back to the plain baseline), never trusted into a
// misleading `green`/`yellow`.
function colorFor(root: string, entry: { gapNumber: number; baseline: EngineStatusBaseline }, review: EngineStatusReview | undefined): EngineStatusColor {
  if (entry.baseline !== 'blue') return entry.baseline;
  if (review?.verdict === 'reject') return 'yellow';
  if (review?.verdict === 'confirm') {
    const currentFingerprint = computeEngineStatusFingerprint(entry.gapNumber, root);
    if (!review.fingerprint || !currentFingerprint || review.fingerprint !== currentFingerprint) return 're-review';
    return 'green';
  }
  return entry.baseline;
}

export default defineEventHandler((): EngineStatusPageEntry[] => {
  const root = process.cwd();
  const baselineEntries = computeEngineStatus(root);
  const reviews = loadReviews();

  return baselineEntries.map((entry): EngineStatusPageEntry => {
    const review = reviews[entry.key];
    const color = colorFor(root, entry, review);
    return { ...entry, testFileRefs: resolveTestFileRefs(entry.evidence.testFiles), color, review };
  });
});
