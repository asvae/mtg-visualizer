// Writes functional-model/sink-derivation-reviews.json's own human-review
// overlay for ONE tracked sink-derivation-predicate mechanism — the
// yellow/green half of GET /api/sink-derivations's 5-state axis
// (gray/purple/blue computed fresh off real predicate-module/corpus-
// manifest filesystem presence, see ./index.get.ts +
// functional-model/sink-derivation-status.ts; this endpoint only ever
// writes a review verdict ON TOP of that computed baseline, never the
// baseline itself). Same dev-only/no-audit-trail posture, and same flat
// identity-keyed shape, as server/api/engine-status/review.post.ts.
//
// POST /api/sink-derivations/review, body:
//   { key: string, verdict: 'confirm' | 'reject', note?: string, reviewedBy?: string }
// -> { key: string, color: 'yellow' | 'green' }
// Clear a review (fall back to the computed baseline again) by posting the
// same key with `verdict: null`.
//
// `key` is validated against a FRESH `computeSinkDerivationStatus()` call
// (not a hand-kept id list — this axis's whole index is the small, statically
// seeded `SINK_DERIVATION_MECHANISMS` list, but validating live still means a
// slug rename/removal there can't silently leave a stale review orphaned
// without at least being checkable).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { computeSinkDerivationStatus } from '../../../functional-model/sink-derivation-status';
import type { SinkDerivationReview } from './index.get';

const STORE_PATH = join(process.cwd(), 'functional-model', 'sink-derivation-reviews.json');

function loadReviews(): Record<string, SinkDerivationReview> {
  if (!existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production') {
    setResponseStatus(event, 403);
    return { error: 'sink-derivations review is dev-only' };
  }

  const body = await readBody(event).catch(() => null);
  const key: string | undefined = body?.key;
  const verdict: 'confirm' | 'reject' | null | undefined = body?.verdict;
  const note: string | undefined = body?.note;
  const reviewedBy: string | undefined = body?.reviewedBy;

  const validKeys = new Set(computeSinkDerivationStatus().map((e) => e.key));
  if (!key || !validKeys.has(key)) {
    setResponseStatus(event, 404);
    return { error: `no sink-derivation entry for key "${key}"` };
  }
  if (verdict !== 'confirm' && verdict !== 'reject' && verdict !== null && verdict !== undefined) {
    setResponseStatus(event, 400);
    return { error: 'verdict must be "confirm", "reject", or null (to clear a review)' };
  }
  if (verdict === 'reject' && !note?.trim()) {
    setResponseStatus(event, 400);
    return { error: 'a "reject" verdict (yellow) needs a non-empty "note" explaining the disagreement found — that\'s the whole point of this state' };
  }

  const reviews = loadReviews();
  if (verdict === 'confirm' || verdict === 'reject') {
    reviews[key] = { verdict, note: note?.trim() || undefined, reviewedAt: new Date().toISOString().slice(0, 10), reviewedBy };
  } else {
    delete reviews[key];
  }

  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(reviews, null, 2) + '\n', 'utf8');

  return { key, color: verdict === 'reject' ? 'yellow' : verdict === 'confirm' ? 'green' : null };
});
