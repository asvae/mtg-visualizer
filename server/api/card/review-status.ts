// Writes cards/<slug>/progress.json's own `review`/`scenariosReview`/
// `interactionsReview` fields — three SEPARATE axes: `review` is the
// synergy.json FACTS review (the original, pre-existing field — 'ai' vs
// 'human'), `scenariosReview`/`interactionsReview` are "has a human actually
// looked at [the Scenarios tab's own replay content / this card's own
// Interactions list] and confirmed it's correct" ('draft' vs 'reviewed').
// The card page shows each via an orange "Draft" pill (server/api/card/
// [set]/[number].ts's own fields of the same name) plus a button here to
// flip it. One endpoint, `field` says which axis — kept to this exact
// allow-list so the request body can't write an arbitrary progress.json key.
//
// Dev-only — this writes to the repo's own functional-model/ source tree,
// not a database; there's no real "reviewed by whom, when" audit trail, and
// in a real production deployment this would either silently no-op (a
// serverless function's filesystem isn't the repo checkout) or, worse on a
// host where it DOES have a writable filesystem, let any visitor flip any
// card's review status. Refused outright outside dev, same
// `NODE_ENV === 'production'` check this same route family already uses
// (server/api/card/[set]/[number].ts's own `loadJsonFresh`).
//
// POST /api/card/review-status, body { name: string, field: 'review' | 'scenariosReview' | 'interactionsReview', reviewed: boolean }

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { slugify } from '../../../app/lib/buildGraph';

// Each field's own two on-disk values — `review` predates the other two and
// kept its original 'ai'/'human' vocabulary rather than being migrated to
// 'draft'/'reviewed' just for consistency.
const REVIEW_FIELD_VALUES: Record<string, [unreviewed: string, reviewed: string]> = {
  review: ['ai', 'human'],
  scenariosReview: ['draft', 'reviewed'],
  interactionsReview: ['draft', 'reviewed'],
};

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production') {
    setResponseStatus(event, 403);
    return { error: 'review-status is dev-only' };
  }

  const body = await readBody(event).catch(() => null);
  const name: string | undefined = body?.name;
  const field: string | undefined = body?.field;
  const reviewed: boolean | undefined = body?.reviewed;
  if (!name || !field || !(field in REVIEW_FIELD_VALUES) || typeof reviewed !== 'boolean') {
    setResponseStatus(event, 400);
    return { error: `missing/invalid "name" (string), "field" (one of ${Object.keys(REVIEW_FIELD_VALUES).join(', ')}), or "reviewed" (boolean) in request body` };
  }

  const slug = slugify(name);
  const dir = join(process.cwd(), 'functional-model/cards', slug);
  if (!existsSync(dir)) {
    setResponseStatus(event, 404);
    return { error: `no functional-model card directory for "${name}" (slug "${slug}")` };
  }
  const progressPath = join(dir, 'progress.json');

  // Merge onto whatever's already there (enrichment/review/notes/knownGaps/
  // ...) rather than replacing the file — this endpoint owns exactly the
  // one field named by `field`, same "additive, don't clobber a
  // hand-authored file" discipline the rest of this session's
  // functional-model edits have followed.
  let progress: Record<string, unknown> = {};
  if (existsSync(progressPath)) {
    try {
      progress = JSON.parse(readFileSync(progressPath, 'utf8'));
    } catch {
      // malformed progress.json — overwritten below with just this field,
      // same as a missing one; better than refusing to record the review.
    }
  }
  const [unreviewedValue, reviewedValue] = REVIEW_FIELD_VALUES[field]!;
  progress[field] = reviewed ? reviewedValue : unreviewedValue;

  mkdirSync(dir, { recursive: true });
  writeFileSync(progressPath, JSON.stringify(progress, null, 2) + '\n', 'utf8');

  return { [field]: progress[field] };
});
