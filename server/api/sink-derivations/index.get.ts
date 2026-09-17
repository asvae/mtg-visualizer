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
import { computeSinkDerivationStatus } from '../../../functional-model/sink-derivation-status';
import type {
  SinkDerivationBaseline,
  SinkDerivationColor,
  SinkDerivationEvidence,
  SinkDerivationExpectedShape,
} from '../../../functional-model/sink-derivation-status';

const REVIEWS_PATH = join(process.cwd(), 'functional-model', 'sink-derivation-reviews.json');

export interface SinkDerivationReview {
  verdict: 'confirm' | 'reject';
  /** Required (by `./review.post.ts`) for a `'reject'` verdict — the whole point of yellow is "reviewed AND here's the real disagreement found," not a bare downgrade. Optional, but welcome, for `'confirm'`. */
  note?: string;
  reviewedAt?: string;
  reviewedBy?: string;
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
  /** `baseline`, unless a human review overlay upgrades it to `yellow`/`green` — see `SinkDerivationReview` above. This is the field a consumer should render/filter on. */
  color: SinkDerivationColor;
  review?: SinkDerivationReview;
}

export default defineEventHandler((): SinkDerivationPageEntry[] => {
  const baselineEntries = computeSinkDerivationStatus();
  const reviews = loadReviews();

  return baselineEntries.map((entry): SinkDerivationPageEntry => {
    const review = reviews[entry.key];
    const color: SinkDerivationColor =
      review?.verdict === 'reject' ? 'yellow' : review?.verdict === 'confirm' ? 'green' : entry.baseline;
    return { ...entry, color, review };
  });
});
