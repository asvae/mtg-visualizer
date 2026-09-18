// Writes functional-model/fdn-cards/<slug>/sinks.json's own per-card sink
// ATTACHMENT step (functional-model/sink-attachment.ts) — a genuinely
// different, EARLIER pipeline step than review.post.ts's own
// pipeline-status.json Confirm/Reject (see this route's own doc comment,
// and pipeline-status.ts's own `blue` redefinition header): "which of the
// shared SINK_CATALOG entries does this card's author determine it
// genuinely wants, and mark that determination explicitly done." A card
// can legitimately want ZERO catalog sinks (Serra Angel's own real shape)
// — `attachedSlugs: []` is accepted the same as any non-empty array.
//
// POST /api/fdn-cards/:slug/sinks, body: { attachedSlugs: string[] }
// -> the freshly-written SinkAttachmentFile, as JSON.
//
// - 403 in production — same dev-only posture as
//   server/api/fdn-cards/[slug]/review.post.ts (this whole fdn wiring never
//   ships; data/cards.db never shipped either).
// - 400 if the body's `attachedSlugs` isn't a real string array.
// - 404 if functional-model/fdn-cards/<slug>/definition.ts doesn't exist at
//   all — nothing to attach sinks to (mirrors review.post.ts's own "no
//   pipeline-status.json -> 404, this card hasn't entered the pipeline yet"
//   posture, just checked against the one file that's ALWAYS present the
//   moment a card folder exists, since a fresh card's own attachment step
//   often runs before pipeline-status.json's first `blue` write).
// - 400 if any `attachedSlugs` entry isn't a real, registered
//   `SINK_CATALOG` slug (`validateSinkAttachment` — reused, not
//   re-implemented here) — never silently accepted; the catalog is the ONE
//   shared source of truth for which sinks exist at all.
// - On success: builds a fresh, `reviewed: true` `SinkAttachmentFile` via
//   `markSinkAttachmentReviewed` (stamps `reviewedFingerprint` off this
//   card's CURRENT `definition.ts`, exactly the fingerprint-drift
//   convention `pipeline-status.ts`'s own `green` state already
//   establishes), writes it via `writeSinkAttachment`, and returns it.
//   `effectivePipelineStatus`'s own `blue` redefinition (functional-model/
//   pipeline-status.ts) picks this up on the very next read — no separate
//   write needed here to keep the two files in sync.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  computeDefinitionFingerprint,
  markSinkAttachmentReviewed,
  validateSinkAttachment,
  writeSinkAttachment,
  type SinkAttachmentFile,
} from '../../../../functional-model/sink-attachment';

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production') {
    setResponseStatus(event, 403);
    return { error: 'fdn-cards sink attachment is dev-only' };
  }

  const slug = getRouterParam(event, 'slug');
  if (!slug) {
    setResponseStatus(event, 400);
    return { error: 'missing :slug' };
  }

  const root = process.cwd();
  const definitionPath = join(root, 'functional-model', 'fdn-cards', slug, 'definition.ts');
  if (!existsSync(definitionPath)) {
    setResponseStatus(event, 404);
    return { error: `no functional-model/fdn-cards/${slug}/definition.ts — this card hasn't entered the pipeline yet, nothing to attach sinks to` };
  }

  const body = await readBody(event).catch(() => null);
  const attachedSlugs: unknown = body?.attachedSlugs;
  if (!Array.isArray(attachedSlugs) || !attachedSlugs.every((s) => typeof s === 'string')) {
    setResponseStatus(event, 400);
    return { error: '"attachedSlugs" must be a string array (may be empty — zero attached sinks is a real, legitimate outcome)' };
  }

  // Validated via a throwaway candidate file — `validateSinkAttachment`
  // only ever looks at `attachedSlugs`, so `reviewed`/`computedAt` here are
  // placeholders, never persisted (the real write below builds its own
  // fresh, correctly-stamped file via `markSinkAttachmentReviewed`).
  const problems = validateSinkAttachment({ attachedSlugs, reviewed: true, computedAt: new Date().toISOString() });
  if (problems.length > 0) {
    setResponseStatus(event, 400);
    return { error: `invalid attachedSlugs: ${problems.join('; ')}` };
  }

  if (computeDefinitionFingerprint(slug, root) === null) {
    // Should be unreachable given the existsSync check above, but never
    // trust a second read implicitly agreeing with the first.
    setResponseStatus(event, 404);
    return { error: `could not read functional-model/fdn-cards/${slug}/definition.ts` };
  }

  const file: SinkAttachmentFile = markSinkAttachmentReviewed(slug, attachedSlugs, root);
  writeSinkAttachment(slug, file, root);
  return file;
});
