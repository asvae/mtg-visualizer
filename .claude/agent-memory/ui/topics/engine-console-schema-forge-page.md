# Engine console Schema (Forge) page

`/app/engine/schema-forge`, added 2026-09-19 — sibling to the existing
`/app/engine/schema` page (`topics/engine-console-schema-page.md`), same
overflow-only placement in `EngineConsoleTabs.vue`'s "…" trigger, but
renders **Markdown** (`MarkdownView.vue`, reused as-is — no new markdown
renderer) instead of TS source (`EngineConsoleCodeSection`).

Content: a one-off analysis script's aggregate report of Forge-corpus
field/param/keyword vocabulary (33,798 real cards, all of Magic's history)
— groundwork for a possible future Forge-JSON -> `card.ts` compiler, not
that compiler itself.

Key constraint: the backing file (`tmp/forge-json-mapper-full-run/
schema_aggregate.md`) is **gitignored, local-only, optional** — explicit
user line: "Forge stuff would be only locally for now". Whole flow mirrors
`forgeScript.ts`'s dev-only posture exactly:
- `server/utils/forgeSchemaAggregate.ts` gates on
  `process.env.NODE_ENV !== 'production'` itself (not just callers), same
  pattern as `forgeScript.ts`.
- `server/api/schema-forge-aggregate.get.ts` is a thin wrapper, same shape
  as `/api/card-schema`.
- Page tolerates `{ available: false, reason: 'dev-only' | 'not-found' }`
  gracefully (friendly text, not a crash) — won't exist on a fresh
  checkout, in CI, or in prod, and is routinely regenerated/deleted by
  re-running the local script.

Gotcha hit while wiring the tab: `EngineConsoleTabs.vue`'s old `onSchema`
computed used `route.path.startsWith('/app/engine/schema')`, which would
have also matched `/app/engine/schema-forge` (prefix collision, no `/`
separator) — narrowed to
`route.path === '/app/engine/schema' || route.path.startsWith('/app/engine/schema/')`
before adding the new `onSchemaForge` sibling. Check for this same
prefix-collision pattern before adding any other route with a
hyphen-extended name sharing a prefix with an existing one.

Verified live via a throwaway Playwright script (project's own
`playwright` devDependency, run from inside the repo root so ESM module
resolution finds `node_modules` — a script under a `/tmp` scratchpad
outside the repo tree fails `ERR_MODULE_NOT_FOUND`): real markdown tables
rendered, headline-numbers section present, overflow link reachable and
navigable. Scratch script deleted after, nothing committed under `tmp/`.
