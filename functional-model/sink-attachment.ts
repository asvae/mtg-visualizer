// Per-card sink ATTACHMENT — `functional-model/fdn-cards/<slug>/sinks.json`,
// a sibling file to that same card's own `pipeline-status.json`. Answers a
// genuinely different question from the sink CATALOG itself
// (`sink-catalog-status.ts`, "is this shared query correct"): "which of the
// catalog's reviewed sinks does THIS card actually want, and has that
// determination been explicitly made yet at all."
//
// **Confirmed with the user**: a card can legitimately want ZERO catalog
// sinks — Serra Angel (FDN) is the real, named example, a vanilla flying/
// vigilance beater with no real synergy hooks at all. The requirement for
// pipeline completeness (`pipeline-status.ts`'s own 2026-09-18 `blue`
// redefinition) is that the attachment STEP was explicitly performed, never
// that the resulting `attachedSlugs` count is nonzero — see
// `functional-model/fdn-cards/serra-angel/sinks.json` for the real,
// zero-sink, `reviewed: true` file this produces.
//
// Mirrors `pipeline-status.ts`'s own fingerprint-drift convention
// (`computePipelineDefinitionFingerprint`) rather than importing it
// directly — `pipeline-status.ts` itself imports FROM this file (to
// implement its own `blue` redefinition), so importing the other way here
// would be a real circular dependency; the ~10-line duplication is the same
// "small, deliberate, documented" tradeoff `sink-derivation-status.ts`'s own
// header already accepts for a comparable situation.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readFunctionalModelFile } from './source-files';
import { SINK_CATALOG } from './sink-model/catalog/index';

export interface SinkAttachmentFile {
  /** Catalog-sink slugs (`sink-model/catalog/<slug>.ts`) this card's own
   * author determined it genuinely wants — an EMPTY array is a legitimate,
   * complete outcome (see this file's own header, Serra Angel). */
  attachedSlugs: string[];
  /** True iff the attachment step was EXPLICITLY performed for this card —
   * the real gate `pipeline-status.ts`'s `blue` redefinition checks. Never
   * inferred from `attachedSlugs.length > 0` (a card with a real, deliberate
   * zero-sink outcome still needs this set `true` to be considered done). */
  reviewed: boolean;
  /** ISO timestamp of the review action — set iff `reviewed`. */
  reviewedAt?: string;
  /** `computeDefinitionFingerprint(slug)`'s own sha256 of this card's real
   * `definition.ts` content, snapshotted the moment `reviewed` was set —
   * set iff `reviewed`. Compared against a FRESH fingerprint on every read
   * (`effectiveSinkAttachmentStatus` below); a mismatch (or this field
   * missing entirely, an old pre-fingerprint entry) means the card's
   * definition changed since the attachment step was done, so the
   * attachment can no longer be trusted as still-complete without a fresh
   * look — same drift-detection convention `pipeline-status.ts`'s own
   * `reviewedFingerprint` already establishes for its own `green` state. */
  reviewedFingerprint?: string;
  /** ISO timestamp this entry was last computed/written — informational
   * only, mirrors `pipeline-status.ts`'s own `computedAt`. */
  computedAt: string;
}

export type SinkAttachmentStatus = 'not-started' | 'incomplete' | 're-review' | 'complete';

function attachmentPath(slug: string, root: string): string {
  return join(root, 'functional-model', 'fdn-cards', slug, 'sinks.json');
}

/**
 * Reads `functional-model/fdn-cards/<slug>/sinks.json` off disk —
 * `undefined` for "no folder/file at all" (the real, common, transparent
 * "attachment step not started yet" case) AND for a genuinely unparseable
 * file, same "an ambiguous case falls back to the lowest known state, never
 * guessed upward" policy `readPipelineStatus` already establishes. Never
 * throws.
 */
export function readSinkAttachment(slug: string, root: string = process.cwd()): SinkAttachmentFile | undefined {
  const path = attachmentPath(slug, root);
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.attachedSlugs) || typeof parsed.reviewed !== 'boolean') {
      return undefined;
    }
    return parsed as SinkAttachmentFile;
  } catch {
    return undefined;
  }
}

/**
 * Real, current sha256 of `functional-model/fdn-cards/<slug>/definition.ts`
 * — the same input `pipeline-status.ts`'s own
 * `computePipelineDefinitionFingerprint` hashes, duplicated here (see this
 * file's own header for why) rather than imported.
 */
