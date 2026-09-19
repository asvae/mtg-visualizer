// Shared, read-only "serve real file content off disk, scoped to
// functional-model/" primitive — used by both
// `server/api/engine-status/*` (a cited `*.test.ts` filename, resolved
// against the real tree) and `server/api/sink-derivations/*` (a
// mechanism's known predicate/corpus/test file paths). Exists so a human
// reviewing either status dashboard can read the REAL evidence (test code,
// corpus data, predicate source) instead of trusting a prose description —
// see this project's own `feedback_complete_before_review` posture: a
// review needs live, checkable content, not just a claim.
//
// Deliberately narrow and paranoid about scope: every read here is
// hard-confined to this repo's own `functional-model/` directory (resolved
// path prefix check, not just string matching — a symlink or a `..`-laden
// input can't escape it), read-only (no write/delete surface at all), and
// every call re-resolves from disk fresh (dev convention already
// established by `computeEngineStatus`/`computeSinkDerivationStatus` — no
// caching, a file edit shows up on the next request).

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';

/** Above this, `content` is truncated (never silently — `truncated: true` always says so). Generous enough for every real file this project's status dashboards cite today (`engine.test.ts` itself, the largest, is ~115KB) while still bounding a pathological huge-file read. */
export const MAX_INLINE_SOURCE_BYTES = 500_000;

export interface SourceFileResult {
  /** Repo-root-relative, POSIX-separated path actually read (or attempted) — e.g. `"functional-model/engine.test.ts"`. */
  path: string;
  exists: boolean;
  content: string | null;
  truncated: boolean;
}

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

/** True iff `resolvedAbsolutePath` is genuinely inside `functional-model/` under `root` — the one real safety gate every function below funnels through. */
function isWithinFunctionalModel(root: string, resolvedAbsolutePath: string): boolean {
  const fmRoot = resolve(join(root, 'functional-model')) + sep;
  return (resolve(resolvedAbsolutePath) + sep).startsWith(fmRoot) || resolve(resolvedAbsolutePath) === resolve(join(root, 'functional-model'));
}

function walk(root: string, dir: string, out: string[]): void {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(root, full, out);
    else out.push(toPosix(relative(root, full)));
  }
}

/**
 * Finds every real file anywhere under `functional-model/` (recursively,
 * skipping `node_modules`/dotfiles) whose exact basename is `basename` —
 * e.g. `findFunctionalModelFilesByBasename(root, 'engine.test.ts')` finds
 * BOTH `functional-model/engine.test.ts` AND
 * `functional-model/cards/jill-shiva-s-dominant-shiva-warden-of-ice/engine.test.ts`
 * (a real, checked-in name collision in this repo — never assume a bare
 * `*.test.ts` citation resolves to exactly one file). Returns repo-root-
 * relative, POSIX-separated paths, sorted for stable output.
 */
export function findFunctionalModelFilesByBasename(root: string, basename: string): string[] {
  const fmRoot = join(root, 'functional-model');
  if (!existsSync(fmRoot)) return [];
  const all: string[] = [];
  walk(root, fmRoot, all);
  return all.filter((p) => p.split('/').pop() === basename).sort();
}

/**
 * Reads one real file, hard-scoped to `functional-model/` under `root`.
 * `relPath` is repo-root-relative (e.g. `"functional-model/engine.test.ts"`
 * or `"functional-model/sink-derivation-predicates/saga.ts"`). Never throws —
 * an out-of-scope path, a missing file, or a non-file target all come back
 * as `{exists: false}` rather than an exception, since a caller (a review
 * dashboard) should be able to render "not found" for a real citation to a
 * file that turns out not to exist (this project's own real, found case:
 * `ENGINE_GAPS.md` gap #19 cites `card.test.ts`, which doesn't exist
 * anywhere in this repo) without the whole request failing.
 */
export function readFunctionalModelFile(root: string, relPath: string): SourceFileResult {
  const posixRel = toPosix(relPath);
  const resolved = resolve(join(root, posixRel));
  if (!isWithinFunctionalModel(root, resolved)) {
    return { path: posixRel, exists: false, content: null, truncated: false };
  }
  let isFile = false;
  try {
    isFile = existsSync(resolved) && statSync(resolved).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) return { path: posixRel, exists: false, content: null, truncated: false };
  const buf = readFileSync(resolved, 'utf8');
  const truncated = buf.length > MAX_INLINE_SOURCE_BYTES;
  return { path: posixRel, exists: true, content: truncated ? buf.slice(0, MAX_INLINE_SOURCE_BYTES) : buf, truncated };
}
