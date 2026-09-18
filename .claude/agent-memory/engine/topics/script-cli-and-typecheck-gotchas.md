# functional-model/scripts/*.mjs: inconsistent CLI conventions + typecheck footguns

**No single CLI convention across the toolchain — check each script's own
arg parsing before assuming:**
- Positional bare slug (no flag): `verify-synergy.mjs`, `find-synergies.mjs`,
  `apply-recognizers.mjs`, `verify-text-coverage.mjs`.
- `--slug=<slug>` flag: `run-scenarios.mjs`, `compute-weights.mjs`.
- `run-scenarios.mjs` was hardened (2026-09-16) to hard-fail on a bare/
  missing/misspelled slug arg instead of silently falling through to a
  full-pool run — but don't rely on every script having gotten the same
  treatment; always double check.

**Never run a pool-wide (`--slug`-less) `run-scenarios.mjs` or
`apply-recognizers.mjs` while other cards are mid-edit** — both share a
`trace.json`-wide object-ID counter/dedup pass that touches every card's
generated file even when nothing about that card changed, producing a
huge noisy diff. Recovering by blanket `git checkout` on every touched
file is itself dangerous: it can silently wipe *other, legitimate*
concurrent work that happened to also regenerate those files. Recover by
diffing first, then regenerating only the specific slugs that were
actually supposed to change (`--slug=<slug>` / positional per-slug reruns).

**`npx tsc --noEmit -p .` at the repo root is a silent no-op.** The root
`tsconfig.json` is project-references-only (`"files": []`), and
`references` only activates under `--build` mode — a bare `-p .` run
exits 0 with zero diagnostics even against a tree with known real errors.
Real typecheck signal comes from `npm run typecheck` / `npx nuxt
typecheck` (builds all `.nuxt/tsconfig.*.json` configs), or a scoped
`-p functional-model/tsconfig.json` / `-p .nuxt/tsconfig.server.json`.
Treat any past or future note claiming "`tsc --noEmit` clean" with
suspicion unless it names which config was actually used.

**`vite-node` does not preserve the target script's path in
`process.argv`** (`process.argv[1]` is `vite-node`'s own bin path, the
target file never appears in `argv` at all) — the standard dual CLI/
library guard idiom (`import.meta.url === \`file://${process.argv[1]}\``)
is structurally impossible under `vite-node`, even though it works fine
under `tsx` (which does preserve argv, e.g. `forge-lookup.mjs`'s own use
of the idiom). If a new `.mjs` needs both "importable as a library" and
"runnable as a CLI" under `vite-node` (because it does a sibling
dynamic `.ts` import that needs `vite-node`, not `tsx`), split it into two
files: a pure library module with no top-level argv code, plus a thin
always-unconditional `-cli.mjs` wrapper that only ever runs standalone.

**`git stash push -- <paths>`** fails/partially-errors if any given path
is a new *untracked* file (untracked paths need `-u` or need to already
be tracked) — don't rely on a scoped stash to isolate a before/after diff
when some of the touched files are brand new; it can abort leaving a
stash entry behind, or (if not careful) look like data loss when it
isn't. Prefer a plain file copy/restore for isolating a single card's
before/after diff in a pool that has other cards concurrently dirty —
see `concurrent-session-hazards.md`.
