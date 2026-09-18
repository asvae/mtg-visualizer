# `/app/engine/*` console — shared architecture + gotchas

The console consolidates several review/status axes (Keywords, Predicates
[sink-derivation predicates], Features [ENGINE_GAPS.md], Sets [per-card
status], Sinks [sink-catalog entries]) into one tabbed shell, each its own
real route under `/app/engine/{keywords,predicates,features,sets,sinks}/
[[slug]].vue` (not client-side tab state — real navigable routes).
`/app/recognizers/[[slug]].vue` stays a separate, unmerged page (considered
and explicitly dropped from this consolidation).

**Predicates vs. Sinks — easy to confuse, genuinely different axes.**
Predicates (`functional-model/sink-derivation-status.ts`) tracks
*engine-automation mechanisms* for deriving sinks (e.g. "crew cost
activation path"). Sinks (`functional-model/sink-catalog-status.ts`)
tracks the shared, reviewed `SinkQuery` CATALOG entries themselves. The
Sinks tab was built by mirroring Predicates byte-for-byte (same review
flow, same 3-file source-evidence pattern) but has no `expectedSinkShapes`
equivalent — it has a "Query" section showing the entry's live `SinkQuery`
object as pretty-printed JSON instead. Sinks deliberately has no
`hide-nav` (unlike Predicates' 4-entry list) since the catalog is expected
to grow much faster/more organically.

**Shared pieces** (reuse these for any new axis rather than re-deriving):
`useStatusFilterList.ts` (composable: search + per-status filter-with-
counts + visible list + self-owned `selectedKey` + prev/next/position
label, generic over `<T, C extends string>`), `EngineConsoleShell.vue`
(nav+detail 2-pane layout, Prev/Next header row, renders `EngineConsoleTabs`
in the nav slot), `EngineConsoleTabs.vue` (tab bar), `EngineConsoleStatus-
FilterControls.vue` (search + per-status toggle buttons + `#help` slot for
a status-flow popover), `EngineConsoleEntryListPanel.vue` (generic `<script
setup generic="T">` row-list, `row` scoped slot), `EngineConsoleCodeSection`
(expand/collapse source/JSON viewer, reuses `FunctionalModelScript.vue`/
`JsonHighlight.vue` — no new syntax-highlighter dependency), `EngineConsole
StatusHelp.vue` (renders a real flow diagram of badges+arrows when the
caller's `statusOptions` prop has all 6 known values gray/purple/blue/
yellow/green/re-review; falls back to prose slot otherwise), `app/lib/
badgeColor.ts` (`statusBadgeStyle`/`readableTextColor` — relative-luminance
check so a `UBadge` stays legible against any of the 6 status hexes; this
was the first-ever `UBadge` usage in the app, inline-style is the
established convention for it here, not `color`/`variant` theme tokens).

**Gotchas hit building this, still relevant for any NEW component here:**
- Nuxt's component auto-import prefixes a subfolder component's name with
  the folder (kebab->Pascal) UNLESS the filename already starts with that
  prefix. A file named `StatusFilterControls.vue` under `engine-console/`
  silently registers as `EngineConsoleStatusFilterControls` — mismatched
  filenames fail at RUNTIME with a "Failed to resolve component" warning,
  invisible to `npm run typecheck`. Always name new files under this
  folder with the `EngineConsole` prefix already applied.
- `shallowRef`, not `ref`, for a composable-internal `Set<C>` where `C` is
  a generic type param — plain `ref` triggers Vue's deep `UnwrapRef<T>`
  traversal into the Set's own generic argument and produces real `tsc`
  errors on `.has()/.add()/.delete()`. Fine since the Set is always
  replaced wholesale, never mutated in place.
- A nested ref access in a template (`list.selected.value`) does NOT
  auto-unwrap; add a top-level `computed` alias per page
  (`selectedEntry`) instead of reaching into it repeatedly with `!`.
- Per-tab persisted status-filter toggles use `localStorage` keys
  `engine-console-filters-{axis}` (independent per tab); `searchQuery`
  deliberately never persists (explicit "search should not persist" call).
- Facet/status-chip counts must be computed off the FULL dataset (`sorted`
  in `useStatusFilterList`), not off the search-narrowed list — otherwise
  typing in the search box changes the numbers next to each status chip,
  which reads as a bug.
- URL slug source differs per axis, always reusing an existing stable
  identity field rather than inventing a new slugify scheme: Predicates
  use `entry.slug`, Features use `entry.key` (`gap-<N>-...`, recomputed
  fresh from ENGINE_GAPS.md every request), Sets use `entry.number`
  (collector number, `encodeURIComponent`'d), Sinks use `entry.slug`.
  Keywords is the one axis with no stored slug — computes one from
  `title` via `slugifyKeywordTitle` (`app/lib/keywordSlug.ts`; lowercases,
  expands `&`->`" and "` before the generic collapse, run in both
  directions so there's no separate reverse parser).
- `hide-nav` prop on `EngineConsoleShell.vue` only suppresses the visible
  position-label/chevron row — keyboard Left/Right nav (registered once,
  in the shell itself) always still works regardless.
- Cross-session collision precedent: a peer orchestrator's concurrent
  commit once `git add -A`'d over this task's own in-progress, uncommitted
  `git rm` of old pre-consolidation page files, silently restoring them:
  git-visible diff showed nothing until a plain `git status` sanity check
  caught it. Re-did the `git rm` after. Concrete instance of the exact
  risk CLAUDE.md's "Multiple orchestrators" section names — worth a
  `git status` check near the end of any multi-file-touching task if
  other sessions are known to be active concurrently.
- Sinks tab (2026-09-18, later) grew a "Real FDN pool matches" collapsible
  section (two `<details>`, producer vs. consumer role, "N cards"
  `<summary>` — same convention `CardDetailTabs.vue`'s own Interactions/
  Sinks panels use) — `GET /api/sink-catalog`'s own `SinkCatalogPageEntry`
  now carries `realMatches?: { producerMatches: string[]; consumerMatches?:
  string[] }`, computed unconditionally (not review-color-gated) against a
  new shared `server/utils/fdnDefinitionPool.ts` (the FDN-pool-loading
  convention, extracted out of `server/api/card/[set]/[number].ts`'s own
  private copy — that route's copy was left as-is, `card`-owned file, don't
  touch it for an unrelated change). `SinkCatalogEntry` may declare a
  consumer-side signal via EITHER `consumerTriggerNames` (free-text
  `Trigger.name`) OR `consumerTriggerOn` (closed `Trigger.on` enum, added
  same day for `etb`'s producer/consumer split) — both get merged (union)
  into the one `consumerMatches` list, never split further; check
  `sink-model/catalog/entry.ts`'s CURRENT shape before assuming which
  exist, this axis is still growing organically. No thumbnails wired here
  (plain names only) — the enrichment convention
  (`resolveFunctionalModelCardMeta`) lives unexported inside `card/
  [set]/[number].ts`; duplicating its whole fin/db/live-Scryfall fallback
  cascade for a dev-only review tool was judged real scope creep, a
  deliberate skip.
