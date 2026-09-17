// Writes functional-model/engine-status-reviews.json's own human-review
// overlay for ONE tracked gap/capability — the yellow/green half of
// GET /api/engine-status's 5-state axis (gray/purple/blue computed fresh
// off ENGINE_GAPS.md, see ./index.get.ts + functional-model/engine-status.ts;
// this endpoint only ever writes a review verdict ON TOP of that computed
// baseline, never the baseline itself). Same dev-only/no-audit-trail
// posture as server/api/keywords/review-status.ts and
// server/api/recognizers/review-status.ts (writes into the repo's own
// source tree; a real serverless deployment's filesystem isn't the repo
// checkout anyway) — deliberately a flat, per-gap-id JSON map, not the old
// per-card review-drafts/review-responses relay queue (that queue was
// retired 2026-09-13, see scripts/REVIEW_PROCESS.md's own note — this is a
// fresh, much simpler design, not a revival of it), mirroring
// `tagging/card-enrichment-status.json`'s own flat identity-keyed shape
// instead.
//
// POST /api/engine-status/review, body:
//   { key: string, verdict: 'confirm' | 'reject', note?: string, reviewedBy?: string }
// -> { key: string, color: 'yellow' | 'green' }
// Clear a review (fall back to the computed baseline again) by posting the
// same key with `verdict: null`.
//
// `key` is validated against a FRESH `computeEngineStatus()` call (not a
// hand-kept id list — this axis's whole index is itself computed off
// ENGINE_GAPS.md, so there is no separate static id catalog to import).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { computeEngineStatus } from '../../../functional-model/engine-status';
import type { EngineStatusReview } from './index.get';

const STORE_PATH = join(process.cwd(), 'functional-model', 'engine-status-reviews.json');

function loadReviews(): Record<string, EngineStatusReview> {
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
    return { error: 'engine-status review is dev-only' };
  }

  const body = await readBody(event).catch(() => null);
  const key: string | undefined = body?.key;
  const verdict: 'confirm' | 'reject' | null | undefined = body?.verdict;
  const note: string | undefined = body?.note;
  const reviewedBy: string | undefined = body?.reviewedBy;

  const validKeys = new Set(computeEngineStatus().map((e) => e.key));
  if (!key || !validKeys.has(key)) {
    setResponseStatus(event, 404);
    return { error: `no engine-status entry for key "${key}"` };
  }
  if (verdict !== 'confirm' && verdict !== 'reject' && verdict !== null && verdict !== undefined) {
    setResponseStatus(event, 400);
    return { error: 'verdict must be "confirm", "reject", or null (to clear a review)' };
  }
  if (verdict === 'reject' && !note?.trim()) {
    setResponseStatus(event, 400);
    return { error: 'a "reject" verdict (yellow) needs a non-empty "note" explaining why — that\'s the whole point of this state' };
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
