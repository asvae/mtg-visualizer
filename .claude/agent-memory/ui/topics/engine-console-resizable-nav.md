# EngineConsoleShell.vue — resizable nav pane

- Sidebar/nav (`<nav>`) resize is drag-to-resize via a thin `role=separator`
  handle sitting between `<nav>` and the detail pane as its own flex item
  (not absolutely-positioned like `CardPeekPanel.vue`'s own handle) — this
  pane isn't anchored to a fixed viewport edge, so a plain sibling flex item
  tracks `navWidth` for free without any extra positioning math.
- Mirrors `CardPeekPanel.vue`'s existing `pointerdown`/`pointermove`/
  `localStorage` resize pattern (that one is the reference implementation
  for drag-resize in this app — check it first before building a new one).
  Only the delta sign differs: this pane is LEFT-anchored (handle on its
  RIGHT edge, dragging right widens it, `delta = current - start`) vs. the
  card panel's RIGHT-anchored/LEFT-edge-handle inversion.
- One shared width + `localStorage` key
  (`mtg-visualizer-engine-console-nav-width`) across all six
  `/app/engine/*` tabs — this shell is their one common mount point, so
  it's "the console's sidebar width," not a per-tab preference. Clamped
  180–480px, default 240 (matches the old fixed `w-[240px]`). Constants/
  state kept local to `EngineConsoleShell.vue` itself, no
  composable/store extraction — nothing outside the shell needs to read
  or react to it.
- `localStorage` reads/writes wrapped in try/catch, falling back to the
  default silently — per-viewer convenience, not durable state, same
  convention `useGraphStore.ts`/`useStatusFilterList.ts` already use.
- Verified live via a throwaway Playwright script (not checked in): drag
  resizes the nav on both `/app/engine/cards` and `/app/engine/sinks`;
  width persists across a client-side nav between tabs AND across a full
  reload (`localStorage` round-trip); min/max clamp holds at 180/480 on
  an extreme drag; prev/next buttons + arrow-key nav (pre-existing,
  untouched) still work post-change — confirmed a "306 of 306" default
  selection was pre-existing behavior (present on the unmodified baseline
  too, likely the Cards page's own separate last-picked-item persistence),
  not a resize-change regression.
