# card agent notes

Scoped working memory for the `card` specialist. Update before finishing
any task: decisions made, open questions, current state worth resuming
from. This is what makes a fresh respawn cheap — don't rely on transcript
resume alone (session transcripts are swept after ~30 days).

## Decisions

- 2026-09-07: Fixed prod 500 on POST /api/card/fin/1 (Netlify Function
  ENOENT scandir '/var/task/functional-model'). Root cause:
  `server/api/card/[set]/[number].ts`'s `loadFunctionalModel` (added in
  d9f749e, "compute functional-model traces live") does raw
  `fs.readdirSync`/`readFileSync` against `functional-model/` and spawns
  `node_modules/.bin/vite-node` as a child process to actually execute a
  card's `scenarios.ts`/engine core, at request time. None of that ships
  in a Netlify Function bundle (Nitro's Rollup bundler only ships files it
  can statically trace as imports; `functional-model/`'s raw .ts sources
  and the vite-node dev binary are read/spawned dynamically, never
  imported). Every OTHER functional-model/ fs access in this route family
  already tolerated a missing dir via try/catch (`loadFunctionalModelPool`
  → `[]`, `loadCardSynergy` → `null`, `review-status.ts`'s explicit
  `NODE_ENV==='production'` 403 guard) — `sharedEngineSignature`'s
  `readdirSync` was the one place that didn't, called BEFORE
  `loadFunctionalModel`'s own try/catch even started.
  Fix: `loadFunctionalModel` now returns `null` outright when
  `NODE_ENV==='production'`, same convention/comment style as
  `review-status.ts`. Also hardened `sharedEngineSignature` itself with a
  try/catch (defense in depth) in case it's ever called from a path that
  isn't NODE_ENV-guarded. Frontend already renders `functionalModel: null`
  as the normal "no functional-model entry for this card yet" state
  (`v-if="data?.functionalModel"` in
  `app/pages/app/card/[set]/[number].vue`) — this is the same common case
  corpus-wide (most cards don't have a functional-model entry), so no UI
  change needed.
  Validated: `npm run build` (nitro netlify preset) + directly invoking the
  built `.netlify/functions-internal/server/main.mjs` handler with
  `NODE_ENV=production` and a real `Request` — confirmed 200 (not 500),
  `functionalModel: null`, `interactions` still populated (that path was
  never broken, already try/catch-safe). Also confirmed via grep that
  `sharedEngineSignature`/`vite-node`/`computeTracesLive` are fully
  dead-code-eliminated out of the production bundle entirely (Vite/Rollup
  statically resolves `process.env.NODE_ENV === 'production'` to `true`
  at build time and DCEs the unreachable branch) — the crash source isn't
  just runtime-guarded, it's physically absent from what ships. Confirmed
  local dev (`npm run dev`, already-running port 3000) still returns full
  `functionalModel` data (traces/source/synergy) unchanged.

- Known, separate, NOT fixed here (flagged, not this hotfix's job):
  `server/utils/functionalModelPool.ts`'s own comment already admits this
  — even though it degrades gracefully (empty pool) rather than crashing,
  the whole Interactions cross-card panel and this card's own synergy
  overlay are effectively **disabled in production** once
  `functional-model/` genuinely isn't in the deployed bundle (confirmed:
  real Netlify deploy won't have the dir at all, unlike my local
  `npm run build` test above where the dir was still on disk from repo
  root — that only proved the DCE/guard works, not that the pool actually
  gets real cards on Netlify). Restoring real production coverage would
  need bundling the committed per-card `synergy.json`/`trace.json`/
  `progress.json` (e.g. Nitro `serverAssets`) and rewriting every reader
  (this route + `functionalModelPool.ts`) off raw `fs`/dynamic `import()`
  onto Nitro's storage API — `definition.ts`'s dynamic import in
  particular has no clean Lambda-compatible equivalent (raw TS source,
  not a bundle-traceable import). Real follow-up, own decision, not
  smuggled into this hotfix.

- 2026-09-07 (follow-up to the above): real fix — functional-model data now
  actually serves in prod, not just null. Root design: rather than trying to
  make `definition.ts`'s dynamic `import()` (raw TS, no Lambda-compatible
  equivalent — see the open question in the entry above) work at REQUEST
  time in prod, extract everything both prod readers need at AUTHORING time
  into one committed static JSON, then read it via a plain static import
  (same proven pattern `data/global_relations.json`/`data/fin/fin_relations.json`
  already use successfully in this exact route) — no Nitro `serverAssets`/
  `useStorage` needed after all, since a single aggregated JSON import is
  simpler and already known to survive Rollup's static trace.
  - New: `scripts/build-fm-bundle.mjs` (`npm run sync:fm-bundle`, runs via
    `vite-node` — same execution model `find-synergies.mjs`/`run-one-card.mjs`
    already use) walks every `functional-model/cards/<slug>/`, executes
    `definition.ts` once (confirmed safe: every `definition.ts` only ever
    has TYPE-ONLY imports plus at most one runtime import of `tokens.ts`,
    itself also pure data — audited via `grep '^import'` across all 320
    cards) to pull just `{name, manaCost, typeLine, cmc, pt}` (the only
    `CardDefinition` fields `functional-model/synergy.ts`'s matcher —
    `staticAttrsFor`/`resolveSubject` — ever reads off `PoolCard.card`,
    confirmed via grep of every `.card.` access in that file), plus reads
    `synergy.json`/`trace.json`/`progress.json` and concatenates
    `definition.ts`+`scenarios.ts` source text (same concat rule the route's
    dev path already used, for the Card Definition tab). Writes one file:
    `data/functional-model/fm-bundle.json` (1.3MB for all 320 cards).
  - New: `server/utils/fmBundle.ts` — statically imports that JSON
    (`import fmBundleJson from '../../data/functional-model/fm-bundle.json'`),
    exports it typed as `Record<string, FmBundleEntry>`.
  - `server/api/card/[set]/[number].ts`'s `loadFunctionalModel`: production
    branch now reads `fmBundle[slug]` and returns real
    `{source, synergy, traces, annotatedCard, review, scenariosReview,
    interactionsReview}` instead of `null`. `annotatedCard` build logic
    extracted into a shared `buildAnnotatedCard()` helper used by both the
    prod and dev branches (was duplicated inline before). Dev branch
    (live vite-node recompute, folder-mtime cache) is UNCHANGED — kept
    exactly as-is, still the freshest-on-every-edit path for local work.
  - `server/utils/functionalModelPool.ts`'s `loadFunctionalModelPool`:
    production branch builds `PoolCard[]` straight from
    `Object.values(fmBundle)` (`poolFacts` as `card`, `synergy.source/sink`)
    — no `readdirSync`, no dynamic import, no fs access at all in prod.
    Dev branch unchanged.
  - The prior NODE_ENV guard around the live-recompute/vite-node path in
    both files is UNTOUCHED — only what happens in the production branch
    changed (real data instead of `return null` / `[]`).
  - **Staleness contract**: `fm-bundle.json` is committed, NOT regenerated
    by `npm run build` — same manual "regenerate via script, then commit"
    cadence `synergy.json`/`trace.json`/`progress.json` already have via
    `functional-model/scripts/*.mjs`. Re-run `npm run sync:fm-bundle` and
    commit the diff whenever `functional-model/cards/` changes. **This file
    was generated locally but NOT git-committed by me** (only commit when
    asked) — it MUST be committed before this fix has any effect on a real
    Netlify deploy (a fresh clone won't have it otherwise, and it's not
    gitignored — checked).
  - Validated exactly like the prior hotfix, one step further: `NITRO_PRESET=node-server
    NODE_ENV=production npm run build`, confirmed `fm-bundle.json`'s content
    got Rollup-traced into a real chunk (`functionalModelPool.mjs`, 1.5MB,
    contains `a-realm-reborn` etc. as a literal string — grepped for it).
    Then, to genuinely simulate the Netlify Lambda sandbox (not just "ran
    from repo root where functional-model/ happens to still be on disk" —
    the gap the prior hotfix's own notes flagged as unverified), I
    TEMPORARILY RENAMED the real `functional-model/` directory out of the
    way, ran the built `.output/server/index.mjs` with `NODE_ENV=production`
    against that missing directory, and hit `/api/card/fin/1`,
    `/api/card/fin/2`, `/api/card/fin/5`, `/api/card/fin/50` for real —
    every one returned 200 with non-null `functionalModel` (real
    source/synergy/traces/review fields) AND non-empty `interactions`
    (real card names — e.g. fin/1 Summon: Bahamut's Interactions listed A
    Realm Reborn/Absolute Virtue/Adelbert Steiner/... as real cross-card
    matches), with zero ENOENT/errors in the server log. Restored
    `functional-model/` immediately after (confirmed via `git status`
    showing zero diff under it, 320 card folders intact). Also re-confirmed
    local dev (`npm run dev`, already-running) still returns full live
    `functionalModel` data unchanged (fin/1, 2 traces). `npm run typecheck`
    clean. `npx vitest run` — same 5 pre-existing failures as before my
    change (missing `tagging/` dir, unrelated historical-sets-project data,
    not present in this checkout at all — confirmed unrelated).
  - Not done / explicitly out of scope for this task: didn't touch
    `package.json`'s `build` script to auto-regenerate the bundle at build
    time (considered it — Netlify build environment does have devDependencies
    incl. `vite-node` available — but manual regenerate-then-commit matches
    this repo's existing convention for every other functional-model-derived
    artifact, and avoids adding a new can't-skip step to the build/CI
    pipeline, which leans toward `server` agent's remit anyway).

- Contract note for orchestrator: `.claude/contracts/state-event-format.md`'s
  `TraceResult.scenario` shape (`{setup, action, result}`) is under-described
  — real `trace.json` output (confirmed by reading a live file) also carries
  a `scenario.raw` field (the scenario's own structured input, verbatim —
  actually already documented in `harness.ts`'s own `TraceResult` interface
  comment, just not surfaced in the contract file's abbreviated copy). Not a
  mismatch/bug, just a doc gap — additive field, doesn't break anything
  ("render generically off `fn`" rule already covers this for `log`, but
  `scenario.raw` isn't `log`). Worth a one-line addition to the contract
  next time it's touched.

## Open questions

(none yet)
