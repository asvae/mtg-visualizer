# CardPeekPanel.vue — design decisions worth preserving

- URL sync (`?card=<set>/<number>`) is a `computed` reading
  `route.query.card` directly, not a ref kept in sync via watch.
  `openCardPanel`/`closeCardPanel` always `router.replace` (never `push`)
  so peeking through many nodes doesn't flood browser history.
- The panel is mounted ONLY on pages that want it (`app/pages/app/
  index.vue`, `app/pages/app/status`-family pages) — never on the card
  detail page's own route. A direct visit to `/app/card/<set>/<number>`
  never shows the panel, purely because it's absent from that page's
  component tree, not because the state refuses a value there.
- Layout: NOT an `absolute` overlay — it's a real flex-row sibling
  (`relative z-10 flex min-h-0 shrink-0 flex-col`, width driven by
  `store.panelWidth` inline style). This was an explicit rework (it used
  to be `absolute inset-y-0 right-0`, which covered other right-edge
  content). Any page that mounts it needs its own outer wrapper structured
  as a flex row containing [content, CardPeekPanel] AND needs `min-w-0` on
  wide-content flex-item ancestors, or the panel can end up partially
  off-viewport (hit this concretely on `/app/status`'s wide fixed-grid
  layout — flexbox's default `min-width:auto` refuses to shrink a wide
  plain-div child below its content's min-content width).
- Resize: `store.panelWidth` (persisted, NOT namespaced by SET_CODE — a
  standing UI habit, not a per-set preference), clamp constants
  (`PANEL_WIDTH_MIN`=280, `MAX`=720, `DEFAULT`=360) exported from
  `useGraphStore.ts` as the one source of truth. Drag handle is plain
  `pointerdown`/`pointermove` (not d3), delta is `dragStartX - currentX`
  (inverted, since the handle is on the panel's LEFT edge and dragging
  left widens a right-anchored panel).
- Any floating UI anchored to the graph's right edge (e.g.
  `layouts/graph.vue`'s gravity-mode/PhysicsControls corner) needs an
  explicit offset computed off `store.panelWidth` when the panel is open,
  with a matching CSS transition — it does not get this for free just
  because the panel resized.
- Click-outside-to-close deliberately EXCLUDES clicks landing inside
  `#graph` (the whole graph SVG) as well as inside the panel itself — this
  sidesteps a real race between GraphCanvas's own node-click/background-
  click handlers and a generic document-level listener (switching to a
  different node should SWITCH the panel, not close-then-reopen).
- Default action on Enter/row-click elsewhere in the app (SearchBox rows,
  status-grid squares) opens via `store.openCardPanel` only when
  `route.path === '/app'` (covers BOTH Graph and List view, since
  `CardPeekPanel` is only ever mounted there) — everywhere else it does a
  real `navigateTo('/app/card/<set>/<number>')`. Checked by path, not by
  `viewMode`, deliberately — List view rows already open the peek panel,
  so a search result behaving differently on the same screen would be the
  more surprising inconsistency.
