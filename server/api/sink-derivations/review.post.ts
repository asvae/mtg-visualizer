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
import { computeSinkDerivationStatus, computeSinkDerivationFingerprint } from '../../../functional-model/sink-derivation-status';
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

  const root = process.cwd();
  const entries = computeSinkDerivationStatus(root);
  const entry = entries.find((e) => e.key === key);
  if (!key || !entry) {
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
  // Confirm/reject are only meaningful on a `blue` baseline (2026-09-18) —
  // "was this mechanism ever actually corpus-verified" is a precondition for
  // either "a human confirmed it" or "a human rejected it" being a real
  // claim; a `gray`/`purple` mechanism (no predicate yet, or not yet
  // corpus-verified) was never claimed to be verified in the first place, so
  // reviewing it either way is semantically meaningless. Clearing a review
  // (`verdict: null`/`undefined`) is always allowed regardless of the
  // current baseline — same "un-reviewing never needs a precondition"
  // posture FIN's own `field:'review', reviewed:false` Unconfirm action
  // already has.
  if ((verdict === 'confirm' || verdict === 'reject') && entry.baseline !== 'blue') {
    setResponseStatus(event, 400);
    return {
      error: `"${key}" is currently ${entry.baseline}, not blue (or a stale, drifted re-review) — confirm/reject is only meaningful once a mechanism has actually reached the corpus-verified baseline`,
    };
  }

  const reviews = loadReviews();
  if (verdict === 'confirm') {
    reviews[key] = {
      verdict,
      note: note?.trim() || undefined,
      reviewedAt: new Date().toISOString().slice(0, 10),
      reviewedBy,
      fingerprint: computeSinkDerivationFingerprint(entry.slug, root) ?? undefined,
    };
  } else if (verdict === 'reject') {
    reviews[key] = { verdict, note: note?.trim() || undefined, reviewedAt: new Date().toISOString().slice(0, 10), reviewedBy };
  } else {
    delete reviews[key];
  }

  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(reviews, null, 2) + '\n', 'utf8');

  return { key, color: verdict === 'reject' ? 'yellow' : verdict === 'confirm' ? 'green' : null };
});
