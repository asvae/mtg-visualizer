# Cards tab: engine-support tri-state filter + header badge (2026-09-18)

`app/pages/app/engine/cards/[set]/[[number]].vue`'s `IS_FDN` branch gained a
second, page-local axis surfacing `pipeline-status.json`'s new
`engineSupport?: 'on'|'off'` (schema agent's `engine-support-registry.ts`,
`functional-model/pipeline-status.ts`). Only present at all on a gated
(`purple`/`blue`) fdn entry; absent on `gray` fdn entries and on every `fin`
entry.

## Pattern: layering a second filter axis WITHOUT touching the shared composable

`useStatusFilterList.ts`/`EngineConsoleStatusFilterControls.vue` are shared
across Cards/Keywords/Predicates/Features/Sinks and stay deliberately
single-axis (multi-select toggle chips over one `C` status union) — a real,
prior decision, don't refold engine-support into them. Instead:

- Own local `ref<'all'|'on'|'off'>('all')`, plain tri-state single-select
  (not the shared multi-toggle-chip `Set<C>` shape).
- `computed` that further `.filter()`s `list.visible.value` (the
  composable's own search+color-filtered output) — this literally IS the
  AND-combination, no extra wiring needed. When the local filter sits at
  `'all'` (default) this computed returns the exact same array reference
  as `list.visible.value`, so `fin`/`genericMode` see zero behavior change.
- The composable's own `selectedIndex`/`canPrev`/`canNext`/`positionLabel`
  are computed internally off ITS `visible`, not this further-narrowed
  list — mirror all four locally (`engineFilteredIndex`/
  `engineFilteredCanPrev`/`engineFilteredCanNext`/
  `engineFilteredPositionLabel`) against the narrowed list instead, and
  feed those into `EngineConsoleShell`'s `can-prev`/`can-next`/
  `position-label` props + `goPrev`/`goNext` — otherwise prev/next walks
  the WRONG (not-further-filtered) list.
- Mirror the composable's own "reselect first visible entry when the
  current selection falls out of view" watch, scoped to the narrower list,
  writing back to the composable's own (plain, writable) `selectedKey` ref.
  Confirmed live: this updates the detail pane/page `<title>` correctly but
  does NOT update the URL bar — same pre-existing behavior the shared
  composable's OWN internal reselect-on-color-filter-change already has
  (verified by reproducing it on the pre-existing purple/color filter, not
  a regression this change introduced — the page's URL only syncs
  URL→selection, never the reverse, on this route).
- Visual language: reuse `EngineConsoleStatusFilterControls.vue`'s own chip
  markup (`text-[11px] font-semibold tracking-wide text-muted uppercase`
  label, `rounded-md px-1.5 py-1` buttons, `active: text-text` vs
  `inactive: text-muted opacity-40`, small colored `rounded-sm` swatch) —
  copy the classes into the page directly, don't extract a new shared
  component for a single caller.

## Server-side plumbing needed too

`CardStatusPageEntry` (`server/api/card-status/[set].get.ts`) did NOT
carry `engineSupport` — the sidebar list (`/api/card-status/:set`) is what
feeds `list.visible`, and per-entry data has to already be there for a
client-side filter to narrow the list without a fetch per row. Added a
straight passthrough (`engineSupport: pipeline?.engineSupport` in
`computeFdnCardStatusPage`) — additive-only, optional field, doesn't touch
`functional-model/` or `pipeline-status.ts` itself. This file isn't in
`ui`'s explicitly-listed domain (only `graph-links.ts`/`keywords/index.get.ts`
are) but its sole real consumer is this page, so extending it stayed in
scope for this task rather than bouncing to another specialist for one
optional field.

## Header badge

Second `UBadge` alongside the existing pipeline-status one, inside the SAME
`#header-extra` slot template (`EngineConsoleShell.vue`'s own
`flex min-w-0 items-center gap-2` wrapper already handles multiple slot
children safely) — `min-w-0 shrink-0` on the new badge, matching the
"don't reintroduce the ebe2c06 circular-sizing bug" constraint (short fixed
text, no risk of unbounded growth, so `shrink-0` alone is safe here, unlike
on something holding the card image). `'on'` → green "Engine OK", `'off'`
→ red "Engine gap", each with a `title` tooltip spelling out the real
"small known-unsupported-vocabulary list, not full verification" caveat.
Verified live via Playwright against real cards: `sire-of-seven-deaths`
(fdn/1) and `zul-ashur-lich-lord` (fdn/77) both show "Engine gap"; a clean
gated card (`claws-out`, fdn/6) shows "Engine OK"; a `gray` card (fdn/188)
shows neither (only "Not started").
