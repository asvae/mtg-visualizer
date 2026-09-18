# Dev-environment gotchas (this repo, card domain)

- **`npx vue-tsc --noEmit -p .` is a silent no-op on this repo.** Root
  `tsconfig.json` is `{ files: [], references: [...] }` — without `-b`/
  `--build` the references never get picked up, so the command "succeeds"
  even with real type errors present (verified by injecting a deliberate
  error and still getting exit 0). **Always use `npm run typecheck`**
  (→ `nuxt typecheck`, real build-mode project-reference checking) instead.
  Any past note anywhere citing a bare `vue-tsc`/`tsc --noEmit -p .` "clean"
  result is not trustworthy evidence.
- Even `npm run typecheck` has a real gap: it doesn't reliably catch every
  hand-mirrored client type falling out of sync with a server route (see
  `topics/cardresponse-hand-mirror-gotcha.md`), and it does NOT catch a
  server route importing something Nitro's dev bundler can't actually
  resolve at runtime (see `topics/nitro-mjs-import-gotcha.md`) — `tsc`
  passing is necessary, not sufficient, for anything touching
  `server/api/card/**`. Hit the real dev server too before calling a
  server-route change done.
- **Nuxt dev server is single-instance per port** — a second `npm run dev`
  refuses to start by default. Either reuse the already-running shared
  instance, or start a second one on another port with
  `NUXT_IGNORE_LOCK=1 npm run dev -- --port <n>`, and tear it down after.
- **Stale Vite/HMR module-graph state**: after many rapid successive edits
  to a heavily-shared file (`functional-model/synergy.ts`,
  `app/pages/app/card/...`, etc.) within one long-running dev-server
  lifetime, the browser can keep executing a stale bundled module even
  though the file on disk is current — including serving stale
  `trace.json`/`synergy.json` content. If a report reads like "feature X
  disappeared"/"still shows the old label" and the source clearly has the
  fix, suspect this FIRST: `curl` the API route directly to compare against
  the on-disk file, then kill and restart the dev server, before assuming a
  real regression. This is a recognized, recurring failure mode in this
  repo, not a one-off (documented in `NEXT_STEPS.md`'s own "Known issues"
  too).
- A related, narrower case: a page that **statically imports a generated
  data file** (e.g. `data/fin/fin_card_status.json`) rather than fetching it
  via an API route can permanently fail to resolve that import if the dev
  server's first resolve attempt happens before the generator has ever run
  — Vite doesn't retry a previously-failed relative-import resolution once
  the target file later appears. Fix is a no-op touch of the importing file
  to force Vite to re-transform it. General lesson: prefer fetching a
  generated JSON via an API route over statically importing it from a page,
  for exactly this reason (every other served-JSON case in this app already
  does the fetch-based thing).
- **Live-verification via Playwright**: a throwaway driver script needs to
  live inside the actual project tree (repo root or a gitignored `.scratch/`
  dir under it) for Node's `node_modules` resolution to find `playwright` —
  scripts under `/tmp` or the outer scratchpad dir won't resolve it. Delete
  the script before finishing; confirm via `git status` it's gone.
- Prefer a `MutationObserver` (set up before the interaction) or an
  immediate post-click screenshot over a bare `waitForTimeout` + snapshot
  when verifying a brief, timed visual-feedback state (e.g. a 1s
  copy-icon-swap) — polling snapshots have produced false "doesn't update"
  reads in this codebase that a `MutationObserver` then proved wrong.
