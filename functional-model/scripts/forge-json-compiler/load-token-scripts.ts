/**
 * Minimal, standalone reader for real Forge token-script files
 * (`tmp/mtg-forge/forge-gui/res/tokenscripts/<id>.txt`) — the IO half of
 * `compile-forge-card.ts`'s own `resolveTokenScript` (kept OUT of that
 * file deliberately, see its own `currentTokenScripts` doc comment: this
 * compiler stays a pure translation table, IO lives in the
 * runner/harness). Only reads the same narrow field set
 * `ForgeTokenScript` declares (`Name`/`ManaCost`/`Types`/`PT`/`K`) — a
 * token script's own ability lines (`A:`) are read by nothing here, same
 * scope `resolveTokenScript` itself accepts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ForgeTokenScript } from './compile-forge-card';

// `process.cwd()`-relative, NOT `import.meta.dirname`-relative — this file
// is statically imported (via `server/utils/forgeJsonCompiler.ts`) into
// Nitro's dev server bundle, which flattens every route's transitive
// imports into ONE monolithic top-to-bottom-evaluated module
// (`.nuxt/dev/index.mjs`). Nitro/rollup rewrites `import.meta.dirname`
// there to `globalThis._importMeta_.dirname`, which is NOT populated for a
// module reached this way — `resolve(undefined, ...)` throws synchronously
// at module-evaluation time (`TypeError: The "paths[0]" argument must be of
// type string. Received undefined`), an UNCAUGHT top-level throw that kills
// the rest of that bundle's linear evaluation. Every route/const declared
// later in the same bundle (textually after this file's inlined position)
// is left in the TDZ forever after — surfaces at request time as
// `Cannot access '<anything>' before initialization` on totally unrelated
// routes (even Nuxt's own SSR `renderer`), not as an error pointing back
// here. `process.cwd()` is the same convention every sibling dev-only
// server util in this codebase already uses (see `forgeJsonCompiler.ts`'s
// own `root = process.cwd()` parameter) — safe here for the same reason:
// this whole tool is dev-only/local-only (it needs a local Forge checkout), always run from the repo root.
const TOKENSCRIPTS_DIR = resolve(process.cwd(), 'tmp/mtg-forge/forge-gui/res/tokenscripts');

/** Parses ONE real token-script `.txt` file's `Name`/`ManaCost`/`Types`/`PT`/`K:` lines — deliberately narrow, same "only what this compiler needs" scope as `forge_json_mapper.py` started from, not a second general parser. */
function parseTokenScriptFile(text: string): ForgeTokenScript {
  const lines = text.split('\n').filter((l) => l.length > 0);
  const result: Partial<ForgeTokenScript> & { K: string[] } = { K: [] };
  for (const line of lines) {
    const [prefix, ...rest] = line.split(':');
    const value = rest.join(':');
    if (prefix === 'Name') result.Name = value;
    else if (prefix === 'ManaCost') result.ManaCost = value;
    else if (prefix === 'Types') result.Types = value;
    else if (prefix === 'PT') result.PT = value;
    else if (prefix === 'K') result.K.push(value);
    // A:/Oracle:/Colors:/etc. lines are deliberately ignored — see this
    // module's own header.
  }
  if (result.Name === undefined) throw new Error(`token script has no Name: line`);
  return { Name: result.Name, ...(result.ManaCost !== undefined ? { ManaCost: result.ManaCost } : {}), ...(result.Types !== undefined ? { Types: result.Types } : {}), ...(result.PT !== undefined ? { PT: result.PT } : {}), ...(result.K.length > 0 ? { K: result.K } : {}) };
}

/** Reads and parses one real token script by id (`w_3_3_knight` -> `tokenscripts/w_3_3_knight.txt`). Throws loudly (ENOENT propagates) if the id doesn't exist — no silent fallback. */
export function loadTokenScript(id: string): ForgeTokenScript {
  const path = resolve(TOKENSCRIPTS_DIR, `${id}.txt`);
  return parseTokenScriptFile(readFileSync(path, 'utf8'));
}

/** Loads every id in `ids` into the `Record<string, ForgeTokenScript>` shape `compileForgeCard`'s own `tokenScripts` parameter expects. */
export function loadTokenScripts(ids: string[]): Record<string, ForgeTokenScript> {
  const out: Record<string, ForgeTokenScript> = {};
  for (const id of ids) out[id] = loadTokenScript(id);
  return out;
}
