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
import { computeEngineStatus } from '../../../functional-model/engine-status';
import type { EngineStatusBaseline, EngineStatusColor, EngineStatusEvidence } from '../../../functional-model/engine-status';

const REVIEWS_PATH = join(process.cwd(), 'functional-model', 'engine-status-reviews.json');

export interface EngineStatusReview {
  verdict: 'confirm' | 'reject';
  /** Required (by `./review.post.ts`) for a `'reject'` verdict — the whole point of yellow is "reviewed AND here's why it's wrong," not a bare downgrade. Optional, but welcome, for `'confirm'`. */
  note?: string;
  reviewedAt?: string;
  reviewedBy?: string;
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
  /** `baseline`, unless a human review overlay upgrades it to `yellow`/`green` — see `EngineStatusReview` above. This is the field a consumer should render/filter on. */
  color: EngineStatusColor;
  review?: EngineStatusReview;
}

export default defineEventHandler((): EngineStatusPageEntry[] => {
  const baselineEntries = computeEngineStatus();
  const reviews = loadReviews();

  return baselineEntries.map((entry): EngineStatusPageEntry => {
    const review = reviews[entry.key];
    const color: EngineStatusColor =
      review?.verdict === 'reject' ? 'yellow' : review?.verdict === 'confirm' ? 'green' : entry.baseline;
    return { ...entry, color, review };
  });
});
