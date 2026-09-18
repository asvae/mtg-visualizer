// Writes functional-model/fdn-cards/<slug>/pipeline-status.json's own
// blue -> yellow|green review transition — the SAME confirm/reject shape
// server/api/engine-status/review.post.ts and
// server/api/sink-derivations/review.post.ts already establish for their
// own axes, adapted to this axis's genuinely simpler shape: ONE file per
// card (`pipeline-status.json` itself), no separate reviews-overlay JSON
// map keyed by an id — see functional-model/pipeline-status.ts's own
// header ("Review actions") for why `applyPipelineReview` is a pure
// `blue -> yellow|green` transition on that one file, and this route's own
// job is simply "read it, gate it, transition it, write it back."
//
// POST /api/fdn-cards/:slug/review, body:
//   { verdict: 'ok' } | { verdict: 'not-ok', reviewNote: string }
// -> the updated PipelineStatusFile, as JSON.
//
// - 404 if `functional-model/fdn-cards/<slug>/pipeline-status.json` doesn't
//   exist at all (nothing to review — this card hasn't even entered the
//   pipeline, see `readPipelineStatus`'s own "(no folder at all)" case).
// - 400 if a FRESH re-run of the deterministic gate
//   (`validate-card-definition.mjs`'s own `validateCardDefinition`) against
//   the card's CURRENT `definition.ts` doesn't pass — NEVER gated on the
//   stored `pipeline-status.json`'s own `status`/`effectivePipelineStatus`
//   directly, precisely so this route supports "reject after fully
//   CONFIRMED" (and "confirm after fully REJECTED") the same way
//   `engine-status`/`sink-derivations`' own review routes already do for
//   their axes (their `baseline` is always recomputed fresh from real
//   content, never frozen by a prior review outcome — confirmed live
//   2026-09-18: rejecting an already-confirmed predicate/gap succeeds
//   there with no 400). Naming: yellow = "Rejected", green = "Confirmed",
//   matching Predicates'/Features'/Cards' own `STATUS_OPTIONS`.
// - On success, calls `applyPipelineReview` against a FRESH `{status:
//   'blue', ...}` built from that gate re-run (not the stale stored file),
//   stamping a fresh `reviewedFingerprint` on an `'ok'` verdict via
//   `computePipelineDefinitionFingerprint` (see that function's own doc
//   comment for why the hash is computed HERE, by this route, not inside
//   the pure transition function itself), writes the result back to
//   `pipeline-status.json`, and returns it.
//
// Dev-only, same posture as the rest of this fdn wiring
// (`server/api/card-status/[set].get.ts`'s own `fdn` branch, `data/
// cards.db` never shipped to production) — no production branch needed;
// a request in production simply 403s below, same as
// `engine-status`/`sink-derivations`'s own review routes.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  applyPipelineReview,
  computePipelineDefinitionFingerprint,
  readPipelineStatus,
  type PipelineReviewAction,
  type PipelineStatusFile,
} from '../../../../functional-model/pipeline-status';
import { isSinkAttachmentComplete } from '../../../../functional-model/sink-attachment';

const execFileAsync = promisify(execFile);

