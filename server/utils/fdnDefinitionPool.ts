// Shared FDN CardDefinition pool loader — every real
// `functional-model/fdn-cards/<slug>/definition.ts` currently on disk, as a
// plain `CardDefinition[]`. Extracted from
// `server/api/card/[set]/[number].ts`'s own `loadFdnDefinitionPool` (same
// name, same shape, same cache convention — see that file's own doc comment
// for the full "why vite-node, not a plain import()" reasoning: Day of
// Judgment's own `program` effect needs a real VALUE-level relative import
// resolved, which plain Node ESM resolution can't do but vite-node's own
// resolver tolerates) so a SECOND route (`server/api/sink-catalog/index.get.ts`,
// 2026-09-18: real per-entry producer/consumer match lists) doesn't have to
// duplicate this cache/spawn machinery — that route's own caller reuses this
// module directly rather than re-deriving a second copy that could drift.
// `server/api/card/[set]/[number].ts` itself keeps its own private copy for
// now (not touched by this extraction, to avoid an unrelated edit to a
// file another specialist may have in flight) — a future pass could point
// it at this module too.
//
// Dev-only, same posture as its origin: none of this (readdirSync over
// functional-model/fdn-cards/, spawning vite-node) survives a production
// Netlify Function bundle — callers should gate on `process.env.NODE_ENV
// !== 'production'` themselves, same as every other FDN-pool consumer.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CardDefinition } from '../../functional-model/card';

const execFileAsync = promisify(execFile);

let fdnDefinitionPoolCache: { signature: string; pool: CardDefinition[] } | null = null;

export async function loadFdnDefinitionPool(root: string = process.cwd()): Promise<CardDefinition[]> {
  const dir = join(root, 'functional-model', 'fdn-cards');
  let slugs: string[];
  try {
    slugs = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
  const signature = slugs
    .map((s) => {
      try {
        return `${s}:${statSync(join(dir, s, 'definition.ts')).mtimeMs}`;
      } catch {
        return `${s}:x`;
      }
    })
    .join('|');
  if (fdnDefinitionPoolCache && fdnDefinitionPoolCache.signature === signature) return fdnDefinitionPoolCache.pool;

  let pool: CardDefinition[] = [];
  try {
    const { stdout } = await execFileAsync(join(root, 'node_modules/.bin/vite-node'), [
      join(root, 'functional-model/scripts/list-fdn-definitions.mjs'),
    ]);
    pool = JSON.parse(stdout);
  } catch {
    // Whole-pool failure (vite-node itself missing, etc.) degrades to an
    // empty pool rather than a route-wide 500 — same "nothing real to
    // compute against" fallback every other FDN axis already has.
  }
  fdnDefinitionPoolCache = { signature, pool };
  return pool;
}
