// Writes cards/<slug>/progress.json's own `scenariosReview`/`interactionsReview`
// fields — each a SEPARATE axis from `review` (that one's the synergy.json
// FACTS review) and from each other: "has a human actually looked at [the
// Scenarios tab's own replay content / this card's own Interactions list]
// and confirmed it's correct." The card page shows each via a "[Draft]"
// suffix (server/api/card/[set]/[number].ts's own fields of the same name)
// plus a button here to flip it. One endpoint, `field` says which axis —
// kept to this exact allow-list so the request body can't write an
// arbitrary progress.json key.
//
// POST /api/card/review-status, body { name: string, field: 'scenariosReview' | 'interactionsReview', reviewed: boolean }

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { slugify } from '../../../app/lib/buildGraph';

const REVIEW_FIELDS = new Set(['scenariosReview', 'interactionsReview']);

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  const name: string | undefined = body?.name;
  const field: string | undefined = body?.field;
  const reviewed: boolean | undefined = body?.reviewed;
  if (!name || !field || !REVIEW_FIELDS.has(field) || typeof reviewed !== 'boolean') {
    setResponseStatus(event, 400);
    return { error: `missing/invalid "name" (string), "field" (one of ${[...REVIEW_FIELDS].join(', ')}), or "reviewed" (boolean) in request body` };
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
  progress[field] = reviewed ? 'reviewed' : 'draft';

  mkdirSync(dir, { recursive: true });
  writeFileSync(progressPath, JSON.stringify(progress, null, 2) + '\n', 'utf8');

  return { [field]: progress[field] };
});
