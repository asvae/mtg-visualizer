# Graph simulation: physics facts that shape every graph feature/test

- The force simulation (`app/lib/graphRenderer.ts`) never fully settles by
  design — `alphaDecay` is tuned slow (see `PhysicsControls.vue`). A fresh
  page load's own initial `alpha(0.6)` reheat is still visibly moving nodes
  15-65px even 10 real seconds after load. Any "zero pixel drift" bar for a
  new feature is unachievable and was never true of existing filter toggles
  either — read PRD-style "positions unchanged" requirements as "no
  wholesale reset / no lost simulation-node identity," not literal stasis.
- `render(filters, options, soft?)`: the `soft` param (added for
  incremental add/remove/Colors-Rarity-Type toggles) changes ONLY the final
  reheat amount — `Math.max(simulation.alpha(), 0.05)` instead of a flat
  `alpha(0.6)`. Genuine shape changes (search, keyword-hub toggle,
  showSynergyEdges, relation-hub prototype, resetLayout) still pass hard
  (unsoftened) on purpose.
- `addCards()`/`removeCards()` (graphRenderer.ts) patch the live renderer
  instance in place (new nodes seeded near the current cluster centroid +
  jitter, not corner/spiral default) instead of destroy+recreate. The
  `GraphCanvas.vue` `props.graph` watcher diffs against a tracked
  `knownGraph` and only falls back to full destroy+recreate for a
  non-purely-additive/removal change. In practice today, a genuinely
  *different* set/query only ever reaches the page via a hard
  `window.location.href` navigation (AppHeader's query-submit handler), so
  the full-rebuild branch is effectively dead-in-practice defensive code —
  if a client-side (SPA) set-switcher is ever added, it will need an
  explicit bulk-replace signal (e.g. a generation counter) before this
  diff path can keep treating it as "just another add/remove."
- Card-node click vs. drag: click-to-open fires from `drag()`'s own
  `dragended`, gated on raw client-coordinate pointer displacement since
  mousedown (`CLICK_DRAG_THRESHOLD_SQ`), NOT from a native `click` event —
  a native click re-hit-tests the DOM at mouseup and can miss a node that
  drifted out from under the cursor during a hover-then-click pause (this
  was a real, reported bug). Each node also carries an invisible padded
  `.card-hit-area` (bottom of paint order, `pointer-events:all`) for extra
  margin. d3-drag's own `.filter()` excludes `.scryfall-link` and
  `.card-qty-btn` clicks from starting a drag (mousedown on those must not
  be swallowed as "start dragging the card").
- GraphCanvas.vue's `onMounted` must stay synchronous through renderer
  creation and every `watch()` registration — anything reactive created
  after an `await` inside an async lifecycle-hook callback loses Vue's
  auto-unmount tie and becomes a zombie that outlives the component. Only
  the font-load wait + first `render()` call are deferred into a
  fire-and-forget async IIFE at the very end, guarded by a `destroyed` flag
  set in `onBeforeUnmount`.
- `qty` staleness: a Deck qty change on a card ALREADY known to the
  renderer (present before the change) is invisible to the `addCards`/
  `removeCards` presence-diffing (which only reacts to ids appearing/
  disappearing). Fixed via `renderer.syncCardQty(cards)`, called
  unconditionally from the `props.graph` watcher alongside add/remove
  diffing — diffs cached `qty` per id and re-renders only the changed ones.
  This is the fix for both the x-N qty badge AND the deck-qty stepper
  buttons; if a similar per-card derived field is added later, check
  whether it needs the same explicit sync path rather than assuming
  presence-diffing covers it.
