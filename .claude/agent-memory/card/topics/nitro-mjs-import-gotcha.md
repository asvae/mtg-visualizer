# Nitro dev bundler can't resolve a dynamically-imported `.mjs` sibling

`server/api/card/**` routes need to run real `functional-model/` logic
(pure `.mjs` scripts, or dynamic `import()` of a card's own `.ts`) at
request time. A **plain, in-process dynamic `import()` of a `.mjs` script**
that sits next to already-dynamically-imported `.ts` files is NOT traced/
rewritten by Nitro's dev bundler the same way this route's other imports
are — it typechecks clean (`npx tsc --noEmit` passes) but throws at real
runtime: `Cannot find module '/functional-model/scripts/foo.mjs' imported
from .../.nuxt/dev/index.mjs`.

**The established, working pattern**: spawn the script as a **child
process under `vite-node`** (`execFileAsync(vite-node, [...])`) instead of
importing it in-process. This is what `computeTracesLive` (dynamic
`definition.ts` execution) and `computeCardStatusLive`/
`computeAllCardStatusLive` (`compute-one-card-status.mjs`/
`compute-all-card-status.mjs`) all do. Same reasoning both times: a bare
dynamic import works for the TS card files (Nitro's dev bundler does trace
those, since they're under `functional-model/cards/**` which the route's
existing import graph already touches) but a *sibling `.mjs` script* is a
separate case that isn't traced at all.

**Lesson for next time**: don't trust `npx tsc --noEmit` alone to validate
a new import path added to a `server/api/card/**` route — always hit the
real dev server too. This route family in particular has confirmed,
hit-the-hard-way gaps between what typechecks and what Nitro can actually
bundle/resolve at request time.

Production has a related but different constraint: raw `fs` reads and any
subprocess spawn (`vite-node`, etc.) against `functional-model/` don't work
at all in a Netlify Function (the raw tree isn't shipped) — see
`topics/prod-functional-model-bundle.md`.

**2026-09-19 update**: this same gap hit `server/utils/forgeJsonCompiler.ts`
too, and its own header comment (before this fix) is a live example of the
"don't trust it forever" lesson above — it explicitly asserted
`functional-model/scripts/forge-json-compiler/compile-forge-card.ts` had
"no real value-level relative import" and used a plain in-process dynamic
`import()` on that basis. That was true when written, then a same-day
schema-agent change (bounded-target `selectUpTo`/`applyToBound` compiler
support) added a genuine runtime `import { anyPlayer, ... } from
'../../combinator'` to that file, and the route started 500ing with the
exact `Cannot find module '.../combinator'` signature this doc predicts.
Fixed the same way: added a thin wrapper script
(`functional-model/scripts/forge-json-compiler/compile-one-card.mjs`,
modeled directly on `run-one-card.mjs`/`list-fdn-definitions.mjs` — reads
the Forge-JSON file, calls `compileForgeCard`, prints a `{ok, ...}` JSON
envelope to stdout) and had `forgeJsonCompiler.ts` spawn it via
`execFileAsync(vite-node, [...])` instead of importing `compile-forge-card.ts`
directly. Lesson sharpened: a file that's "type-only imports, safe for
plain `import()`" today is not a permanent property — anything that spawns
a subprocess for this reason should keep doing so once any genuine runtime
import lands anywhere in that module's own import chain, not re-litigate
per file each time one is added.
