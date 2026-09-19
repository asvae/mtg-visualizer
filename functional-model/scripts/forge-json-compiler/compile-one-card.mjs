// Spawned under `vite-node` by `server/utils/forgeJsonCompiler.ts` — same
// "real value-level extensionless relative import needs vite-node's own
// resolver, not a plain Node/Nitro dynamic import()" gap
// `functional-model/scripts/run-one-card.mjs`/`list-fdn-definitions.mjs`
// already establish (see `.claude/agent-memory/card/topics/
// nitro-mjs-import-gotcha.md`), now also true of `compile-forge-card.ts`
// itself: the 2026-09-19 bounded-target ("up to N chosen targets")
// compiler support added a genuine runtime `import { ... } from
// '../../combinator'` (real values — `anyPlayer`, `selectUpTo`,
// `applyToBound`, etc. — not type-only), which a plain in-process
// `import()` can't resolve the same way this file's OWN extensionless
// specifier (`'../../combinator'`, no `.ts`) can't resolve under plain
// Node ESM either.
//
// Usage: npx vite-node functional-model/scripts/forge-json-compiler/compile-one-card.mjs <forge-json-path>
//
// Reads the real Forge-JSON file at that path, compiles it, and prints
// ONE JSON envelope to stdout — `{ ok: true, compiled }` or `{ ok: false,
// error }` — always exit 0 on a real compile attempt (the caller
// distinguishes success/failure from the envelope, not the exit code) so a
// `compileForgeCard` throw (`UnsupportedForgeShape`, a missing SVar, ...)
// degrades to reported information the same way it already did when this
// ran in-process, rather than becoming an opaque subprocess failure. Only
// a genuinely unusable invocation (no path argument, unreadable/malformed
// JSON file) exits non-zero — those are caller-error cases the route
// itself already guards against before spawning this.
import { readFileSync } from 'node:fs';
import { compileForgeCard } from './compile-forge-card.ts';
import { loadTokenScripts } from './load-token-scripts.ts';
import { TOKEN_SCRIPT_IDS } from './fdn-1-50-cases.ts';

const forgeJsonPath = process.argv[2];
if (!forgeJsonPath) {
  console.error('usage: compile-one-card.mjs <forge-json-path>');
  process.exit(1);
}

const forgeJson = JSON.parse(readFileSync(forgeJsonPath, 'utf8'));

// Same tolerance `forgeJsonCompiler.ts`'s own `getTokenScripts` already had
// in-process: a missing local `tmp/mtg-forge/` checkout degrades every
// token-needing card to a reported compile error (via the `catch` below),
// not a crash here that would take down every other card's own attempt.
let tokenScripts = {};
try {
  tokenScripts = loadTokenScripts(TOKEN_SCRIPT_IDS);
} catch {
  // fall through with {}
}

try {
  const compiled = compileForgeCard(forgeJson, tokenScripts);
  process.stdout.write(JSON.stringify({ ok: true, compiled }));
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
}
