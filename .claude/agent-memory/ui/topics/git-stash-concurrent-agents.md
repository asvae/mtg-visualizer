# Don't `git stash` on a shared working tree

Hit this concretely 2026-09-18: used `git stash` / `git stash pop` to get a
clean before/after `npm run typecheck` diff for one file's change. Another
agent's in-flight, uncommitted changes (unrelated files: `CardDetailTabs.vue`,
`PlainOracleText.vue`, `functional-model/card.ts`,
`scripts/validate-card-definition.mjs`, plus an untracked temp script) got
silently swept into the same stash and popped back along with mine — no
conflict, nothing lost, but a real collision risk if a dispatch's "no other
agent is currently running" turns out stale (this repo runs multiple
orchestrator sessions concurrently by design, per root `CLAUDE.md`).

`git stash` (with no pathspec) grabs the ENTIRE working tree, not just the
file(s) you touched — same root cause as the orchestrator-level "concurrent
agent git staging" lesson about `git add` not being scoped by itself. Prefer
a targeted comparison instead: `git diff -- <path>` against what you
actually changed, or `git show HEAD:<path> | diff - <path>` for a
before/after on one file, rather than stashing the whole tree.
