# Live-verification (Playwright) conventions specific to this app

Recurring pitfalls hit across many tasks — check this before writing a new
verification script rather than rediscovering them.

- `page.$('svg')` grabs the first `<svg>` in the DOM (a header icon), not
  the graph canvas — use `#graph` (GraphCanvas.vue's own id).
- Prefer `locator.click()`/real mouse down-move-up over
  `page.evaluate(() => el.click())` or `locator.click({force:true})`. The
  synthetic/forced paths bypass visibility/actionability checks and have
  repeatedly masked real bugs (FilterPanel being off-screen, a click
  landing on the wrong drifted node, an Escape keypress that closed the
  wrong overlay). FilterPanel itself starts CLOSED by default
  (`store.panelOpen` false) — click the header's "Toggle themes panel"
  button first, or any control inside it will appear clickable to a forced
  synthetic click while genuinely invisible to a user.
- Prefer `locator.waitFor({state:...})` / `page.waitForURL(...)` over a
  fixed `page.waitForTimeout(...)` before concluding an action "didn't
  work" — fixed timeouts have produced false failures multiple times,
  especially after extra elapsed time earlier in the same script (repeated
  reloads etc. seem to correlate with slower one-off chunk loads).
- Zooming to a specific node reliably: one large `wheel` deltaY (e.g.
  -6000) anchored at the node's current screen center jumps straight to
  the zoom `scaleExtent` max in one d3 zoom event — avoids accumulated
  drift from many small iterative zoom ticks while the sim keeps moving
  the target.
- A hover tooltip (`TooltipView.vue`) is a separate DOM overlay that can
  look like an unrelated full card render in a screenshot — move the mouse
  away before a "does this look right" screenshot.
- This graph's hit-areas routinely overlap between adjacent nodes (DOM
  paint order, not visual z-order, decides which one a click/hover
  resolves to) — a one-shot "compute node center, click there" script is
  unreliable for testing one specific node. Fix: temporarily
  `display:none` every OTHER `g.node-card`/`g.node-keyword`/
  `g.node-relation-hub` (test-only, not a code change) so hit-testing can
  only resolve to the node under test, then zoom in on it. Setting
  `pointer-events:none` on an ancestor `<g>` does NOT work — the
  `.card-hit-area`'s own explicit `pointer-events:all` overrides an
  ancestor's inherited `none`.
- A long-lived background `nuxi dev`/`npm run dev` process can go stale —
  its HMR can silently stop picking up edits (confirmed once: compiled
  chunks kept serving pre-edit render output even after touching files).
  If a live check shows suspiciously stale output right after an edit,
  restart the dev server before concluding the code is wrong.
- This repo often already has another session's dev server running on
  :3000 — check before starting a second one (`nuxi dev` refuses a second
  lock anyway); reusing the existing one is fine and normal here.
