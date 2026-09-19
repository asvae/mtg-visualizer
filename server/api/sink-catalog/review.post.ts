// Writes functional-model/matcher-catalog-reviews.json's own human-review
// overlay for ONE catalog entry — the yellow/green half of
// GET /api/sink-catalog's 6-state axis (gray/purple/blue computed fresh off
// real corpus-manifest filesystem presence, see ./index.get.ts +
// functional-model/matcher-catalog-status.ts; this endpoint only ever writes a
// review verdict ON TOP of that computed baseline, never the baseline
// itself). Same dev-only/no-audit-trail posture, and same flat
// identity-keyed shape, as server/api/sink-derivations/review.post.ts.
//
// POST /api/sink-catalog/review, body:
//   { slug: string, verdict: 'confirm' | 'reject', note?: string, reviewedBy?: string }
// -> { slug: string, color: 'yellow' | 'green' | null }
// Clear a review (fall back to the computed baseline again) by posting the
// same slug with `verdict: null`.
//
// `slug` is validated against a FRESH `computeMatcherCatalogStatus()` call (not
// a hand-kept id list — same "a rename/removal there can't silently leave a
// stale review orphaned without at least being checkable" rationale
// `server/api/sink-derivations/review.post.ts` already documents).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { computeMatcherCatalogStatus, computeMatcherCatalogFingerprint } from '../../../functional-model/matcher-catalog-status';
import type { MatcherCatalogReview } from './index.get';

const STORE_PATH = join(process.cwd(), 'functional-model', 'matcher-catalog-reviews.json');

function loadReviews(): Record<string, MatcherCatalogReview> {
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
    return { error: 'sink-catalog review is dev-only' };
  }

  const body = await readBody(event).catch(() => null);
  const slug: string | undefined = body?.slug;
  const verdict: 'confirm' | 'reject' | null | undefined = body?.verdict;
  const note: string | undefined = body?.note;
  const reviewedBy: string | undefined = body?.reviewedBy;

  const root = process.cwd();
  const entries = computeMatcherCatalogStatus(root);
  const entry = entries.find((e) => e.slug === slug);
  if (!slug || !entry) {
    setResponseStatus(event, 404);
    return { error: `no sink-catalog entry for slug "${slug}"` };
  }
  if (verdict !== 'confirm' && verdict !== 'reject' && verdict !== null && verdict !== undefined) {
    setResponseStatus(event, 400);
    return { error: 'verdict must be "confirm", "reject", or null (to clear a review)' };
  }
  if (verdict === 'reject' && !note?.trim()) {
    setResponseStatus(event, 400);
    return { error: 'a "reject" verdict (yellow) needs a non-empty "note" explaining the disagreement found — that\'s the whole point of this state' };
  }
  // Confirm/reject are only meaningful on a `blue` baseline — same
  // "was this entry ever actually corpus-verified" precondition
  // `server/api/sink-derivations/review.post.ts` already enforces.
  // Clearing a review (`verdict: null`/`undefined`) is always allowed
  // regardless of the current baseline.
  if ((verdict === 'confirm' || verdict === 'reject') && entry.baseline !== 'blue') {
    setResponseStatus(event, 400);
    return {
      error: `"${slug}" is currently ${entry.baseline}, not blue (or a stale, drifted re-review) — confirm/reject is only meaningful once an entry has actually reached the corpus-verified baseline`,
    };
  }

  const reviews = loadReviews();
  if (verdict === 'confirm') {
    reviews[slug] = {
      verdict,
      note: note?.trim() || undefined,
      reviewedAt: new Date().toISOString().slice(0, 10),
      reviewedBy,
      fingerprint: computeMatcherCatalogFingerprint(entry.slug, root) ?? undefined,
    };
  } else if (verdict === 'reject') {
    reviews[slug] = { verdict, note: note?.trim() || undefined, reviewedAt: new Date().toISOString().slice(0, 10), reviewedBy };
  } else {
    delete reviews[slug];
  }

  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(reviews, null, 2) + '\n', 'utf8');

  return { slug, color: verdict === 'reject' ? 'yellow' : verdict === 'confirm' ? 'green' : null };
});