// `validate-card-definition.mjs`'s own header is explicit: it MUST run
// under `vite-node` (it dynamically imports sibling `.ts` files like
// `card.ts`/`combinator.ts`) — a plain Nitro-bundled `import` of it (tried
// first, reverted) 500s at request time with a broken absolute-path module
// resolution once bundled into `.nuxt/dev/index.mjs`, the exact "can't
// dynamic-import functional-model's raw source tree" class of problem
// `server/api/card-status/[set].get.ts`'s own `computeAllCardStatusLive`
// already solved the same way: spawn it as a real subprocess via the
// project's own `vite-node` binary and parse its stdout, never a static
// `import`.
async function runGate(slug: string, root: string): Promise<{ ok: boolean; failureKind?: string; reasons: string[] }> {
  const cliPath = join(root, 'functional-model', 'scripts', 'validate-card-definition-cli.mjs');
  try {
    const { stdout } = await execFileAsync(join(root, 'node_modules/.bin/vite-node'), [cliPath, slug]);
    return JSON.parse(stdout);
  } catch (err) {
    // execFile rejects on the CLI's own non-zero exit (a real gate failure,
    // not a crash) — its stdout (the real JSON result) is still on the
    // error object, same `err.stdout` shape `execFileAsync` always attaches.
    const stdout = (err as { stdout?: string }).stdout;
    if (stdout) return JSON.parse(stdout);
    throw err;
  }
}

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production') {
    setResponseStatus(event, 403);
    return { error: 'fdn-cards review is dev-only' };
  }

  const slug = getRouterParam(event, 'slug');
  if (!slug) {
    setResponseStatus(event, 400);
    return { error: 'missing :slug' };
  }

  const root = process.cwd();
  const stored = readPipelineStatus(slug, root);
  if (!stored) {
    setResponseStatus(event, 404);
    return { error: `no functional-model/fdn-cards/${slug}/pipeline-status.json — this card hasn't entered the pipeline yet, nothing to review` };
  }

  const body = await readBody(event).catch(() => null);
  const verdict: 'ok' | 'not-ok' | undefined = body?.verdict;
  const reviewNote: string | undefined = body?.reviewNote;

  if (verdict !== 'ok' && verdict !== 'not-ok') {
    setResponseStatus(event, 400);
    return { error: 'verdict must be "ok" or "not-ok"' };
  }
  if (verdict === 'not-ok' && !reviewNote?.trim()) {
    setResponseStatus(event, 400);
    return { error: 'a "not-ok" verdict (Rejected) needs a non-empty "reviewNote" explaining why — that\'s the whole point of this state' };
  }

  // Confirm/reject are gated on a FRESH re-run of the deterministic gate
  // against the card's CURRENT `definition.ts` — never the stale stored
  // `status` (which, once a review has already been recorded, reads
  // `yellow`/`green`, not `blue`, even though the underlying content may
  // still gate clean). This is the same "baseline is always recomputed
  // fresh from real content, independent of any prior review outcome"
  // pattern `server/api/engine-status/review.post.ts`/`server/api/
  // sink-derivations/review.post.ts` already establish for their own axes
  // (their own `baseline` field never changes just because a review was
  // recorded on top of it) — confirmed live 2026-09-18: rejecting an
  // already-CONFIRMED predicate/gap succeeds there with no 400, so this
  // route must support the exact same "reject after fully confirmed" (and
  // "confirm after fully rejected") action, not just blue's first review.
  const gate = await runGate(slug, root);
  if (!gate.ok) {
    setResponseStatus(event, 400);
    return {
      error: `"${slug}" currently fails the schema-validation gate (${gate.failureKind ?? 'unknown'}) — confirm/reject is only meaningful once the card's current definition.ts actually passes it: ${gate.reasons.join('; ')}`,
    };
  }

  // The SECOND, genuinely separate half of "effectively blue"
  // (functional-model/pipeline-status.ts's own `blue` redefinition,
  // `effectivePipelineStatus`) — closes the gap that same file's own doc
  // comment and .claude/contracts/card-schema.md's "Sink CATALOG..." section
  // both explicitly flag: a card whose schema gate passes fresh is NOT yet
  // reviewable if its own per-card sink-ATTACHMENT step
  // (functional-model/fdn-cards/<slug>/sinks.json,
  // functional-model/sink-attachment.ts) hasn't been explicitly completed —
  // never inferred from `gate.ok` alone. Deliberately re-derives the same
  // "schema-pass AND attachment-complete -> effectively blue" rule
  // `effectivePipelineStatus` applies to a STORED entry, rather than calling
  // that function directly against the stored `pipeline-status.json` —
  // doing so would break this route's own pre-existing "reject after
  // already-confirmed"/"confirm after already-rejected" support (a stored
  // `yellow`/`green` entry's `effectivePipelineStatus` is never `'blue'`,
  // even though this route's own `gate` re-run above is intentionally
  // decoupled from that stored status for exactly that reason).
  if (!isSinkAttachmentComplete(slug, root)) {
    setResponseStatus(event, 400);
    return {
      error: `"${slug}" passes the schema-validation gate but its sink-attachment step (functional-model/fdn-cards/${slug}/sinks.json) isn't complete yet — attach this card's real catalog sinks (zero is a legitimate outcome) and mark that step reviewed via POST /api/fdn-cards/${slug}/sinks before requesting a pipeline review.`,
    };
  }

  const freshBlue: PipelineStatusFile = { status: 'blue', reasons: [], computedAt: new Date().toISOString() };

  const action: PipelineReviewAction =
    verdict === 'ok'
      ? { verdict: 'ok', reviewedFingerprint: computePipelineDefinitionFingerprint(slug, root) ?? undefined }
      : { verdict: 'not-ok', reviewNote: reviewNote!.trim() };

  const updated: PipelineStatusFile = applyPipelineReview(freshBlue, action);

  const dir = join(root, 'functional-model', 'fdn-cards', slug);
  const path = join(dir, 'pipeline-status.json');
  if (!existsSync(dir)) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(updated, null, 2) + '\n', 'utf8');

  return updated;
});
