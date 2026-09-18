- [Where the real design record lives](topics/design-docs-map.md) — SYNERGY_DESIGN.md/ENGINE_GAPS.md/PRD_AUTOMATED_AUTHORING.md/card-schema.md already document almost everything; read those, don't re-derive.
- [Script CLI + typecheck gotchas](topics/script-cli-and-typecheck-gotchas.md) — inconsistent --slug=/positional args, `tsc -p .` is a silent no-op, vite-node doesn't preserve argv.
- [Concurrent-session hazards](topics/concurrent-session-hazards.md) — shared scripts get rewritten mid-task; isolate diffs by file-swap, not git stash.
- [Engine-status `blue` caveat](topics/engine-status-blue-caveat.md) — Features-tab blue means "cites a test file", not necessarily real scenario-verified.

Schema/vocabulary/FDN-authoring-pipeline topics moved to the new `schema`
agent hub (`.claude/agent-memory/schema/`) as of 2026-09-18 — see there,
not here, for sink-model/combinator/FDN-gate/coverage-manifest notes.
