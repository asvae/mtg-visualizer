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