export function computeDefinitionFingerprint(slug: string, root: string = process.cwd()): string | null {
  const result = readFunctionalModelFile(root, join('functional-model', 'fdn-cards', slug, 'definition.ts'));
  if (!result.exists) return null;
  const hash = createHash('sha256');
  hash.update(result.content ?? '');
  return hash.digest('hex');
}

/**
 * Real, checkable problems with an attachment file's own `attachedSlugs` —
 * today, just "does every referenced slug actually exist in the shared
 * catalog." Returns an empty array for a genuinely valid attachment
 * (including the zero-slug case, which is trivially valid — nothing to
 * check). Never throws.
 */
export function validateSinkAttachment(file: SinkAttachmentFile): string[] {
  const known = new Set(SINK_CATALOG.map((e) => e.slug));
  return file.attachedSlugs.filter((slug) => !known.has(slug)).map((slug) => `unknown catalog slug: '${slug}'`);
}

/**
 * The real, drift-aware attachment status a consumer should trust — never a
 * stored `reviewed: true` blindly. `'not-started'` — no `sinks.json` at all.
 * `'incomplete'` — `reviewed` is `false`, OR `attachedSlugs` references a
 * slug that doesn't exist in `SINK_CATALOG` (a broken reference never counts
 * as done, even if someone marked it `reviewed`). `'re-review'` — `reviewed`
 * is `true` and every referenced slug is valid, but this card's own
 * `definition.ts` has changed since the attachment step was performed (or
 * the file predates fingerprinting and never recorded one at all).
 * `'complete'` — `reviewed`, every referenced slug valid, and the
 * fingerprint matches the card's own current `definition.ts`.
 */
export function effectiveSinkAttachmentStatus(slug: string, root: string = process.cwd()): SinkAttachmentStatus {
  const file = readSinkAttachment(slug, root);
  if (!file) return 'not-started';
  if (!file.reviewed) return 'incomplete';
  if (validateSinkAttachment(file).length > 0) return 'incomplete';
  const current = computeDefinitionFingerprint(slug, root);
  if (!file.reviewedFingerprint || !current || file.reviewedFingerprint !== current) return 're-review';
  return 'complete';
}

/** The boolean gate `pipeline-status.ts`'s own `blue` redefinition consumes
 * — `true` iff `effectiveSinkAttachmentStatus` is `'complete'`. */
export function isSinkAttachmentComplete(slug: string, root: string = process.cwd()): boolean {
  return effectiveSinkAttachmentStatus(slug, root) === 'complete';
}

/**
 * Builds a fresh, `reviewed: true` `SinkAttachmentFile` for `slug` —
 * `attachedSlugs` may legitimately be empty (see this file's own header).
 * Stamps `reviewedFingerprint` off the card's own CURRENT `definition.ts`
 * (a real fs read, same "the caller/writer computes the hash, not a bare
 * pure-function transition" split `pipeline-status.ts`'s own
 * `applyPipelineReview` already establishes for its analogous case — this
 * function is intentionally the impure "real writer-facing" half, not a
 * pure transition function, since there's no separate multi-state review
 * action to keep pure here the way `applyPipelineReview` has).
 */
export function markSinkAttachmentReviewed(
  slug: string,
  attachedSlugs: string[],
  root: string = process.cwd(),
  now: string = new Date().toISOString(),
): SinkAttachmentFile {
  return {
    attachedSlugs,
    reviewed: true,
    reviewedAt: now,
    reviewedFingerprint: computeDefinitionFingerprint(slug, root) ?? undefined,
    computedAt: now,
  };
}

/** Thin writer — persists a `SinkAttachmentFile` to
 * `functional-model/fdn-cards/<slug>/sinks.json`, creating the card's own
 * folder if needed (mirrors how a future authoring script would call this;
 * no server route exists yet, unlike `pipeline-status.json`'s own
 * `POST /api/fdn-cards/:slug/review` — a genuinely separate,
 * not-yet-built follow-up, flagged in `.claude/contracts/card-schema.md`). */
export function writeSinkAttachment(slug: string, file: SinkAttachmentFile, root: string = process.cwd()): void {
  const path = attachmentPath(slug, root);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
}
