# `functional-model/cards/` — FIN pool, reference-only for new authoring (2026-09-18)

This directory holds the Final Fantasy (`FIN`) set's per-card functional
model (`definition.ts` + `scenarios.ts`, plus generated `synergy.json`/
`progress.json`/etc — see `.claude/contracts/card-schema.md`). It is still
the live app's real data (`app/lib/buildGraph.ts`, `server/api/graph-links.ts`,
`functional-model/synergy.ts` all keep reading straight out of here,
completely unaffected by this note) and still a valid source of same-name
reprint few-shot examples for new authoring elsewhere.

**What's new**: this pool is now frozen/reference-only for NEW card
authoring going forward. The FDN sink-only-synergy-model experiment's own
cards live in a dedicated sibling directory instead —
`functional-model/fdn-cards/<slug>/` — because an FDN card's on-disk shape
has almost nothing in common with a FIN one (no `Facts`/`synergy.json`/
`progress.json` at all, by design; its own status axis is
`pipeline-status.json`/`functional-model/pipeline-status.ts`'s
`gray`/`purple`/`blue`/`yellow`/`green` pipeline-STAGE tracker, not
`card-status.ts`'s 8-bucket fact-authoring classifier). Several existing
scripts (`functional-model/scripts/card-status-batch.mjs`,
`scripts/build-fm-bundle.mjs`, `functional-model/scripts/sync-combos.mjs`)
blindly scan every entry under THIS directory with no set filter at all —
keeping FDN cards out of it entirely is what actually closes that
ambient-discovery risk, not a code change to any of those scripts.

Not a change to what ships: FIN's own 306+ cards here keep being the real,
live, production data behind the app's default graph. This is a policy
note about where NEW authoring happens, nothing else.
