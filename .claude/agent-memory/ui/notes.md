# ui agent notes

Scoped working memory for the `ui` specialist. Update before finishing
any task: decisions made, open questions, current state worth resuming
from. This is what makes a fresh respawn cheap — don't rely on transcript
resume alone (session transcripts are swept after ~30 days).

## Decisions

- Keyword ability icons on graph nodes (graphRenderer.ts): rendered as a
  vertical strip immediately to the RIGHT of each card node, entirely
  OUTSIDE the art rect (past x + RECT_WIDTH) — this was a user-specified
  correction; my own first pass had put them on the left. Stacks top-down
  starting flush with the top of the art band (artY), not centered — also
  user-specified, not my own call. Reuses AbilityIcon.vue's own glyph data
  (ABILITY_ICON_PATHS/VIEWBOX from abilityIconPaths.ts) directly, since
  graphRenderer.ts is raw D3/SVG, not a Vue tree — didn't touch
  AbilityIcon.vue/abilityIconPaths.ts itself, both were adequate as-is.
  Added `abilityIconKey()` helper in graphRenderer.ts to bridge Scryfall's
  own keyword spelling ("First strike") to the icon set's PascalCase keys
  ("FirstStrike") — a real mismatch, not a hypothetical. `Crew` has no
  matching glyph in the icon set at all — silently skipped (same behavior
  as AbilityIcon.vue's own `v-if="path"`), not treated as a bug.
  KEYWORD_ICON_SIZE = 7*NODE_SCALE (bigger than a mana pip — these are
  detailed illustrative glyphs, not small flat symbols). Left uncapped —
  BADGE_KEYWORDS is a short curated list, no real card stacks enough to
  clutter.
- buildGraph.ts's `keywords` field now merges TWO sources, not just
  Scryfall's own `keywords` array: (1) cardKeywords() as before, and (2) a
  new `keywordMentions()` that regex-scans the card's own raw oracle text
  (all faces) for a whole-word, case-insensitive match against each
  BADGE_KEYWORDS entry. Needed because Scryfall's `keywords` array only
  ever lists what a card itself HAS, never what it merely GRANTS/
  references on something else — confirmed concretely against FIN's Zack
  Fair ("...Target creature you control gains indestructible...", empty
  `keywords` array). Deliberately not scoped to "grants X" phrasing
  specifically — a card that only *references* a keyword (e.g. "creatures
  you control with flying get +1/+1") gets the icon too, by design.
  Verified via `npx tsx` one-liner against data/fin/fin_scryfall.json:
  keyword-bearing card count went 85 -> 122 with the oracle-text scan
  added; Zack Fair now correctly gets `["Indestructible"]`.

- Added a new "Edges" section to FilterPanel.vue (Source-Sink checkbox +
  Keywords checklist), with two genuinely different mechanisms behind them —
  don't conflate them on a future touch:
  - **Source-Sink** (`store.showSourceSinkOnly`) is a real filter, edge-level
    not card-level: it narrows which real synergy edges (reasons) draw/
    simulate, using each node's in/out DEGREE computed from the graph's FULL
    unfiltered edge list (filters.ts's `computeNodeDegrees`/
    `isSourceSinkReason`) — computed once per renderer instance, never
    recomputed per render(), specifically so toggling colors/rarity/type
    doesn't change what counts as a "pure source"/"pure sink". Degree counts
    per DIRECTED reason (`GraphReason.from`), not per undirected CardLink
    pair, since one pair can carry reasons pointing both ways. In
    graphRenderer.ts's render(), a link's `reasons` array gets filtered down
    to just its qualifying directed reasons (dropped entirely if that leaves
    zero) BEFORE it becomes both the simulation's own SimLink AND the visual
    VisualEdge fan-out — this is deliberate: filtering only the visual edges
    while leaving the simulation link unfiltered would still physically pull
    two cards together via an edge that's invisible, contradicting "filters
    the graph."
  - **Keywords** is NOT a filter at all (a mid-task scope correction from the
    orchestrator — the original ask was card-level hide/show, same as
    Colors/Rarity/Type, but got redirected to this instead). Checking a
    keyword spawns a synthetic "keyword hub" node (graphRenderer.ts) that
    every currently-visible card with that keyword gets pulled toward;
    unchecking removes it. Hubs are NOT part of `GraphFile`/buildGraph.ts (no
    server involvement, pure client-side runtime augmentation per CLAUDE.md's
    "graph assembles client-side" model) and deliberately NOT real
    `d3.SimulationNodeDatum`s in the main simulation's own node array either
    — widening `CardNode`'s generic everywhere forceLink/forceManyBody/
    forceX/forceY/forceCollide are typed to it would've touched most of the
    file for a feature that doesn't need a card's own charge/collision/drag.
    Instead: `keywordHubsById` (Map, persists for the renderer instance's
    whole life, never wholesale-reset) holds each hub's live x/y + member
    card ids; a custom named force (`simulation.force('keywordHub', ...)`)
    runs every tick alongside the built-in ones — eases the hub toward its
    members' live centroid, then nudges each member's vx/vy toward the hub,
    real integration into the same simulation loop, not a side
    requestAnimationFrame layer. Rendered as a plain gold circle + bold label
    (`KEYWORD_HUB_COLOR`/`KEYWORD_HUB_RADIUS`), links drawn as dashed amber
    `<line>`s (`.keyword-link` CSS in GraphCanvas.vue) in their own layer
    (`keywordLinkLayer`, under cards; `keywordLayer`, above cards) — visually
    distinct from real `.link` synergy edges (solid, quality-graded green) on
    purpose, since a keyword association has no match-quality of its own to
    color by. `computeFacetCounts`'s `keywords` bucket is informational only
    (how many color/rarity/type-visible cards carry it) — NOT a reciprocal
    facet like colors/rarity/type's own counts, since keyword selection
    doesn't remove any card from view.
  - UPDATE (superseded the note above): `selectedKeywords`/`showSourceSinkOnly`
    now ARE persisted to localStorage, same `mtg-visualizer-filters-<set>` blob
    colors/rarity/type already use (`SavedFilters.keywords`/`.sourceSinkOnly`,
    both optional fields — an older saved blob predating this feature just
    lacks them, treated the same as a genuinely fresh visit: empty set/off).
    Restored keywords are validated against THIS corpus's own
    `availableKeywords()` (same stale-value guard colors/rarities/types
    already get) so a saved "Flying" from FIN doesn't silently leak into an
    unrelated `?sf=` query with no flyers. Deliberately NOT mirrored to the
    URL/share-link the way colors/rarity/type optionally are — wasn't asked
    for, matches the same URL-vs-localStorage split those already draw
    (share link = explicit/deliberate export, localStorage = sticky session
    default).
  - Known limitation, not addressed: multiple simultaneously-active hubs have
    no mutual repulsion from each other or extra collision radius, so two
    checked keywords with overlapping membership can visually crowd. Also no
    hover/drag interaction on a hub (`.node-keyword`/`.keyword-link` are both
    `pointer-events: none`) — out of scope for this pass.
  - Keyword hub pull tuning: first pass (`KEYWORD_HUB_PULL_STRENGTH: 0.12`,
    `KEYWORD_HUB_EASE: 0.15`) crushed members into a rigid clump almost
    immediately — read as "stiff," not the intended loose gather. Landed on
    `0.02`/`0.05` (member-pull / hub's-own-centroid-ease) — gathers visibly
    over several seconds without overpowering cardCharge/collide. Also
    enlarged `KEYWORD_HUB_RADIUS` from `cardRadius()*0.7` to `*1.05` and gave
    the circle a soft blurred edge (reused the SAME `url(#card-outline-glow)`
    filter card nodes' own outline uses — no second filter def) plus
    `fill-opacity: 0.82` instead of a hard stroke, for a "relaxed landmark"
    look rather than a solid disc. Added the matching keyword-badge icon
    (same `ABILITY_ICON_PATHS`/`ABILITY_ICON_VIEWBOX`/`abilityIconKey()` the
    card-node badge strip already uses — no second icon source) stacked
    above the label, which stays (icon is an accent, not a replacement) —
    silently icon-less for a keyword with no matching glyph (`Crew`), same
    as the card badge strip's own fallback.
  - Keyword checklist row visibility: a row disappears once its live count
    (facetCounts, which respects the CURRENT Colors/Rarity/Type selection —
    same as Rarity/Type's own counts respect each other) drops to zero,
    UNLESS that keyword is currently checked (kept visible even at 0 so its
    checkbox — and therefore its hub — stays reachable to turn back off;
    otherwise a user narrowing Colors/Rarity/Type could strand an active hub
    with no visible way to remove it short of Reset Filters). The
    **existence** check (which keywords appear at all, i.e. `availableKeywords()`
    itself) stays based on the WHOLE current corpus (`graph.cards`, before any
    filter axis) — deliberately NOT reactive to Source-Sink (an edge-level
    toggle that never changes which cards exist) or even to Colors/Rarity/Type,
    to avoid rows flickering in/out from an unrelated toggle; only the
    per-row COUNT (and therefore this zero-hide) reacts to Colors/Rarity/Type.
  - Investigated a coordinator-reported "Source-Sink checkbox does the
    opposite of its label" bug claim TWICE now and could NOT reproduce/
    confirm it either time — see the Open Questions entry below, this is
    unresolved as a live disagreement, not settled.
    - Round 1: standalone vite-node script (buildGraph + computeNodeDegrees +
      isSourceSinkReason against the real FIN corpus/live graph-links)
      confirmed 753 of 10179 total directed reasons genuinely satisfy the
      source-pure-root AND target-pure-leaf condition (concrete example:
      Absolute Virtue outDegree 129/inDegree 0 -> Blazing Bomb inDegree
      66/outDegree 0).
    - Round 2 (after being told a standalone script doesn't rule out a
      wiring bug between the checkbox and the renderer): read the D3-bound
      datum straight off the LIVE DOM (`el.__data__`, both before/after
      actually clicking the real checkbox via Playwright against the running
      dev server) and cross-checked it against the same degree computation.
      Result: every one of the 753 edges left on screen after checking
      satisfies isSourceSinkReason (0 false positives), and every one of the
      9426 edges that disappeared does NOT satisfy it (0 false negatives) —
      about as close to definitive ground-truth proof as this can get without
      the user's own screen. Left the logic unchanged both times.
    - RESOLVED: this was never a bug — it was the checkbox's intended
      polarity, confirmed explicitly by the coordinator/user afterward.
      "Show Source-Sink connections" **UNCHECKED** is what applies the
      isolate filter (753 edges); **CHECKED** shows the full, untouched
      graph (10179). Fixed by swapping the ternary's two branches at the
      single point render() consumes `sourceSinkOnly` (graphRenderer.ts) —
      deliberately did NOT touch isSourceSinkReason/computeNodeDegrees (both
      independently verified correct twice over) or rename
      `showSourceSinkOnly`/relabel the checkbox, per explicit instruction to
      keep this the smallest possible diff. Re-verified live (real checkbox
      click, real `path.link` count): unchecked=753, checked=10179, back to
      753 on uncheck. If this resurfaces as "still backwards," the checkbox's
      OWN label text ("Show Source-Sink connections") no longer matches its
      new checked=full/unchecked=isolated polarity — that mismatch is
      probably worth a copy fix (e.g. "Isolate Source-Sink connections",
      unchecked-by-default reads more naturally for an opt-in isolate) rather
      than another polarity flip; flagged, not yet acted on.
  - Keyword hub round 2 (after "still too strong/too visible/wrong color"
    feedback): shrank `KEYWORD_HUB_RADIUS` from `cardRadius()*1.05` down to
    `*0.55` (now smaller than a card, not bigger), dropped circle
    `fill-opacity` from 0.82 to 0.62, and swapped the color from gold
    `#d4a72c` (too close to RARITY_COLOR.rare `#d4af37` — a real, confirmed
    collision) to a muted slate-violet `#7d739c` — violet is the one hue
    family nothing else in this UI uses (WUBRG identity colors, rarity's own
    gold/orange/grey, and produce/consume/atypical/grant/magnifier's own
    green/blue/grey/cyan/pink are all spoken for, see constants.ts/main.css).
    Icon/text fill flipped from near-black `#101115` to light `#e9e6f2` to
    stay legible against the now-darker/more-translucent composited fill.
    Also made the hub genuinely draggable (`keywordDrag()`, mirrors the card
    `drag()` right above it) — it wasn't before (`.node-keyword` had
    `pointer-events: none` in GraphCanvas.vue's CSS, silently swallowing
    every pointer event including drag). A hub isn't a real simulation node
    so dragging just writes `x`/`y` directly (no fx/fy pinning) and sets a
    `dragging` flag `keywordHubForce` checks to skip its own centroid-ease
    while the flag is set (otherwise the auto-follow fights the cursor);
    members still get pulled toward wherever the hub currently is regardless
    of the flag, so dragging visibly tows the cluster along. Verified via
    Playwright: read `g.node-keyword`'s `__data__.x/y` before/after a
    simulated mouse down-move-up sequence, confirmed it actually changed.
    At low opacity + the shared blur filter, the circle itself is nearly
    invisible against busy card art (only really visible zoomed in as a soft
    tinted halo behind the icon/label) — LOOKS like "a wing icon + oversized
    disconnected text floating in space" at a glance/small screenshot crop,
    but a closer crop confirms it's one cohesive soft blob, not a bug. Flag
    if this reads as *too* washed out in practice — the opacity number was a
    judgment call, not a hard requirement.

## Open questions

- RESOLVED (was the entry above): Source-Sink checkbox polarity was
  intentional, not a bug — confirmed explicitly. Unchecked=isolate (753),
  checked=full graph (10179). See the "RESOLVED" note under Decisions above
  for what actually changed.
- ❓ The checkbox's own label ("Show Source-Sink connections") now reads
  backwards from its real polarity (unchecked isolates, checked shows
  everything) — worth a copy tweak at some point (e.g. "Isolate Source-Sink
  connections," unchecked by default) but not done yet since it wasn't asked
  for and touching label text felt like scope creep on top of an already
  multi-round fix; flag if it should happen now.

- Fixed a real bug (buildGraph.ts's `manaCost` field): a split/adventure/
  multi-way-split card's node showed EVERY face's mana pips concatenated
  into one strip instead of just the front face's own cost. Root cause:
  Scryfall's top-level `mana_cost` field is genuinely just "all faces' own
  mana_cost joined by ` // `" as ONE STRING for those layouts (confirmed via
  the Scryfall API directly: split "Fire // Ice" -> `"{1}{R} // {1}{U}"`, a
  5-way split -> all five joined, adventure "Thranduil, Sindarin Liege //
  Silvan Rally" -> `"{2}{G/U}{G/U} // {1}{G/U}{G/U}"`) — buildGraph.ts's old
  `c.mana_cost ?? c.card_faces?.[0]?.mana_cost ?? null` preferred that
  concatenated top-level string whenever present, and manaPipCodes()/
  parseManaSegments() (graphRenderer.ts/manaSegments.ts) just extracts every
  `{...}` chunk in a string with no awareness of a ` // ` separator, so both
  (or all N) faces' pips rendered together. Wasn't caught earlier since
  transform/modal_dfc cards (FIN's own DFCs) happen to leave the top-level
  field blank/null for that layout, always falling through to
  `card_faces[0]` already — only split/adventure/flip-family layouts (rare
  in FIN itself, common via a live `?sf=` crossover-set query) actually hit
  the broken branch. Fix: swapped the priority — `card_faces?.[0]?.mana_cost
  ?? c.mana_cost ?? null` — front face's own cost first, top-level only as a
  last resort for a genuinely single-faced card with no `card_faces` at all.
  Verified against the ACTUAL reported card (Thranduil, Sindarin Liege //
  Silvan Rally, HOB/`hob`) via a live `?sf=name:Thranduil` query: node's own
  bound `manaCost` datum went from `"{2}{G/U}{G/U} // {1}{G/U}{G/U}"` (6
  pips shown) to `"{2}{G/U}{G/U}"` (3 pips, correct) after the fix; the
  other 4 Thranduil cards (all single-faced, unaffected either way) kept
  their own correct costs unchanged.

## Testing notes (for next time)

Screenshotting a specific node in this graph via Playwright is fragile —
worth remembering the pitfalls before re-deriving them:
- `page.$('svg')` grabs the FIRST `<svg>` in the DOM, which is a header
  icon, not the graph canvas — use `#graph` (GraphCanvas.vue's own id on
  the canvas `<svg>`), not a bare `svg` selector.
- The force simulation (alphaDecay 0.02) stays live far longer than it
  looks — iteratively re-querying a searched node's screen position across
  many small wheel-zoom ticks accumulates real drift and overshoots
  wildly by the time you reach useful zoom levels. Fix: a SINGLE large
  wheel deltaY (e.g. -6000) anchored at the node's current screen center
  jumps straight to scaleExtent's max in one d3 zoom event — no iteration,
  no drift.
- A hover tooltip (TooltipView.vue) renders as a separate DOM overlay on
  top of the SVG and looks like an actual (unrelated) full Magic card
  render — don't mistake it for the graph node itself when a screenshot
  looks "wrong". Move the mouse well away from the target before the
  final screenshot.
- When a screenshot looks blank/wrong at a node's reported
  getBoundingClientRect, inject a `position:fixed` red-bordered marker div
  at that exact rect (in the same `page.evaluate` that read the rect) and
  screenshot with it on — confirms immediately whether the geometry is
  actually right (it was) rather than chasing a phantom rendering bug.
