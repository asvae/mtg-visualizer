# `EngineConsoleShell.vue` gained a `header-extra` slot (2026-09-18)

`app/components/engine-console/EngineConsoleShell.vue` (normally `ui`-owned,
touched here for one cohesive cross-cutting layout change) now exposes a
plain, generic `<slot name="header-extra" />` in its own "N of N" detail-pane
header row, right after the `positionLabel` span, inside a shared
`flex items-center gap-2` wrapper. Deliberately NOT FDN-specific logic baked
into the shell itself — just an optional slot any of the six
`/app/engine/*` tab pages can feed. The header row's own `v-if` was widened
to `... || $slots['header-extra']` so a caller with nothing to show in
`positionLabel`/no prev-next but something in this slot still gets the row.

**Only real consumer today**: `app/pages/app/engine/cards/[set]/
[[number]].vue`'s own `pipelineHeaderBadge` computed feeds a `UBadge` here
for `fdn` cards (the pipeline-status color+label, moved out of
`CardDetailTabs.vue` — see `topics/fdn-vs-fin-card-model.md`). The other
five tabs (Predicates/Features/Sinks/Keywords/Schema) pass nothing and are
unaffected — confirmed live, FIN cards on this same Cards tab show no badge
either.
