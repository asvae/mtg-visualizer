# A single unguarded top-level throw anywhere in the Nitro dev bundle breaks unrelated routes with TDZ errors

**Symptom seen 2026-09-19**: every `server/api/**/index.get.ts` route 500ed
with `Cannot access 'index_get$N' before initialization` (N varying by
route) — reproduced on both the shared dev server and a from-scratch
`.nuxt` clean rebuild, so not stale-chunk cruft. A subset of routes (`/api/
docs`, `/api/engine-status`) kept working; everything else, plus eventually
the app's own SSR fallback (`Cannot access 'renderer' before
initialization`), broke.

**Root cause**: Nitro's dev server bundles the ENTIRE server tree (every
route + its whole transitive import graph, including the SSR renderer
itself) into ONE monolithic file (`.nuxt/dev/index.mjs`), evaluated
strictly top-to-bottom exactly once at server start. A newly-added file,
`functional-model/scripts/experiments/forge-json-compiler/
load-token-scripts.ts`, computed a path at MODULE TOP LEVEL using
`import.meta.dirname`:
```ts
const REPO_ROOT = resolve(import.meta.dirname, '../../../..');
```
Nitro/rollup rewrites `import.meta.dirname` in this context to
`globalThis._importMeta_.dirname`, which isn't populated for a module
reached this way — `resolve(undefined, ...)` throws synchronously,
uncaught, during the bundle's one-time top-level evaluation. Every
top-level `const` textually positioned AFTER that throw point in the
flattened bundle never finishes initializing (permanent TDZ); anything
positioned before it (alphabetically-earlier routes, in this case) works
fine. The reported "before initialization" variable name is just whatever
Nitro-generated local binding happens to sit downstream — unrelated to the
actual fault, which is why the error pointed at `index_get$7`/`renderer`/
etc. instead of the real culprit.

**Fix**: never compute a path from `import.meta.dirname` at a server-reachable
module's top level — use `process.cwd()`-relative resolution instead (the
established convention every other dev-only server util in this codebase
already follows, e.g. `forgeJsonCompiler.ts`'s own `root = process.cwd()`
parameter). Fixed in `load-token-scripts.ts` 2026-09-19. Two sibling files
in the same experiment dir (`run-experiment.ts`, `fdn-1-50.test.ts`) still
use `import.meta.dirname` but are standalone `vite-node`/vitest entry
points never imported by any `server/api/**` route — not part of this
bundle, left alone.

**Lesson for next time**: a Nitro-dev TDZ error naming an unrelated-looking
variable (`index_get$N`, `renderer`, a module namespace object) is a strong
signal to look for an uncaught top-level throw SOMEWHERE in the server
import graph, not a naming collision or circular-import ordering bug in the
route that actually 500ed. Bisect via a disposable `git worktree` at HEAD
(rsync in working-tree subtrees incrementally) rather than `git stash` —
stashing is blocked by this environment's sandbox as an "irreversible
local destruction."
