# ui agent notes

Scoped working memory for the `ui` specialist. Update before finishing
any task: decisions made, open questions, current state worth resuming
from. This is what makes a fresh respawn cheap — don't rely on transcript
resume alone (session transcripts are swept after ~30 days).

## Decisions

- keywords/index.vue redesigned from a stacked list of independently
  collapsible `KeywordEntryCard`s into a sidebar-nav + content layout: a
  `w-[240px]` `<nav>` (same convention as FilterPanel's own sidebar) lists
  every entry grouped evergreen/fin-mechanic (unchanged grouping), a single
  `selectedKey` ref (defaults to the first entry once `/api/keywords`
  resolves) drives which ONE entry's content renders in the main pane.
  `KeywordEntryCard.vue` kept as the content renderer (only ever used from
  this one page — confirmed via grep before deciding this over inlining,
  so "less churn" came out in its favor) but stripped of its own `open`
  ref/toggle button entirely — it now always renders its body, single-
  selection is enforced by the PAGE only ever mounting one instance
  (`v-if="selectedEntry"`, keyed on `entry.key` so switching resets any
  ScenarioReplay-internal step state cleanly).
  Also removed KeywordEntryCard's own card-art thumbnail gallery (the
  "Xande, Dark Mage" portrait+name header that used to sit above the
  ScenarioReplay for a `covered` entry) entirely for this page, per an
  explicit mid-task correction — not just made text-only, gone outright.
  Added a `forceTextOnly` boolean prop threaded ScenarioReplay.vue ->
  ScenarioReplayTrace.vue (defaults undefined/false everywhere else, so
  the per-card page's own Scenarios tab is untouched) — `imagesFor()` in
  ScenarioReplayTrace.vue returns `undefined` unconditionally when set,
  falling through to the existing `placeholderLabel()` text chip (a 2-char
  abbreviation, e.g. "Xa" for Xande) that already exists for cards with no
  real art — didn't invent a new label scheme, this reuses what the
  no-art fallback path already rendered. KeywordEntryCard.vue passes
  `force-text-only` (bare, always true) on its own ScenarioReplay since
  it's the only caller. Verified end-to-end with a throwaway Playwright
  script against the already-running dev server (localhost:3000): sidebar
  single-select works, 0 `<img>` tags anywhere in a covered entry's replay
  board, gap entries (Hexproof/Ward/Protection) still show `gapNote` text,
  switching keywords swings cleanly with no console/page errors.

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

- PROTOTYPE (not shipped, dev-only toggle, off by default) — "relation hubs":
  generalized the keyword-hub mechanism (see keyword-hub entries above) to
  ordinary produce/consume/atypical/grant/magnifier synergy edges, per an
  explicit ask to prototype "critical mass" edge collapse for broad
  affects-all-X effects (an anthem hitting every creature in a set, e.g.).
  Lives entirely in graphRenderer.ts (`RelationHubState`/`relationHubsById`/
  `relationHubForce`/`relationDrag`/`toggleRelationHub`, new `.relation-link`/
  `.node-relation-hub` CSS in GraphCanvas.vue), plus a `relationHubsEnabled`/
  `relationHubThreshold` pair on the store and a "Relation hubs (prototype)"
  checkbox + number input in FilterPanel.vue's Edges section (explicitly
  labeled non-production, not styled as a finished control on purpose).
  Deliberately did NOT touch the keyword-hub or Source-Sink code paths
  themselves — built alongside, reusing the same custom-D3-force pattern
  (ease hub toward member centroid + nudge member velocity every tick,
  registered as its own named `simulation.force('relationHub', ...)`) rather
  than modifying KeywordHubState/keywordHubForce's own behavior, per explicit
  instruction.
  - Grouping key: `${sourceId}::${reason.description}` — the closest
    client-visible proxy for server/api/graph-links.ts's own `sourceKey`
    (`${producer}::${fact.id}`), which never crosses the API boundary (see
    GraphReason's own fields, api-contract.md). A distinct fact landing on an
    identical description string as another one on the SAME card would
    incorrectly merge under this proxy — accepted as a known approximation
    for a prototype pass, not chased further (would need a new field added to
    GraphReason to fix properly, which is server/api/graph-links.ts's own
    surface — flag to `card`/whoever owns that route if this graduates past
    prototype).
  - Threshold landed on 20 (FilterPanel's own number input, live-tunable, no
    re-fetch needed) by eyeballing the REAL FIN corpus via a standalone graph-
    links.json pull + grouping script (not committed, scratch-only): the
    dominant high-fanout category by far is a generic zone-presence fact
    ("battlefield presence" — see `describeFact` in functional-model/
    synergy.ts, meaning roughly "this card merely exists on the battlefield")
    matched almost universally among FIN's ~100 legendary creatures against
    each other, fanning out 100-129 targets per source, ~93 such source
    groups. The next-broadest REAL category (e.g. "Creature permanents in
    your battlefield," a genuine zone-count fact) tops out around 11 — so 20
    cleanly separates "the runaway-clique case this feature targets" from
    "a normal, if generous, match" without fine-tuning.
  - IMPORTANT CAVEAT, worth relaying if this idea moves past prototype: FIN's
    corpus has NO genuine single-card "anthem grants +1/+1 to all creatures"
    edge case in the actual graph-links data today — a real card with that
    exact oracle text (Rydia's Return, "Creatures you control get +3/+3 until
    end of turn") produces ZERO source-fact edges for that clause at all
    (confirmed directly against graph-links.json). The functional-model
    matcher apparently doesn't model "buffs your own board" as a two-card
    interaction the way it does produce/consume-style facts — that's an
    `engine`-side modeling gap, not something I chased further (out of my
    lane). The concrete demo this prototype actually exercises is the
    "battlefield presence" zone-presence clique instead — a real, if
    less-relatable, stand-in for the same "broad fact matched by nearly
    everything" shape the task described. Flag this if the user wants a truer
    "one anthem card, its whole board glows" demo — that needs an `engine`
    change first, not a `ui` one.
  - Verified end-to-end via Playwright against the live dev server (FIN,
    default corpus): full ungated graph (Source-Sink checkbox checked) draws
    10179 `path.link` elements; flipping "Relation hubs (prototype)" on at the
    default threshold (20) collapses that down to 2696 real links + 73
    synthetic hub nodes (a ~74% cut in real SVG/simulation edge count).
    Clicking one hub's `<g>` (real click, not a synthetic DOM event) flips its
    `expanded` flag and its own reasons flow back into the normal
    activeLinks/activeEdges pipeline unchanged — no separate "expanded"
    render path needed, confirmed the specific hub's own reason-count worth
    of real links reappeared (+118) while the hub itself stayed on-screen
    (relabeled "click to collapse") to toggle back. Confirmed a fresh,
    untouched page load is byte-for-byte unaffected (753 links — the
    existing Source-Sink-isolate default — 0 hub nodes, 0 console errors)
    since `relationHubsEnabled` defaults to `false` and nothing reads
    threshold/groups at all when it's off.
  - Own take, for whoever reviews this: the mechanism itself works (edge
    count genuinely collapses, expand/collapse toggling is real, default
    behavior is untouched) but the FIN corpus's actual dominant high-fanout
    case (many source cards independently forming ~93 NEAR-IDENTICAL
    "battlefield presence" cliques against nearly the same ~100-card
    population) is a worse test case than a clean single-anthem scenario:
    since each qualifying source gets its OWN hub, ~93 hubs end up densely
    overlapping/stacked on nearly the same screen position (their member
    centroids are nearly identical), reading as a confusing amber blob
    instead of N clean separate landmarks — screenshotted, visibly a mess at
    the "73 hubs on screen" zoom level. If this graduates past prototype,
    worth exploring merging/deduplicating hubs whose member SETS are
    near-identical (one hub per distinct membership signature rather than
    per source card) rather than tuning the threshold further — the fanout
    threshold itself isn't the problem, the 1-hub-per-source assumption is.
    Didn't attempt that consolidation here (scope: get the core auto-collapse
    idea running and evaluable, not solve every corpus-specific rough edge).

- Follow-up bug investigation on the relation-hub prototype above (two
  issues the user hit testing it live) — BOTH resolved as non-bugs, verified
  via real Playwright interaction (real button/checkbox clicks through
  Playwright's own actionability checks, not `page.evaluate(() =>
  el.click())`, which — found out the hard way — bypasses visibility/
  clickability entirely and had been silently masking whether the panel was
  even open during my own first-pass verification):
  - **"Checkbox has no visible effect"**: the wiring is correct end-to-end
    (`v-model` -> `relationHubsEnabled` ref -> `currentRenderOptions()` ->
    watch -> `render()`, confirmed the checkbox's own `aria-checked`
    actually flips true on a real click). The real explanation: the DEFAULT
    view is the Source-Sink-isolated 753-edge subset (unchecked = isolate,
    see that filter's own polarity note above), and within that
    topologically-restricted subset (pure-producer -> pure-consumer edges
    only), NO (source, description) group happens to cross the default
    threshold of 20 — so there's genuinely nothing to collapse until either
    the threshold is lowered (confirmed: dropping it to 5 in that same
    isolated view produces 44 hubs / 96 links) or Source-Sink is ALSO
    checked (full graph — confirmed: 2696 links / 73 hubs at the default
    threshold, same numbers as my original verification pass). Not a code
    fix — this is a discoverability/default-view gap worth flagging if the
    feature continues: the prototype's own effect is invisible under this
    app's actual default filter state unless the user also touches a SEPARATE
    checkbox first. Didn't change anything here (evaluation-stage
    prototype, not a fix task) — flagging for whoever reviews next.
  - **"Stray faint edges on Choco/Mog, Cid, Esper Ramuh with Source-Sink
    unchecked"**: NOT stale DOM/exit-not-removed, NOT keyword/relation-hub
    link bleed-through (confirmed zero `.relation-link`/`.node-relation-hub`
    elements exist while the prototype toggle is off, which it was for this
    repro), NOT an opacity leak on filtered-OUT edges. Every single edge
    touching these three unrelated cards (41 for Summon: Choco/Mog, 26 for
    Summon: Esper Ramuh, both counts independently re-derived from raw
    graph-links.json + a from-scratch reimplementation of
    computeNodeDegrees/isSourceSinkReason, then cross-checked byte-for-byte
    against the LIVE DOM's own bound `__data__`) is a real, correctly-
    qualifying pure-source->pure-sink edge — description `"battlefield
    presence"` or `"graveyard presence"` on all of them. Systemic across
    unrelated cards for a real reason, not a shared bug: those two facts are
    near-universal in FIN (matched by ~100+ legendary/permanent cards each),
    so a large fraction of the topologically-pure-sink nodes in this corpus
    happen to be reachable by one of them — same card set the relation-hub
    prototype's own "battlefield presence" cliques above are built from.
    "Barely visible" is the PRE-EXISTING quality-based opacity gradient
    (`edgeColorScale`/`qualityNorm`, floor 0.15) correctly bottoming out for
    a fact this widely shared (its `reasonWeight` budget splits ~100+ ways) —
    by design (reasonWeight's own header comment: "a fact matched by dozens
    spreads thin"), not a defect. Confirmed this ALSO reproduces identically
    (same 41/26 counts) on a clean `git stash` back to the pre-prototype
    commit — predates every line of my relation-hub work, not a regression
    I introduced. No code change made (correctly-functioning existing
    behavior, not a bug) — if the user still wants "presence" facts excluded
    from the Source-Sink filter's qualifying set entirely (a real, separate
    design question: should a near-universal fact ever count as a "pure"
    source/sink edge at all?), that's a `filters.ts`/`isSourceSinkReason`
    scope question for a future task, and arguably touches whether
    functional-model should even MODEL "presence" as a matchable fact in the
    first place (`engine`'s lane) — flagged, not actioned.
  - Reusable finding for future live-repro tasks in this app: this project's
    FilterPanel starts CLOSED (`store.panelOpen` defaults false, off-screen
    via negative margin), so any Playwright repro against a fresh page load
    needs a real click on the header's "Toggle themes panel" button
    (`aria-label`, not a literal "Filters" text) before any filter-panel
    control is actually clickable/visible — `page.evaluate(() =>
    el.click())` will "work" (fires the framework's click handler) even
    while the panel is off-screen and would NOT catch this class of gap;
    only a real Playwright `locator.click()` (which asserts visibility
    first) surfaces it.

- SUPERSEDES all "Source-Sink" entries above (the checkbox polarity
  back-and-forth, the isolate-753-edges design, the topological
  computeNodeDegrees/isSourceSinkReason machinery, the "checkbox has no
  visible effect because default view is the isolated 753-edge subset" bug
  finding) — the whole topological "pure producer -> pure consumer subset"
  MODEL was confirmed wrong by the user, not just its polarity, and was
  scrapped entirely rather than patched again. Real intent: the graph has
  two independent edge categories — (1) keyword-to-card (keyword hubs) and
  (2) card-to-card (ALL produce/consume/atypical/grant/magnifier reasons, no
  topological subset). The control formerly named "Source-Sink" is now a
  PLAIN show/hide toggle over category 2 as a whole:
  - `store.showSynergyEdges` (renamed from `showSourceSinkOnly` — the old
    name's "Only" no longer means anything once there's no subset), default
    `true` (checked = normal look, same as if the feature didn't exist).
  - `false` (unchecked) removes EVERY card-to-card synergy edge completely —
    not faded, not filtered by degree, genuinely absent from both
    `activeLinks` (so physics stops pulling too) and the visual `activeEdges`
    fan-out. `graphRenderer.ts`'s `render()`: `const synergyLinks: SimLink[]
    = showSynergyEdges ? nodeFilteredLinks : [];` — the entire prior
    per-reason `isSourceSinkReason` filtering step is gone, not just
    inverted again.
  - Deleted `computeNodeDegrees`/`isSourceSinkReason`/`NodeDegree` from
    `filters.ts` outright (not left orphaned-but-unused) — no other
    consumer existed project-wide (grepped to confirm) and keeping a dead
    topological model around would misdirect a future reader. `reasonSource`/
    `reasonTarget` stay (still used by the relation-hub prototype's own
    grouping).
  - Checkbox polarity is now genuinely natural (checked=show, unchecked=hide,
    matching its own label) — no inversion, no polarity-justifying comment
    needed anymore. Relabeled "Show Source-Sink connections" ->
    **"Show synergy edges"** since "Source-Sink" as a concept no longer
    exists in this feature at all.
  - `resetFilters()` (useGraphStore.ts) — confirmed separately, this was
    ALSO the task that first pulled `showSourceSinkOnly`/`selectedKeywords`/
    relation-hub state out of "Reset filters" — that decoupling survives
    this redesign unchanged (Edges section still isn't reset by the
    Colors/Rarity/Type reset button).
  - Verified live via real Playwright clicks (not `page.evaluate(() =>
    el.click())`) against FIN's real graph-links: checked (default) = 10179
    links (byte-for-byte the same as if the toggle didn't exist); one real
    click -> unchecked = 0 card-to-card links; one more real click -> back to
    10179. Separately confirmed a keyword hub (checked "Flying", 36
    keyword-link lines + 1 hub node) is completely unaffected by toggling
    this checkbox either way — category 1 (keyword) and category 2
    (card-to-card) are fully decoupled, per spec. Card count (Colors/Rarity/
    Type-driven) never moved in any of this — confirmed unchanged at 306
    throughout.
  - `SavedFilters.showSynergyEdges` (localStorage) is the one field in that
    interface whose ABSENCE means "on" (`?? true`), not "off" — every other
    optional field there defaults to off/empty. Deliberately does NOT read
    from a stale `sourceSinkOnly` key as a fallback either — that field's OLD
    meaning (isolate to a topological subset) doesn't map onto this one's
    meaning (plain show/hide of everything) at all, so an old saved value is
    orphaned/ignored rather than reinterpreted; a pre-existing saved blob
    from before this redesign just gets the new default (shown) on next
    load, not a silently-wrong inherited value.

- keywords/index.vue + KeywordEntryCard.vue: built the real 3-way status
  treatment on top of `engine`'s stopgap mechanical typecheck fix (369-entry
  registry expansion), using the new shared `ReviewStatusBadge.vue` +
  `POST /api/keywords/review-status`:
  - Sidebar search: a `UInput` (same component/props AppHeader.vue's own
    card/theme search box already uses) drives a plain case-insensitive
    substring match against `entry.title`, applied independently inside
    each of the two group computeds (`evergreen`/`finMechanics`) so the
    evergreen-first grouping structure survives filtering; a group's own
    `<div>` is now `v-if`'d on its filtered array's length so a
    zero-match group (e.g. searching an evergreen-only term) disappears
    entirely rather than showing an empty heading. Renamed the second
    group's heading from "FIN-set mechanics" to "Set-specific keywords &
    mechanics" while touching this file — the old label was stale after
    `category: 'fin-mechanic'` became `'set-specific'` (full historical
    taxonomy, not FIN-only) — a copy fix riding along, not a separate ask.
  - Sidebar perf (369 entries, up from ~15): measured live, no jank —
    it's a flat list of plain `<button>`s with no per-row image/compute
    cost, well within what an unvirtualized `v-for` handles fine.
    Deliberately did NOT add a virtualization library for this — would be
    real added complexity (scroll-into-view-on-select would need its own
    handling once rows aren't all real DOM nodes) for a problem that
    isn't actually present at this size.
  - `setsUsed` (KeywordEntryCard.vue): rendered as a wrapped chip list
    ABOVE the gap/replay content, for ANY entry that has it (not gated on
    `not_implemented` vs `ai_reviewed`/`human_reviewed` — the task's own
    "for set-specific keywords" wording, and registry.ts's own doc
    comment, both scope this by category/field-presence, not by review
    status) — confirmed live against Enchant (293 sets, `not_implemented`)
    it still shows the full sets header before the "no gapNote" empty
    body. Capped display at 16 chips (`SETS_SHOWN_COLLAPSED`) with a
    "+N more"/"show fewer" toggle rather than dumping ~80-290 raw codes;
    did NOT add a set-code -> full-name tooltip (no such mapping is
    cheaply available client-side — `data/cards.db` is a sqlite mirror,
    not something to ship to the client just for this) — flagged in the
    task as optional/judgment-call, skipped rather than over-building.
  - 3-way status: `ReviewStatusBadge` renders above `ScenarioReplay` for
    both `ai_reviewed` (`:badge="entry.status === 'ai_reviewed'"` → true)
    and `human_reviewed` (→ false, no Draft pill) — same component
    instance/props shape for both, matching how the card page's own
    Facts/Scenarios tabs already use it. `not_implemented` renders
    nothing from ReviewStatusBadge at all (component's own `v-if="status
    !== 'not_implemented'"` at its root) and KeywordEntryCard only shows
    `entry.gapNote` `v-if` it's actually present (never fabricated —
    matches registry.ts's own "gapNote only for FIN-relevant gaps" rule,
    confirmed live: Hexproof shows its note, Abandon — real keyword, zero
    FIN presence — shows nothing extra).
  - Confirm wiring: `confirmReview()` lives in KeywordEntryCard.vue
    (has `entry.key` already), POSTs `{ key, reviewed: entry.status !==
    'human_reviewed' }` (toggles whichever direction ISN'T current, same
    pattern the card page's own `toggleReviewStatus` uses for its two
    two-state fields) and emits the server's own returned `reviewStatus`
    up via a `reviewed` event. The PAGE (not the card component) owns
    `/api/keywords`'s fetched array, so `handleReviewed()` in
    keywords/index.vue mutates `selectedEntry.value.status` directly (the
    computed returns the SAME object living inside `data.value`, not a
    copy) rather than refetching — confirmed no full-page reload, no
    re-render of the whole sidebar, just the one badge/button flipping
    live. This also means the "Mark as draft" direction (undo) works for
    free even though the task only explicitly asked to wire the
    ai_reviewed→human_reviewed direction — left it working both ways
    since it's the same shared component/button and an inert button would
    have been worse.
  - Verified end-to-end live (Playwright against the running dev server,
    real `locator.click()`/`.fill()`, not `page.evaluate`): 369 sidebar
    buttons render; searching "enchant" narrows to exactly that one
    entry; Enchant's 293-set chip list shows collapsed-then-"show
    all"-then-293; Hexproof (not_implemented, FIN-relevant) shows its
    gapNote; Abandon (not_implemented, non-FIN) shows nothing past the
    header; Menace (ai_reviewed) confirmed live → Draft pill disappeared,
    button flipped to "Mark as draft", reviewedNote appeared, zero
    console errors, no navigation — then reverted back to draft via the
    same button (and deleted the resulting
    `functional-model/keywords/review-status.json` test artifact
    afterward) to leave the dev-only override file exactly as found.
    `npm run typecheck` clean throughout.

## Open questions

(none currently open on the synergy-edges toggle — see the SUPERSEDES entry
above for the full redesign history; the old "checkbox label reads
backwards" question no longer applies now that the polarity is natural and
the label itself changed.)

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

- 2026-09-09, keywords page: reverted `forceTextOnly` (real card art back
  on, per the user's own explicit reversal) and added per-keyword URL
  routing. Two things worth remembering:
  - **Routing shape**: `app/pages/app/keywords/index.vue` became
    `app/pages/app/keywords/[[slug]].vue` (Nuxt's optional-catch-all
    syntax) rather than splitting into separate `index.vue` +
    `[slug].vue` files — one file serves both the bare route
    (`route.params.slug` undefined -> defaults to the first entry) and
    `/app/keywords/<slug>`, no duplicated fetch/sidebar/search logic.
    `selectedEntry` is a plain `computed` off `(data, route.params.slug)`,
    not a `ref` synced via a `watch` — an unmatched/absent slug falls back
    to the first entry, same as before. Sidebar clicks call `navigateTo`
    to the entry's own slug URL instead of mutating local state, so back/
    forward walks between keywords for free. Slug scheme lives in
    `app/lib/keywordSlug.ts` (`slugifyKeywordTitle`) — lowercases, expands
    `&` to `" and "` BEFORE the generic non-alphanumeric-run-to-hyphen
    collapse (so "Flying & Reach" -> "flying-and-reach", not
    "flying-reach" — matches the user's own literal example), and is run
    in BOTH directions (link generation and route-param resolution) so
    there's no separate reverse-slug parser to keep in sync. Verified
    against all 369 registry titles: zero slug collisions.
  - **Real second-card art gap, found and fixed while reverting
    `forceTextOnly`**: simply removing `forceTextOnly` wasn't enough for
    Flying & Reach specifically — its own scenario (Ahriman attacking,
    Iron Giant blocking) never marks EITHER card `isSelf`
    (scenarioReplay.ts's `isSelf` detection keys off a log entry's
    `instanceId`, which only ever appears on cast/activate/trigger
    lifecycle entries; flying-reach's own scenarios.ts adds both creatures
    as plain bystanders via `pilot.state.addCard` + a manual `enters` log
    push, no `instanceId` at all) — so NEITHER card ever hit the old
    `imagesFor`'s only two art sources (`isSelf` -> singular `cardImages`
    prop, or `fillerImages` for basic lands/named tokens). Fixed generally,
    not just for this one bundle: added a `namedCardArt` prop
    (`ScenarioReplay.vue` -> `ScenarioReplayTrace.vue`, keyed by a card's
    own real name, carrying images/keywords/power/toughness) that
    `imagesFor`/`iconKeywords` check FIRST, ahead of the old singular-self/
    filler logic — populated only by `KeywordEntryCard.vue`, built from
    `entry.cards` (every name in a bundle's own `cardNames`, already
    fetched server-side with real Scryfall art). Undefined everywhere else
    (the per-card page's own Scenarios tab never sets it, unaffected —
    confirmed via its own scenarios tab + the existing 21-test
    `scenarioReplay.test.ts` suite, both still pass). A card with NO real
    identity at all (flying-reach's own synthetic "Grounded Blocker",
    added purely to demonstrate the illegal-block rejection) correctly
    still renders its placeholder chip — that's the intended fallback, not
    a bug, per the user's own "text placeholder only when a card genuinely
    has no art" framing.
  - Verified live end-to-end via Playwright against the already-running
    dev server: bare `/app/keywords` defaults to first entry; clicking
    Flying & Reach in the sidebar navigates to
    `/app/keywords/flying-and-reach` and shows 2 real `<img>`s (Ahriman +
    Iron Giant) plus exactly one remaining placeholder chip (Grounded
    Blocker, correctly); a fresh direct load of that same URL (new
    `page.goto`, not client-nav) resolves the same content immediately;
    back/forward between Flying & Reach and Menace both work; search
    ("enchant" -> exactly one sidebar result) and a set-specific entry's
    sets-used chip list (Cascade -> "Printed in 41 sets") both still work;
    zero console errors throughout. `npm run typecheck` and
    `scenarioReplay.test.ts` both clean.
