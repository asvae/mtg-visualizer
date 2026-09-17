# ui agent notes

Scoped working memory for the `ui` specialist. Update before finishing
any task: decisions made, open questions, current state worth resuming
from. This is what makes a fresh respawn cheap — don't rely on transcript
resume alone (session transcripts are swept after ~30 days).

## Decisions

- 2026-09-18: fixed the bare-color-word `STATUS_OPTIONS` labels ("Gray"/
  "Purple"/"Blue"/"Yellow"/"Green") on the predicates/features/sets
  `/app/engine/*` console tabs — dot color + `value`/status-computation
  logic all untouched, label text only. Checked `keywords/[[slug]].vue`
  first — it already uses semantic `Covered`/`Gap` labels, no fix needed
  there.
  - Predicates (`app/pages/app/engine/predicates/index.vue`, meanings from
    `functional-model/sink-derivation-status.ts`): gray→"No predicate
    yet", purple→"Unverified", blue→"Verified", yellow→"Rejected",
    green→"Confirmed".
  - Features (`app/pages/app/engine/features/index.vue`, meanings from
    `functional-model/engine-status.ts`): gray→"Open gap", purple→"Closed,
    unverified", blue→"Closed, verified", yellow→"Rejected", green→
    "Confirmed".
  - Sets (`app/pages/app/engine/sets/index.vue`, meanings from
    `functional-model/card-status.ts`'s priority-order header comment) —
    only touched the 5 bare-color entries, left `verified`/`uncertain`/
    `re-review` alone (already semantic): green→"Fully covered", yellow→
    "Coverage gaps", orange→"Needs provenance", red→"Unsupported
    construct", gray→"Untouched".
  - No stray hardcoded "Gray"/"Blue"/etc. strings existed anywhere else in
    the three files outside `STATUS_OPTIONS` itself (grepped to confirm) —
    every other consumer (detail-pane dot `:title`, row dot `:style`)
    already derives from `statusMeta(...).label`/`.color`, so fixing the
    one array's `label` field was the whole fix, no second edit point.
  - Verified live via Playwright against a real dev server on all three
    tabs: filter-chip button text now reads the new labels with correct
    counts (e.g. predicates: "No predicate yet (2)", "Verified (2)";
    features: "Open gap (3)", "Closed, unverified (15)", "Closed, verified
    (11)"; sets: "Fully covered (56)", "Coverage gaps (14)", "Needs
    provenance (194)", "Unsupported construct (26)", "Untouched (3)",
    alongside the untouched "Verified (9)"/"Uncertain (1)"/"Re-review (3)"
    trio) — 0 console/page errors. `npm run typecheck` — same
    pre-existing unrelated errors as always (`CardDetailTabs.vue`/
    `functional-model/card-status.ts`/`card.ts`/`mana.ts`/`server/api/
    tokens/by-key.ts`), zero new errors from the three edited files.
    `npx vitest run` — 1147 passed, same 5 pre-existing sandbox-only
    `tagging/*`-data-missing failures as always, unrelated.

- 2026-09-17: reworked `/app/engine-status` and `/app/sink-derivations` from
  their original flat lists into the SAME sidebar-nav + single-selected-
  detail layout `/app/keywords/[[slug]].vue` uses, per an explicit override
  of the flat-list call made earlier that same day (see the two entries
  right below this one — both of them documented "flat list, no sidebar
  needed, list is small" as a deliberate choice; that reasoning is now
  superseded, not re-litigated — the user wants layout consistency with
  `/app/keywords` regardless of list size).
  - Mirrored `/app/keywords`' structural shell class-for-class: `nav`
    `w-[240px] min-w-[240px] flex flex-col overflow-y-auto border-r
    border-border-subtle bg-panel p-2.5` on the left (title + description,
    then a `UInput` search box with the same clear-button `#trailing`
    slot pattern, then the row list), and a `min-h-0 flex-1 overflow-y-auto
    p-6` content pane on the right with the same `mx-auto max-w-4xl`
    wrapper. Loading/error top-level states also copied verbatim
    (`v-if="pending"` / `v-else-if="error"` before the nav+content
    `template`).
  - Did NOT copy `/app/keywords`' per-entry URL routing
    (`[[slug]].vue`/`navigateTo`) — that page's slug-based deep-linking is
    a separate feature this task didn't ask for; both reworked pages use a
    plain local `selectedKey` ref instead (defaults to the first entry in
    the CURRENTLY VISIBLE — i.e. already search/filter-narrowed — list via
    a `watch(visibleEntries, ..., {immediate: true})`, re-picks a new
    default if the current selection scrolls out of the filtered set)
    exactly the way keywords/index.vue's OWN pre-slug-routing version did
    (see that entry further down this file, from before the `[[slug]].vue`
    migration) — reused that simpler precedent rather than inventing a
    third pattern.
  - The existing color-toggle "filter by status" row buttons (previously
    a horizontal wrapped row of dot+label+full-description text above the
    list) moved into the sidebar as a compact vertical list — dropped the
    inline description text (no room at 240px) but kept it as the button's
    `title` tooltip, so hovering still surfaces the same explanation text
    that used to be always-visible. Search box matches page-specific
    fields: engine-status matches `title` OR `#<gapNumber>`; sink-
    derivations matches `label` OR `slug`.
  - All existing review logic (STATUS_META, submitReview/confirmEntry/
    clearReview/openReject/submitReject, the optimistic in-place mutation,
    the dev-gated `isDev` controls, the reject `UModal`) is UNTOUCHED —
    only the template was restructured; the per-row detail markup (status
    dot, evidence chips, excerpt/motivation, review note block, Confirm/
    Reject/Clear buttons) was relocated as-is from the old `v-for` row
    into the single `selectedEntry`-keyed detail block on the right, just
    renamed `entry.*` → `selectedEntry.*`.
  - Verified live end-to-end via Playwright against the real dev server
    (not `page.evaluate`-driven clicks): both pages render the sidebar+
    detail shell with 0 console/page errors; a junk search query on each
    correctly narrows to a "no entries match" empty state and clears back
    to the full list; the FULL confirm→green→clear-review AND
    reject-with-note→yellow→clear-review round trip both work end-to-end
    on one real row per page (engine-status: gap #1 "Combat: blockers,
    damage, first/double strike, trample"; sink-derivations: "Crew cost
    activation path") against the real file-backed endpoints — confirmed
    `functional-model/engine-status-reviews.json` and
    `functional-model/sink-derivation-reviews.json` both back to `{}`
    afterward (same "undo your own live-verification write" discipline as
    the original build passes). `npm run typecheck` — same pre-existing
    unrelated errors as always (`CardDetailTabs.vue`/`functional-model/
    card-status.ts`/`card.ts`/`mana.ts`/`server/api/tokens/by-key.ts`),
    zero new errors from either reworked file. `npx vitest run` — 1135
    passed, same 5 pre-existing `tagging/sets/*`-data-missing failures as
    always (sandbox-only, unrelated). Did not touch `/app/keywords` itself
    per the task's own instruction (read-only reference for the pattern).

- New page `/app/sink-derivations` (2026-09-17) — the sibling status page to
  `/app/engine-status` for the `engine` agent's separate sink-derivation-
  predicate axis (`GET /api/sink-derivations` + `POST
  /api/sink-derivations/review`, contract:
  `.claude/contracts/sink-derivation-status-schema.md`). Deliberately a
  SEPARATE flat-list page, not merged into `/app/engine-status` — the two
  index genuinely different things (ENGINE_GAPS.md's numbered list vs. this
  axis's own small hand-seeded `SINK_DERIVATION_MECHANISMS` array) with
  different row shapes (no gapNumber/title/excerpt/testFiles here; instead
  motivation/expectedSinkShapes/predicate-module+corpus-manifest evidence) —
  didn't force a shared component given the row shapes don't line up
  cleanly, same judgment call the task itself invited.
  Reused the EXACT SAME STATUS_META color mapping (gray #6b7280/purple
  #a855f7/blue #3b82f6/yellow #eab308/green #22c55e) verbatim per this
  task's own instruction — only the per-color DESCRIPTION text differs
  (this axis's gray/purple/blue mean predicate-module + corpus-manifest
  filesystem presence, not an ENGINE_GAPS.md CLOSED marker). Confirm/
  reject-with-required-note/clear-review flow is a near-identical copy of
  `/app/engine-status`'s own `submitReview`/reject-modal pattern (same
  optimistic in-place mutation, same `isDev`-gated controls, same dev-only
  403 posture) — copied rather than extracted into a shared composable,
  since engine-status's page is otherwise the only other consumer and the
  two entries' fields differ enough (gapNumber+title vs. label+slug) that a
  forced shared row component would need its own prop-shape-negotiation
  either way.
  Sort order: alphabetical by `label` (not by an array index or gapNumber
  the way engine-status sorts) — this axis's `key`/`slug` (not a
  numbered-prefix key) IS the stable identity per the contract's own
  explicit "unlike engine-status... this axis's slug values ARE the stable
  identity" note, so there's no unstable-title-vs-stable-number split to
  preserve the way engine-status's own gapNumber-based sort exists to avoid.
  Nav: added an 8th header icon button (`i-lucide-git-fork`) right after
  the existing `i-lucide-cpu` engine-status one in AppHeader.vue.
  Live-verified via Playwright against the real dev server: `GET
  /api/sink-derivations` returned exactly the documented 4 entries (saga,
  stun-counters, finality-counters, crew), all genuinely `gray`/baseline
  `gray` (no predicate module exists yet for any of them, confirmed in the
  raw JSON); page rendered all 4 labels with zero console/page errors; full
  confirm->green->clear-review round trip AND reject-with-note->yellow->
  clear-review round trip both worked end-to-end against the real
  file-backed endpoint on the `saga` row (cleaned
  `functional-model/sink-derivation-reviews.json` back to `{}` afterward,
  confirmed via a direct read — same "undo your own live-verification
  write" discipline as the engine-status page's own verification pass);
  nav button click from a fresh load actually navigates to
  `/app/sink-derivations`. `npm run typecheck` showed only the same
  pre-existing unrelated errors already on `main` before this task
  (`CardDetailTabs.vue`/`functional-model/card-status.ts`/`card.ts`/
  `mana.ts`/`server/api/tokens/by-key.ts` — none touched by this change,
  none in the new page or AppHeader.vue); `npx vitest run` — 1135 passed,
  same 5 pre-existing `tagging/sets/*`-data-missing failures as always
  (unrelated, sandbox-only). No project ESLint config exists (`eslint
  --config` errors on a bare run) — there's no `npm run lint` script
  either, so no lint pass was possible beyond typecheck; flagging in case
  that's actually meant to exist and is just missing/misconfigured.

- New page `/app/engine-status` (2026-09-17) consumes the `engine` agent's
  new gray/purple/blue/yellow/green capability-status axis
  (`GET /api/engine-status` + `POST /api/engine-status/review`, contract:
  `.claude/contracts/engine-status-schema.md`). Deliberately a FLAT list,
  not the sidebar+detail layout `/app/keywords` uses — the tracked list is
  small (29 rows today, contract says don't hardcode that count) and every
  row's own detail (excerpt/test-file citations/remainder flags) is short
  enough to show inline, no need for a nav+single-selection split. Each row
  shows a color dot on `color` (render-on field per contract) plus a
  "baseline: X" chip only when a review has overridden it away from the
  computed baseline, a CLOSED-marker/remainder/no-test-cited explanation
  row (small colored chips using the existing produce/consume/magnifier
  tokens, not new colors) so the WHY behind purple vs blue vs gray is
  visible without reading ENGINE_GAPS.md itself, and the raw evidence
  excerpt in muted italic (per contract: raw prose fragment, not curated
  copy — rendered as-is, no markdown parsing).
  Confirm is a single click (`POST .../review {verdict:'confirm'}`, no
  note needed per contract); Reject opens a `UModal` (established pattern,
  see AppHeader.vue's own filter dialog) with a required `UTextarea` note,
  submit button disabled until non-empty (matches the API's own 400 on an
  empty-note reject); a "Clear review" button (verdict: null) reverts to
  the computed baseline. All three do an OPTIMISTIC in-place mutation of
  the fetched entry object (same convention `/app/keywords`' own
  `handleReviewed` uses) rather than refetching the whole list.
  Review controls are gated `v-if="isDev"` (a local `const isDev =
  import.meta.dev` — learned live that using `import.meta.dev` directly
  inline in a template attribute expression breaks the Vue SFC compiler,
  "import.meta may appear only with sourceType: module"; CardDetailTabs.vue
  already avoids this via the same local-const pattern, worth grepping for
  before reaching for `import.meta.*` directly in a `v-if`); status itself
  still renders in production, matching the review endpoint's own dev-only
  403 posture (view always works, only the write path is gated).
  New STATUS_META color set (gray #6b7280 / purple #a855f7 / blue #3b82f6 /
  yellow #eab308 / green #22c55e) is local to this page, not reusing
  `ReviewStatusBadge.vue` — that component's `ReviewStatus` is a different
  3-way ai/human/not_implemented vocabulary that doesn't fit this axis's
  5-state baseline+overlay shape or its required-note-on-reject payload;
  didn't force a shared abstraction across two genuinely different status
  models. Nav: added a 7th header icon button (`i-lucide-cpu`) next to the
  existing keywords/status ones in AppHeader.vue, linking to
  `/app/engine-status` — no merge into `/app/keywords` (per this task's own
  instruction: that page answers a different question, `registry.ts` isn't
  this axis's index).
  Live-verified via Playwright against the real dev server: a real gray
  (#25), purple (#1), and blue (#4) row rendered correctly; confirm ->
  green -> clear-review round-trip on a gray row, and reject-with-note ->
  yellow round-trip on a blue row, both worked end-to-end against the real
  file-backed endpoint (had to manually clean up
  `functional-model/engine-status-reviews.json` back to `{}` afterward via
  the same clear-review call — a live verification pass against a
  file-writing dev endpoint leaves real repo-tree state behind if you don't
  undo it).

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

- 2026-09-15: `server/api/cards.ts`'s discover-typeahead leg (the `name:"..."`
  query shape SearchBox.vue's `runDiscoverFetch` sends on every debounced
  keystroke) now resolves against `data/cards.db` first, same local-DB
  pattern `server/api/cards/by-names.ts` already established for its own
  earlier 429 lockout — this was the SAME root cause resurfacing on a
  DIFFERENT route (discover typeahead had never been given the by-names.ts
  treatment). Root cause of the actual rate-limit hit today: repeated
  automated Playwright runs hitting this un-batched live-Scryfall leg all
  day, not the debounce (debounce logic untouched, out of scope per the
  task).
  - `NAME_QUERY_RE = /^name:"([^"]*)"$/i` matches ONLY that exact shape —
    deliberately narrow, so a free-typed `?sf=` query (real Scryfall search
    grammar: color/type/set filters, boolean combos, printing-intent flags)
    still goes live unchanged. `db` null (prod, gitignored 600MB+ file never
    deployed) also falls through unchanged — same `existsSync`-at-module-load
    pattern by-names.ts uses, verified by control-flow reasoning (the new
    `if (db && nameTerm) {...}` block is a pure early-return; no other branch
    depends on it) rather than physically yanking the 600MB file off a live
    dev server mid-session.
  - Unlike by-names.ts's own EXACT-name lookup, this is a substring/prefix
    typeahead: two-step query (1. `SELECT DISTINCT name ... WHERE name LIKE
    '%term%' ESCAPE '\'`, prefix matches ranked first via a `CASE WHEN name
    LIKE 'term%'` tiebreak, then shorter/alphabetical, capped at
    `MAX_CARDS+1` to detect truncation cheaply; 2. per matching name, reuse
    by-names.ts's own "best printing" pick — `is_normal DESC, released_at
    DESC LIMIT 1`). A DFC's already-combined `"Front // Back"` name column
    means a front-face-only search term (e.g. "Jecht") already substring-
    matches without needing by-names.ts's own separate `LIKE 'term // %'`
    fallback query — confirmed live, no extra logic needed for that case.
  - Verified live against the running dev server (`data/cards.db` present
    locally): `name:"Jecht"` resolves in ~150ms with NO Scryfall response
    headers (confirms local path, not network) to the correct DFC
    (`Jecht, Reluctant Guardian // Braska's Final Aeon`); `name:"Chocobo"`
    returns 9 correctly-ranked/prefix-first results just as fast; a
    non-name-shaped live query (`set:fin type:creature`) still takes ~5s
    (real paginated Scryfall network round trip, unchanged). `npm run
    typecheck` clean (same 2 pre-existing unrelated errors as always —
    `functional-model/mana.ts`, `server/api/tokens/by-key.ts`); `npx vitest
    run` — 677 passed, same pre-existing 5 `tagging/sets/*`-data-missing
    failures as before (confirmed unrelated, sandbox-only).
  - Didn't touch `by-names.ts`, `set-order`, or any other cards.db consumer —
    scoped to this one route's name-search leg per the task.

- 2026-09-16, SearchBox.vue (PRD 03 follow-up, no PRD doc update — an ask
  outside the PRD's own written scope): added a "Newest first" sort toggle
  (alongside the existing default relevance/name-match ranking, not
  replacing it) and infinite scroll past the old hard `RESULT_LIMIT` cutoff.
  Touched `app/components/SearchBox.vue`, `app/types.ts` (new
  `CardData.releasedAt?: string`), `app/lib/buildGraph.ts` (`ScryfallCard`
  gained `released_at?: string`, mapped through in
  `scryfallCardToCardData`).
  - **Cap strategy picked**: `RESULT_LIMIT` (still 10) becomes the initial
    PAGE size, not a hard cutoff — a new `visibleCount` ref grows by
    `RESULT_LIMIT` each time (scroll-near-bottom on the results `<div>`, OR
    ArrowDown hitting the last currently-visible row while more remain, so
    keyboard-only nav can reach exactly as far as scrolling can). Picked
    over "render everything, let the browser scroll" because `allRanked`
    (the full merged+ranked list, unsliced — `rows` is just its
    `visibleCount`-sized prefix) can hold up to two 500-card pools merged
    together for a broad query; never mounts more real DOM rows than the
    user has actually scrolled/arrowed to.
  - **Sort logic**: `sortMode` ref (`'relevance'` default | `'newest'`), a
    plain two-button toggle (sticky header row inside the results dropdown,
    not a separate control outside it — stays reachable while scrolling a
    long list). `allRanked`'s own comparator: 'relevance' unchanged from
    before (name-match rank, then alphabetical); 'newest' sorts by
    `releasedAt` descending, tie-broken by the same relevance rule, with a
    real (not hypothetical) fallback rule for a row with NO `releasedAt` at
    all — see the parity finding below — such a row sorts to the END of the
    newest-first list (never mixed in arbitrarily, never treated as
    "oldest"), ordered among itself by plain relevance.
  - **Real cross-lane data-parity gap found and confirmed live, not just
    reasoned about — flagging for `card` agent, did NOT touch their files**:
    `CardData.releasedAt` is reliable ONLY for the default FIN bulk pool
    (buildGraph.ts reads `data/fin/fin_scryfall.json` — real raw Scryfall
    data, `released_at` present — directly, no server reshaping in
    between; confirmed via a `tsx` one-liner:
    `scryfallCardToCardData(rawFinCard).releasedAt` → `"2025-06-13"`).
    EVERY other path is missing it because it's stripped by `card`-owned
    code before the client ever sees it:
    - `server/api/_cardShaping.ts`'s `minimalCard()` doesn't pass
      `released_at` through at all (confirmed by reading it directly — not
      in its returned object's field list).
    - `server/api/cards.ts` (SearchBox's own discover-fetch AND a live
      `?sf=` query's bulk pool) — confirmed live via a raw `curl` POST
      (`name:"Sol Ring"`): response card object has no `released_at` key.
    - `server/api/card/[set]/[number].ts` / `server/api/cards/by-names.ts`
      (an individually-added Scope/Deck card) — grepped directly, neither
      route's response shape includes it either.
    Practical effect, confirmed live via Playwright against the running dev
    server, not assumed: a broad query ("a", 250 total matches) showed
    IDENTICAL first-row order under "Newest" and "Relevance" — because
    every FIN-scope row shares the exact same release date (one set, tied,
    falls back to relevance ordering among itself) and EVERY discover row
    (the majority of a broad query's matches) has no date at all, so it's
    pushed as a block to the end in unchanged relevance order. A
    pure-discover query ("sol ring", no local-scope match at all) showed
    byte-identical relevance/newest ordering, confirming the "no date →
    falls back to relevance" degradation path is real, not just written in
    a comment. **This means the shipped "Newest first" feature only
    genuinely reorders across cards from DIFFERENT sets when a card in the
    mix happens to be part of the local FIN bulk pool vs. not — it does NOT
    yet let a user sort live-discovered results (the exact case the task's
    own motivating example — "the one card buried in a broad query" — most
    needs) by release date at all.** Full fix needs `card` agent to thread
    `released_at` through `_cardShaping.ts`'s `ScryfallCard`/`minimalCard()`
    and into the three routes above's response shapes — flagged, not
    guessed at or worked around, per lane rules (`api-contract.md` assigns
    those routes' payload shape to `card`, not `ui`).
  - Keyboard nav re-verified end-to-end unaffected (real Playwright,
    `locator`/`input.press`, not `page.evaluate`): ArrowDown past the
    initial 10-row page grows `visibleCount` to 20 with no crash/jump;
    active-row highlight stays exactly one element; ArrowRight-arm +
    Enter-toggle-add/remove + a second Enter to revert still works
    unchanged; Escape still closes. Switching sort mode resets
    `activeIndex`/`armed`/`visibleCount` back to the fresh-query defaults
    (same reasoning `trimmedQuery`'s own watch already had) so an armed
    button or a deep scroll position from the OLD order can't silently
    survive onto rows now in different positions.
  - Added one small UX addition not explicitly asked for but low-risk/
    directly serves the same "buried result" problem: a `watch(activeIndex,
    ...)` calls `scrollIntoView({ block: 'nearest' })` on the newly-active
    row (via a `data-row-index` attribute + a new `resultsEl` template ref)
    — there was NO auto-scroll-into-view before this task at all (grepped,
    confirmed absent), which used to be a non-issue only because
    `RESULT_LIMIT=10` mostly fit inside the fixed `max-h-96` dropdown
    without scrolling; once a page can grow past that via ArrowDown, without
    this the highlighted row could silently scroll out of view.
  - `npm run typecheck` clean (same 2 pre-existing unrelated errors as
    always — `functional-model/mana.ts`, `server/api/tokens/by-key.ts`);
    `npx vitest run` — 801 passed, same 5 pre-existing `tagging/sets/*`-data-
    missing failures as before (confirmed unrelated). All
    `.scratch-verify-*.mjs` throwaway scripts deleted before finishing,
    confirmed via `git status`.

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

- 2026-09-13, PRD 01 "Core concepts" (docs/prds/01-core-concepts.md)
  implemented — Scope becomes individually editable, a frontend card cache
  avoids re-fetching stable card data, and a first-class Deck (`{name,
  entries:[{card,quantity}]}`, no format/legality/caps) is unioned with
  Scope only at render time. Touched `app/composables/useGraphStore.ts`
  (the big one), `app/lib/buildGraph.ts`, new `app/lib/cardCache.ts`,
  `app/types.ts` (new `Deck`/`DeckEntry`), `app/components/AppHeader.vue`,
  `app/components/GraphCanvas.vue`.
  - **Old paste-a-decklist feature reconciled, not left bolted on**: it used
    to BE a whole alternate Scope (`SET_CODE='deck'`, a real page
    navigation/reload, gated by an "Global filter by deck" checkbox that
    decided "known" (badges only) vs. "active" (replaces the whole app's
    card set)). That entire mode — `DECK_ACTIVE_KEY`/`DECK_TEXT_STORAGE_KEY`,
    the checkbox, the `stampKnownQty`/bulk `/api/cards/by-names` scope-
    replace branch in `load()` — is gone, not renamed. Pasting a decklist
    now calls a new `importDeckFromText(text, 'merge'|'replace')` (bulk-
    resolves the WHOLE paste in one `/api/cards/by-names` call — a
    deliberate bulk action, distinct from the single-card targeted-fetch
    constraint, which only applies to one-at-a-time add/remove) that merges
    straight into the live, reactive `store.deck` — no navigation, no
    reload, the graph updates immediately. The old "known vs. active"
    duality collapses cleanly into the new model: Deck is now ALWAYS
    unioned in (PRD's own design), so there's nothing left to opt into —
    the checkbox is gone from AppHeader.vue's Import tab entirely.
  - **Scope**: `scopeAdded` (`Map<id, CardData>`) and `scopeRemoved`
    (`Set<id>`) sit on top of whatever bulk pool `load()` fetches (now only
    `'fin'` or a Scryfall query — the old third `'deck'` SET_CODE value is
    gone). `addCardToScope(set, number)`/`removeCardFromScope(cardId)` are
    the targeted ops; both namespaced-persisted per SET_CODE
    (`SCOPE_EDITS_STORAGE_KEY`) — an edit is a statement about THIS bulk
    pool, not a global preference. Removing a card is uniform regardless of
    origin (bulk or individually-added) — "hidden from view" just means
    "not in either side of the union," no special-casing needed.
  - **Deck**: `deckName`/`deckEntries` (`Map<id, DeckEntry>`), persisted
    GLOBALLY (`DECK_STORAGE_KEY`, deliberately NOT namespaced by SET_CODE —
    a Deck is independent of whatever Scope happens to be loaded, matching
    the PRD's own MTG-Arena analogy). `addCardToDeck`/`setDeckEntryQuantity`
    (qty<=0 deletes the entry — the WHOLE "leaves view" mechanism, not a
    separate rule)/`removeDeckEntry`/`renameDeck`/`clearDeck`/
    `importDeckFromText`, all no validation/caps anywhere, per the PRD's
    explicit "total sandbox" call.
  - **The union** (`graph` computed in useGraphStore.ts, PRD's own
    "Scope ∪ {Deck qty>0}"): `baseGraph` (renamed from the old plain
    `graph` ref — buildGraph()'s bulk-pool output) is the internal-only
    base; the exposed `graph` recomputes on every scopeAdded/scopeRemoved/
    deckEntries change, merging cards by id (Deck entries stamp `qty` onto
    the card — same field the existing ×N badge/qty-boost-physics code
    already reads, so nothing downstream needed to change for that part)
    and re-resolving links via a NEW extracted `resolveCardLinks()`
    (buildGraph.ts) against the FULL retained `/api/graph-links` NameLink[]
    pool (`graphLinksPool`, kept for the whole session — buildGraph() itself
    only ever sees the bulk pool, so its own internal link-resolution can't
    see an individually-added card at all).
  - **Card cache** (`app/lib/cardCache.ts`, new file): module-scope
    `Map<string,CardData>` keyed by `${set}/${number}`, persisted to
    localStorage, no TTL, manual-clear only (`clearCardCache`) — exactly
    the PRD's own spec. Only caches the `/api/card/[set]/[number]` route's
    own `card` field (not the whole edges/themes/functionalModel/
    interactions payload) — deliberately scoped to what Scope/Deck actually
    need; flagged in my report that the card DETAIL page's own fetch
    (`card` lane's file, `app/pages/app/card/[set]/[number].vue`) was NOT
    switched onto this cache — that's `card` lane's own call to make if
    they want it, not touched here to stay in-lane.
  - **Real bug found and fixed while verifying, not just asserted**:
    `GraphCanvas.vue` had NO watcher on its own `graph` prop at all — it
    only ever consumed `props.graph` ONCE, inside `onMounted`, to construct
    the renderer (`createGraphRenderer` builds `cardNodeById`/`linksByCard`
    once, at construction, from whatever graph it's given, and never again
    — the file's own "persistent node objects" design, previously safe
    ONLY because `graph` never changed identity after a page's one-time
    `load()`). Once `graph` became a computed that CAN change (Scope/Deck
    edits), this meant the store was correct (confirmed via
    `store.graph.value.cards.length`) but the DOM never updated — caught by
    literally reading real DOM node counts via Playwright before assuming
    success, not by reading the code. Fixed by adding one more `watch(() =>
    props.graph, ...)` in GraphCanvas.vue that destroys and recreates the
    renderer (same "start over" trade-off the existing manual "Rerender"
    button already accepts — graphRenderer.ts has no incremental node-set-
    patch capability, and building one is real graphRenderer-owned scope
    creep this task didn't take on) and re-applies every other bit of
    current state (filters, forces, gravity mode, search, card selection)
    onto the fresh instance so a Scope/Deck edit doesn't ALSO silently reset
    those. Never fires from a plain Colors/Rarity/Type/Keywords/
    showSynergyEdges change (none of those feed the `graph` computed).
    Factored `handlers`/`currentForces()` out to plain reusable
    consts/functions so the initial-mount creation and this new watcher's
    recreation call the exact same code, not two hand-kept-in-sync copies.
  - **Share link**: `ShareState.mode` dropped `'deck'` as a value (Deck is
    no longer a Scope-replacing mode) — `deckText` now rides independently
    of `mode` (`fin`/`query`) rather than being its own exclusive third
    branch. Encoding (`buildShareUrl`) serializes the LIVE `store.deck` as a
    plain decklist-shaped string; decoding merges it into the fresh
    session's Deck via `importDeckFromText` from an `onMounted` hook (async,
    can't happen in the synchronous module-scope restore block the way
    colors/rarities/search still do) — swallows a failure the same way a
    network hiccup anywhere else in this file already is. A PRE-migration
    `share_mode=deck` link still degrades gracefully (collapses to `'fin'`
    Scope, its `deckText` still merges in) rather than erroring.
  - Facets (`availableRarities`/`availableTypes`) now also recompute off a
    NEW `watch(graph, ...)` (not just once at `load()` time) and
    auto-WIDEN (never narrow) `selectedRarities`/`selectedTypes` for a value
    that's genuinely new since the last check — otherwise an individually-
    added Scope/Deck card of a rarity/type the base bulk pool never had
    would render correctly but sit permanently hidden behind Colors/Rarity/
    Type with no checkbox ever able to turn it back on (Colors itself
    doesn't have this problem — COLOR_ORDER is a fixed, non-corpus-dependent
    list already). Gated on the existing `readyToPersist` flag purely
    defensively; confirmed this never overrides a restored saved-filter
    selection (load()'s own initial assignment always happens-before this
    watcher's first real run).
  - `getKnownDeckCards()`/`getActiveFilterMode()` (both consumed by `card`
    lane's standalone card-detail page, which doesn't share this store
    instance) kept their EXACT same exported shapes/signatures — only their
    internal source changed (the real persisted Deck instead of a raw
    pasted-text blob). One flagged semantic change for `card` lane to
    sanity-check: the old "Global filter by deck" checkbox gated when Deck
    scoped that page's own Previous/Next/Interactions-panel; that checkbox
    is gone now, so `getActiveFilterMode()` treats Deck as "active" for that
    page whenever it simply has ANY entries at all (no more explicit opt-in
    — there's nothing left to opt into once Deck no longer competes with
    Scope for what the main graph shows). Not acted on beyond flagging,
    since deciding whether that's the right call for THAT page's own UX is
    `card` lane's call, not mine.
  - Flagged, not touched (out of lane, `card`'s own file): a stale comment
    in `server/api/card/[set]/[number].ts` (near `cardMetaCache`) still says
    "DECK_ACTIVE_KEY-adjacent DB connections" as a descriptive analogy — that
    constant no longer exists. Purely cosmetic, doesn't affect behavior.
  - Verified for real (Playwright against the running dev server, FIN
    corpus), not just asserted: `addCardToScope('lea','1')` fires exactly
    ONE network request (`GET /api/card/lea/1`) and the DOM's own
    `.node-card` count goes 306→307; a second call for the SAME card via a
    DIFFERENT collection (`addCardToDeck('lea','1',1)`) fires ZERO requests
    (cache hit); a genuinely new card (`leb/1`) fires exactly one request;
    a Deck-only card (never in Scope) renders (308 cards, `qty` stamped
    correctly) and disappears the instant its quantity drops to 0
    (`setDeckEntryQuantity(id, 0)`); a card removed from Scope but ALSO
    still in Deck with qty>0 stays visible (via the Deck side of the
    union) — all 3 of PRD 01's acceptance criteria confirmed via live
    network/DOM inspection, not code reading. Also verified end-to-end
    through the REAL AppHeader.vue UI (not just direct store calls): opened
    the filter modal, switched to "Import deck," pasted "2 Lightning Bolt /
    1 Black Lotus," clicked "Add to deck" — card count went 306→308 with no
    reload, `store.deck.value.entries` showed both cards at the right
    quantities, zero console errors. Share-link round-trip verified across
    two separate browser contexts (simulating two different sessions):
    copied link correctly encodes Deck content, a fresh context loading
    that link restores the same 2 deck entries, then cleans its own URL
    back to a bare `/app`. Existing Colors/Rarity/Type filtering re-verified
    unaffected (unchecking White dropped the unioned 307-card view to 261,
    same mechanism as before). `npm run typecheck` clean (same 2
    pre-existing unrelated errors as before — `functional-model/mana.ts`,
    `server/api/tokens/by-key.ts`); `npx vitest run` — 444 passed, the same
    5 pre-existing failures as before this task (missing `tagging/sets/*`
    data directory in this sandbox, unrelated to this change — confirmed by
    checking those files simply don't exist here at all, not something my
    diff touches).
  - Explicitly NOT built (per the task's own scope line, PRD 03/04's job):
    no add/remove-card button anywhere in the graph/card UI, no Deck list/
    editor view, no quantity-editing UI. A temporary `window.__mtgStore`
    dev-console hook was used for the Playwright verification above and
    then removed before finishing — not shipped.

- 2026-09-13, PRD 04 "List view" (docs/prds/04-list-view.md) implemented — a
  second, functionally-parallel renderer over the exact same
  Scope/Filter/Deck state the graph reads. New `app/components/ListView.vue`;
  touched `app/composables/useGraphStore.ts` (small extensions, not a
  parallel state model), `app/components/AppHeader.vue` (Graph/List toggle),
  `app/pages/app/index.vue` (conditional mount), and — the real find of this
  task — `app/components/GraphCanvas.vue` (a genuine pre-existing latent bug
  this PRD was the first thing to actually trigger).
  - **Reused, not rebuilt**: `store.graph` (same Scope∪Deck union),
    `passesAttrFilters`/`AttrFilters` (`app/lib/filters.ts`, same function
    GraphCanvas/graphRenderer already call) for row filtering, `FilterPanel.vue`
    (mounted unconditionally in `app/pages/app/index.vue` regardless of view
    mode — not forked/duplicated for List), `store.openCardPanel` (PRD 02
    peek panel — a row click opens the exact same panel a node click would),
    `parseManaSegments` (`app/lib/manaSegments.ts`) + `ManaSymbol.vue` (both
    already-shared, non-card-lane files) for the mana-cost column instead of
    reinventing pip parsing — graphRenderer.ts's own `manaPipCodes` is D3/SVG-
    specific and wasn't reusable directly from a plain Vue template, but the
    underlying segment-splitting logic was.
  - **"Themes" filter facet, flagged not built**: PRD 04's own acceptance
    text lists "colors/rarities/types/themes" as facets to support, but
    `ThemeData`/`EdgeData` (app/types.ts) are the CARD-DETAIL-PAGE's own
    per-card "synergy model" data (`card` lane's `CardPeekPanel.vue`/full
    card page), not a graph-wide filter facet — confirmed via grep, no
    `FilterPanel.vue`/store concept of a "theme" filter exists anywhere in
    this codebase today. Read this as the PRD's own text being aspirational/
    carried over from planning-conversation vocabulary rather than a real
    gap to fill — building a genuinely NEW "themes" filter facet would
    violate this same PRD's own explicit non-goal ("does not add new filter
    facets"). Mirrored EXACTLY what FilterPanel already filters by
    (Colors/Rarity/Type) and left it there; flagging this reading in case
    the PRD author actually meant something concrete by "themes" that isn't
    in the codebase yet.
  - **Store extensions** (useGraphStore.ts) — deliberately small, additive,
    no new parallel state:
    - `scopeCardIds` (new exported `computed<Set<string>>`) — real Scope
      MEMBERSHIP, as opposed to `scopeCardCount`'s mere count (which now
      derives from this instead of duplicating the loop). Needed because a
      list row's `CardData` comes from the Scope∪Deck UNION (`store.graph`),
      which doesn't itself carry "which side of the union is this card
      actually on" — a row's own Scope add/remove control needs that
      distinction to render/act correctly (a Deck-only row shows "Add [to
      Scope]"; a Scope row shows "In scope" with a remove action).
    - `addCardToScope(set, number, presetCard?)` — third param added. A list
      row already HAS the card's full `CardData` (it came from the union
      itself); re-adding it to Scope via the pre-existing fetch-by-set/number
      path would force a network round trip for data already in hand. When
      supplied, skips `fetchCardBySetNumber` entirely and reuses the given
      card directly; every other caller (SearchBox's discover rows, which
      never have the card in hand ahead of a fetch) omits it, unchanged
      behavior.
    - `setDeckEntryQuantity(cardId, quantity, presetCard?)` — third param
      added. Before this task, NO caller could ever hit "no existing entry
      yet, quantity > 0" at all (silently no-op'd) — only `addCardToDeck` (a
      separate, always-fetches path) could create a fresh entry, and PRD 01
      explicitly flagged "no quantity-editing UI exists yet" as unbuilt. A
      list row's qty stepper needs 0→N directly, with the card's data
      already in hand — now creates the entry synchronously, no network,
      when `presetCard` is given; omitted, unchanged (only ever touches an
      existing entry, matching its original signature/behavior exactly).
    - `viewMode` (`'graph' | 'list'`, persisted to
      `mtg-visualizer-view-mode`, NOT namespaced by SET_CODE) — same
      "standing UI habit, not a per-set preference" reasoning as
      `functionalModelTab`/`gravityMode`. AppHeader.vue's new toggle is the
      only writer.
  - **ListView.vue**: plain `<table>`, sortable by name/cmc only (click a
    `<th>` toggles asc/desc, re-clicking the same key flips direction), no
    column config, per the PRD's own non-goals. Filtering is literally
    `props.graph.cards.filter(c => passesAttrFilters(c, attrFilters))` — the
    exact same predicate the graph itself applies, so there's no risk of the
    two views silently drifting on what "matches the current filters" means.
    Deck-qty column reads `card.qty ?? 0` directly off the row's own
    `CardData` — this already gets stamped by the `graph` union computed for
    any card with a Deck entry (the SAME field the graph's own ×N badge
    already reads), so no separate `store.deck.value.entries` lookup was
    needed at all.
  - **REAL PRE-EXISTING BUG found and fixed, not just this PRD's own new
    code**: `GraphCanvas.vue`'s `onMounted(async () => { await
    document.fonts.load(...); ...; watch(...); ... })` registered EVERY
    persistent `watch()` (filters, search, forces, gravity mode, the
    `props.graph` identity watcher — the works) AFTER an `await`. This is a
    genuine, general Vue pitfall: a lifecycle hook's callback only has the
    component tied to Vue's internal "current instance" context
    SYNCHRONOUSLY, for the duration of its own un-awaited call — anything
    reactive (`watch`, `computed`, etc.) created after an `await` inside an
    async hook callback loses that tie entirely and is NEVER auto-stopped on
    unmount, running as a permanent zombie. This was harmless before PRD 04
    (GraphCanvas was never actually unmountable while anything else touching
    the same store stayed alive — the only way to leave it was a real page
    navigation, which tears the whole store down too) but PRD 04's Graph/List
    toggle is the first thing that ever unmounts GraphCanvas while
    FilterPanel (mutating the exact same `store.selectedColors`/etc. these
    zombie watchers read) stays mounted. Concretely: switch to List view,
    then toggle ANY filter checkbox → the zombie `watch(() => [...store.
    selectedColors, ...], () => renderer!.render(...))` fires, calling
    `render()` on a renderer already `.destroy()`'d (simulation stopped, SVG
    children removed) whose `<svg id="graph">` root element Vue had ALSO
    since removed from the document entirely — this threw a real, uncaught
    `NotFoundError: Failed to execute 'insertBefore' on 'Node': The node
    before which the new node is to be inserted is not a child of this
    node.`, and — worse — left the List view's own table PERMANENTLY stuck
    on stale data (its own reactivity is fine; the uncaught exception from
    the zombie watcher happening in the same microtask/patch cycle appears
    to abort Vue's whole pending flush, so ListView's own otherwise-correct
    `rows` computed update never actually reached the DOM). Confirmed via
    Playwright BEFORE the fix (reproduced reliably, in both filter-widen and
    filter-narrow directions, with GraphCanvas having mounted+unmounted at
    least once first — confirmed via a control run that NEVER let
    GraphCanvas mount at all this session, e.g. by pre-seeding
    `mtg-visualizer-view-mode=list` before first load, which did NOT
    reproduce the crash, isolating it to GraphCanvas's own unmount
    specifically) and AFTER (zero errors, both directions, list updates
    correctly every time).
    - **Fix**: restructured so `onMounted`'s callback itself is no longer
      `async` — renderer CREATION (`createGraphRenderer`) and every single
      `watch()`/the whole rest of the mount logic now run synchronously,
      properly tied to the component's effect scope. Only the font-load
      wait + the very FIRST `render()` call (the only two things that
      actually needed that delay, for `graphRenderer.ts`'s own
      fallback-font title-fit race — see that code's own longstanding
      comment) got pushed into a fire-and-forget async IIFE at the very end
      of the (now sync) `onMounted` callback, run AFTER every watcher is
      already registered. Added a new `destroyed` flag (module-scope `let`,
      set in `onBeforeUnmount`) the deferred IIFE checks before touching
      `renderer` — closes the one remaining race this restructure doesn't
      structurally fix on its own (unmounting fast enough that the font
      promise is still in flight when `onBeforeUnmount` runs).
    - Deliberately did NOT change `graphRenderer.ts` itself (destroy()'s own
      `simulation.stop(); svg.selectAll('*').remove();` was already
      correct) — the bug was entirely in WHEN GraphCanvas.vue registered its
      own watchers relative to Vue's instance-tracking window, not in the
      renderer's cleanup logic.
  - **Verified live** (Playwright against the already-running dev server,
    FIN corpus, real interactions): graph node count and list row count
    match exactly under every filter combination tried (baseline 306;
    Colors-only narrow to 260; Rarity+Type combined narrow to 267) and agree
    again after widening back out — confirmed via BOTH toggling a filter
    while already in List view AND toggling in Graph view then switching to
    List. Sort: name asc/desc and mana-value (cmc) asc/desc all read back
    correctly ("A Realm Reborn" first ascending, "Zodiark, Umbral God" first
    descending; cmc ascending starts with the "—"/no-cost rows, descending
    starts at `{9}`). Deck qty stepper (+/− buttons and direct number-input
    edit) all correctly call through to the real store and reflect back
    (0→1→2→1→4, confirmed via the input's own live value). Scope
    add/remove control: removing a card that ALSO has Deck qty>0 correctly
    keeps its row visible (Deck-side union); re-adding correctly flips the
    button back to "In scope". Row click opens the exact PRD 02 peek panel
    (URL went `/app` → `/app?card=fin/196`, `aside[role=dialog]` present) —
    same component, same mechanism a graph node click already uses, nothing
    forked. View-mode toggle persists across a real page reload
    (`localStorage` restore confirmed: table present, `#graph` absent on a
    fresh `page.goto` after reload). Zero console/page errors across every
    run once the GraphCanvas fix landed. `npm run typecheck` clean (same 2
    pre-existing unrelated errors as always — `functional-model/mana.ts`,
    `server/api/tokens/by-key.ts`); `npx vitest run` — 526 passed, same 5
    pre-existing failures as before (missing `tagging/sets/*` data in this
    sandbox, confirmed unrelated). All `.scratch-verify-list*.mjs` throwaway
    scripts deleted from the repo root before finishing, confirmed via `git
    status`.
  - Not built, per the PRD's own non-goals: no new filter facets (see the
    "themes" flag above), no column customization/configurability.

- 2026-09-13, "urgent regression: graph doesn't render" investigation —
  **could NOT reproduce, no code change made.** Dispatched as a live
  same-day-conflict-risk concern after four sequential passes touched
  `GraphCanvas.vue`/`graphRenderer.ts` (PRD 03 addCards, PRD 04 onMounted
  sync fix, the addCards/removeCards/soft-render generalization, and the
  drag/click hit-area bugfix — all four already have their own entries
  above). Read BOTH files in full from scratch (not off any prior
  summary, per the task's own instruction) — internally coherent, no
  duplicate/conflicting handler registrations, no leftover dead branches
  from a clobbered merge; the `destroyed` flag / `lastFilters` gating in
  addCards()/removeCards() is a little permissive (an add/remove that
  lands in the narrow window before the deferred font-load IIFE's first
  `render()` call sets `lastFilters` is silently NOT rendered by that
  call itself) but is provably not a dead-end: the deferred IIFE's own
  eventual `render()` doesn't gate on `lastFilters` and reads the same
  closure `graph` addCards/removeCards already mutated, so nothing is
  ever lost, just possibly delayed by however long the font-load promise
  takes (fast, in practice) — noted as a real if narrow edge case, not
  fixed since it can't produce a PERMANENT blank graph.
  - Verified LIVE against the actual running dev server (:3000, a peer
    session's) via fresh Playwright browser contexts (not
    `page.evaluate`): plain fresh `/app` load renders 306 nodes, zero
    console/page errors, every same-day feature re-verified working in
    ONE continuous session — Colors filter toggle (306→260→306),
    discover-add via SearchBox (306→307, "Lightning Bolt"), Scope remove
    via the same row's button (307→306), card click opening
    CardPeekPanel (`?card=fin/NNN`, panel present), CardPeekPanel's
    resize handle present and draggable. Also spun up a wholly SEPARATE,
    freshly-started `nuxt dev` process (port 3010, `NUXT_IGNORE_LOCK=1`
    since a lockfile blocks a second instance by default — killed
    afterward, did not touch/restart the peer's own :3000 process) to
    rule out any server-side module-graph staleness from the day's many
    HMR updates — same clean 306-node render, same all-features-pass
    result there too.
  - Specifically tested the exact failure shapes the task's own dispatch
    flagged as likely: (1) a genuine Vue `<script setup>` HMR
    replacement of `GraphCanvas.vue` while the page was already open and
    settled (confirmed via a real vite-client websocket `"type":"update"`
    frame, not just a CSS hot-update) — survived cleanly, 306 nodes
    before and after, zero errors; (2) a direct `/app?card=fin/1` deep-link
    load (share-link-style entry exercising the panel-already-open-on-mount
    path) — clean; (3) rapid repeated Graph/List view toggling (4 cycles)
    and a filter change made WHILE parked in List view then switched back
    to Graph (the exact PRD-04 zombie-watcher shape already fixed once
    today) — all clean, correct counts, zero errors throughout.
    `npm run typecheck` — same 2 pre-existing unrelated errors as always
    (`functional-model/mana.ts`, `server/api/tokens/by-key.ts`), nothing
    new from this domain's files.
  - One unrelated, PRE-EXISTING (not from today's four passes — confirmed
    via the same clean run) cosmetic console warning worth flagging:
    `AppHeader.vue`'s PRD-04 Graph/List toggle wraps its two `UButton`s in
    a `<UButtonGroup>` that Vue can't resolve (`Failed to resolve
    component: UButtonGroup` on every load) — grepped `@nuxt/ui`'s own
    installed package and found no `ButtonGroup` component shipped at all
    in this project's `^4.11.0` version. Harmless in practice (Vue still
    renders the unresolved tag's slot content as-is, so both buttons
    still show and work — confirmed in every screenshot above), just
    means the two buttons never get NuxtUI's actual grouped/joined visual
    treatment (rounded-together edges) the author presumably wanted.
    Didn't fix (out of scope for this task, not the reported bug, and a
    real fix needs deciding whether to import a differently-named
    component or hand-roll the joined-corners CSS) — flagging for
    whoever owns AppHeader.vue next.
  - **Own read, for whoever follows up**: given a fresh load, a live HMR
    reload, and every same-day feature all individually and combined
    render/behave correctly against the CURRENT on-disk code (not
    reverted, not cherry-picked — this is the real combined state of all
    four passes), the reported "doesn't render" most likely came from
    either (a) a browser tab that had been open and accumulating live
    state across the editing session's EARLIER, not-yet-fixed window
    (e.g. before the PRD 04 onMounted sync fix landed), not refreshed
    since, or (b) some other transient state this investigation's fresh
    contexts didn't happen to carry (a particular stale localStorage
    shape from a much older pre-this-session visit, browser extension
    interference, etc.) — not something reproducible from a clean slate
    today. Recommend a hard refresh (not just re-navigating) if this
    resurfaces for the same browser tab; if it reproduces AGAIN after a
    genuine hard refresh, that would be new information (a real bug this
    pass's testing didn't happen to trigger) worth a fresh investigation
    rather than assuming this same conclusion still holds.

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
- Prefer `locator.waitFor({ state: ... })` / `page.waitForURL(...)` over a
  fixed `page.waitForTimeout(...)` before concluding a click/keypress
  "didn't work" — confirmed concretely (CardPeekPanel resize task) that a
  perfectly-working Escape-close and Expand-navigate both read as
  intermittently "broken" under fixed timeouts, ONLY when extra elapsed
  real time (repeated full-page reloads, ~1.8s+ of accumulated waiting) had
  passed first; switching the exact same assertions to the auto-retrying
  primitives made them pass 100% of repeated runs. An instantaneous
  `.count()` right after an action (no wait at all) is even more prone to
  this — it doesn't retry even once. Cost real time to run down as a
  suspected regression before realizing it was the test, not the app.

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
- 2026-09-12, keywords-coverage same-bug-class fix (companion to `card` lane's
  `cardFaceKeywords` fix on the per-card page for transform DFCs): the
  coverage page (`server/api/keywords/index.get.ts`'s `cardArtFor` +
  `KeywordEntryCard.vue`) still did `keywords: card.keywords ?? []` — raw
  Scryfall whole-card union, which for a transform DFC wrongly badges BOTH
  faces with a keyword only one actually prints (Crystal Fragments // Summon:
  Alexander: front only has Equip, back only has Flying, but the union lists
  all three of `['Flying','Transform','Equip']`).
  - Fix: `cardArtFor` now imports `cardFaceKeywords`/`ScryfallCard` straight
    from `app/lib/buildGraph.ts` (same helper/type
    `server/api/card/[set]/[number].ts` already uses — didn't reinvent it),
    dropped the file's own narrower local `ScryfallCard`/`ScryfallCardFace`
    interfaces in favor of the shared one (structurally compatible with the
    real `data/fin/fin_scryfall.json` shape; no runtime behavior change,
    pure retype). `CardArt.keywords` is now front-face-only
    (`cardFaceKeywords(card, 0)`), new `CardArt.backKeywords` field added
    (`card.card_faces?.[1] ? cardFaceKeywords(card, 1) : undefined`).
    Deliberately did NOT filter either against `BADGE_KEYWORDS` the way the
    per-card page's own `keywords`/`backKeywords` fields do — that route's
    fields are scoped to the curated evergreen-badge icon strip, this page's
    `keywords` is meant to reflect a card's real full printed keyword set
    (e.g. "Equip", not evergreen) — filtering would have silently dropped
    real, non-evergreen keywords this page needs to show.
  - `KeywordEntryCard.vue`: threaded the new field through as
    `:card-back-keywords="entry.cards[0]?.backKeywords"` on its
    `ScenarioReplay` (that prop already existed end-to-end,
    `ScenarioReplay.vue` -> `ScenarioReplayTrace.vue`, from the card-lane fix
    — just wasn't being fed here yet). Left `namedCardArt`'s own map
    (keyed by name, used for every OTHER/bystander card on a scenario board)
    as front-face-keywords-only — its shape
    (`Record<string, {images,keywords,power,toughness}>`) has no back-face
    variant and lives in `ScenarioReplayTrace.vue` (card lane's file); no
    registry bundle currently puts a transform DFC in a non-self/bystander
    role while `ai_reviewed`/`human_reviewed` (checked: every entry whose
    `cardNames` includes a `"X // Y"` transform name is still
    `status: 'not_implemented'`, i.e. `entry.cards` for those is computed but
    never actually rendered anywhere on this page today) — documented as a
    known follow-up for `card` lane if/when the "transform" keyword entry
    itself graduates past `not_implemented` with a bundle that flips a
    non-self card mid-replay, rather than widening that file's prop type
    myself.
  - Verified against real data (`data/fin/fin_scryfall.json`, reusing
    `cardFaceKeywords`'s exact algorithm in a scratch script): Crystal
    Fragments // Summon: Alexander — whole union `['Flying','Transform',
    'Equip']`, front now correctly `['Equip']` only, back `['Flying']` only.
    Dion, Bahamut's Dominant // Bahamut, Warden of Light (fin/16) — whole
    union `['Dragonfire Dive','Flying','Transform']`, front now correctly
    `[]` (its own "Dragonfire Dive — ...have flying" line is a conditional
    grant sentence, not a standalone printed-keyword line, correctly
    excluded), back `['Flying']` (Bahamut's own back face literally ends its
    oracle text with a bare "Flying" line — real static keyword, correctly
    picked up). Both `not_implemented` today so not yet visible on the page
    itself, but the underlying data is now correct for whenever "transform"
    graduates. `npm run typecheck` clean (one pre-existing, unrelated error
    in `server/api/tokens/by-key.ts` — confirmed present before this change
    too, not mine); `vitest run app/lib` (68 tests) still passing; no
    dedicated keyword-page test file exists in the repo.
  - Housekeeping note: found and removed a stray untracked
    `dion-check-tmp.mjs` scratch script sitting in the repo root (not
    scratchpad) during this task — looked like leftover verification scratch
    from the just-landed card-lane DFC fix (same Dion example), not
    referenced anywhere. Flagging in case whoever left it there still wanted
    it; low-risk since it was untracked and unreferenced, but I didn't create
    it myself so wanted this on record rather than silently deleting it
    without a note.

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

- Dev-only `/docs` page (2026-09-13): lists + renders the repo's own
  markdown docs in-browser (top-level `*.md` except CHANGELOG.md — my call,
  low-value to browse doc-style; `docs/prds/*`; `functional-model/*.md`).
  Same sidebar-nav + content-pane shape as `/app/keywords`'s
  `[[slug]].vue` (optional-catch-all route, registry-order grouping, click
  navigates to `/docs/<slug>`, bare `/docs` falls back to the first entry).
  New files: `app/pages/docs/[[slug]].vue`, `app/lib/markdown.ts`,
  `server/api/docs/_registry.ts` (explicit allow-list, NOT a generic
  file-server — every path repo-root-relative, resolved only against this
  list), `server/api/docs/index.get.ts` (list metadata only — content is
  fetched per-doc, lazily, since ENGINE_GAPS.md/SYNERGY_DESIGN.md are large),
  `server/api/docs/[slug].get.ts`.
  - No markdown-rendering npm dependency existed (checked — no marked/
    markdown-it/@nuxt/content) and adding one is `server`'s call, not mine,
    so I did NOT hit that escape hatch — hand-rolled `renderMarkdown()`
    instead, scoped to exactly what these docs actually use (grepped first):
    ATX headers, fenced code blocks, flat + one-level-nested lists
    (including wrapped continuation text under an item — the real shape
    ENGINE_GAPS.md's numbered items use), blockquotes, hr, paragraphs,
    inline bold/italic/code/links. No tables/images/setext headings in any
    real doc, so didn't implement those.
  - Real bug caught during verification, worth remembering the shape of:
    an early version rendered each list-item's marker line and each
    continuation line through `renderInline()` SEPARATELY before
    concatenating HTML — broke any inline span (bold/code/link) that
    happens to wrap across two source lines, which is common in this
    hand-wrapped prose style (e.g. ENGINE_GAPS.md's own "**Stun and
    finality counters — ... their one real chokepoint.**" opens on one
    line, closes on the next). Fixed by deferring `renderInline()` to a
    single call over each item's fully-accumulated raw text at flush time
    (`ListItem { text, nested }`, rendered only in `closeFrame()`) — same
    pattern the paragraph-handling branch already used correctly. Caught by
    diffing actual rendered output against source markdown, not by reading
    the parser code — worth an actual diff-against-source pass any time a
    hand-rolled text transform like this gets touched again.
  - Code-fence highlighting reuses FunctionalModelScript.vue/
    JsonHighlight.vue's exact established pattern (`highlight.js/lib/core`
    + only the languages actually used — `typescript`/`json`, covering
    every real ` ``` ` tag across these docs: `ts`/plain/`jsonc`) with the
    same hand-mapped `.hljs-*` -> app-palette color mapping, done inline
    inside `renderMarkdown()`'s output rather than a separate Vue component
    (v-html can't mount a component per code block anyway).
  - Dev-only gating: `import.meta.dev` check as the FIRST statement in
    `<script setup>`, before any imports/fetches run — chosen over the
    review panel's opt-in-env-var precedent (`NUXT_PUBLIC_ENABLE_REVIEW`)
    since there's no scenario where this should exist in a real deployment
    even behind a flag (unlike the review workflow tool). Both
    `server/api/docs/*` routes independently carry a
    `process.env.NODE_ENV === 'production'` refusal too (same convention
    server/api/card/review-status.ts already uses) — reachable regardless
    of which page asks, so the page's own client-side gate alone isn't
    enough.
  - Verified for real, not just asserted: ran `NODE_ENV=production npm run
    build` (this project's nitro preset is `netlify` — output lands in
    `.netlify/functions-internal/server/` + a root `dist/` for client
    assets, not a plain `.output/` `nuxt preview` can serve, so I inspected
    the compiled chunks directly instead of trying `nuxt preview`).
    Confirmed: both `server/api/docs/index.get.ts` and `[slug].get.ts`
    compiled down to a bare `defineEventHandler(() => { throw
    createError({statusCode:404}) })` — Rollup dead-code-eliminated the
    entire registry-lookup/file-read body since `NODE_ENV === 'production'`
    was statically `true` at build time. Even stronger for the page itself:
    `app/pages/docs/[[slug]].vue`'s compiled `setup()` (both server chunk
    AND client chunk) reduced to an unconditional `throw
    createError({statusCode:404,...})` with every other statement below
    the dev-gate (all the fetches, markdown rendering, etc.) stripped
    entirely — confirmed by grepping the compiled output for the
    `docs-active-doc` useAsyncData key and finding it in NEITHER bundle.
    One caveat, not a functional issue: the page's scoped CSS (Vue SFC
    compiles `<style scoped>` as a separate artifact from script logic)
    does still ship a few KB in the shared production stylesheet — inert
    dead selectors, not a route/data leak.
  - Open/deferred: didn't add anchor-id generation for in-doc heading
    deep-links (e.g. `/docs/readme#scope`) — only doc-to-doc nav was asked
    for; flag if per-heading linking becomes wanted later, `renderMarkdown`
    would need each heading's slug threaded back out to build a mini TOC.

- 2026-09-13, retired the interactive card-review panel from the UI entirely
  (backend `scripts/review-server.mjs`/`review-relay.mjs` already deleted
  separately; `server` agent handling `nuxt.config.ts`'s
  `runtimeConfig.public.enableReview` + the `review-server` npm script in
  parallel — didn't touch either). Deleted `app/components/ReviewSession.vue`
  outright; removed the 🧾 (`i-lucide-clipboard-list`) header button + its
  `reviewEnabled` gate from `AppHeader.vue`, and the `<ReviewSession
  v-if="reviewEnabled" />` mount + its own `reviewEnabled`/`config` read from
  `app/pages/app/index.vue`.
  - Went one step past the literal 3-file list into `useGraphStore.ts` (my
    own file, in-lane) to remove `reviewSessionOpen` — confirmed fully
    orphaned (only writer was AppHeader's now-deleted button, only reader was
    the now-deleted component) rather than left as inert dead state, since the
    task's own framing was "remove entirely." Flagging this small scope
    addition explicitly in case a stricter file-scoped review was expected.
  - FOLLOW-UP (same session, coordinator asked to finish the job): stripped
    `lookupHighlightCardId` entirely too, per explicit instruction — the
    initial pass above had left it in deliberately as out-of-scope, but the
    coordinator confirmed "dead now (its only writer is gone), strip it
    entirely." Removed the ref + return-object entry in `useGraphStore.ts`
    (and its now-stale doc comment); the `watch(() =>
    store.lookupHighlightCardId.value, ...)` in `GraphCanvas.vue`; and in
    `graphRenderer.ts`: the `setLookupHighlight()` function itself, the
    module-local `lookupCardId`/`hasLookup` state it fed inside
    `refreshHighlight()`, and its mention in `refreshHighlight`'s own header
    comment (now describes just search + card-selection, the two mechanisms
    actually left) — also dropped `setLookupHighlight` from the renderer's
    returned handle object. `refreshHighlight()` itself stays (still drives
    search + `cardSelection` highlighting, both real/still-used).
  - Confirmed via grep: zero remaining `ReviewSession`/`reviewEnabled`/
    `enableReview`/`reviewSessionOpen`/`lookupHighlightCardId`/
    `setLookupHighlight`/`lookupCardId` references anywhere under `app/`.
    `npm run typecheck` clean apart from the two known pre-existing,
    unrelated errors (`functional-model/mana.ts`, `server/api/tokens/by-
    key.ts`) — same as before this change, not introduced by it.

- 2026-09-13, PRD 02 "Navigation" (docs/prds/02-navigation.md) implemented —
  right-side click-to-peek card panel, expandable to the full card page.
  **Flagged discrepancy, acted on rather than blocked on**: the task brief
  claimed a `?card=` URL-sync mechanism "already exists in useGraphStore.ts
  from the recently-landed PRD 01 work" — false, confirmed by reading that
  file in full and grepping the whole `app/` tree for `card=` before writing
  anything: PRD 01 was Scope/Deck/cache only, no URL-synced selection state
  of any kind existed anywhere (the only pre-existing per-card click state,
  `cardSelection`, is an ephemeral, non-URL-synced highlight Set that was
  never even wired to a click handler — `onCardClick` just did
  `window.open(...)` in a new tab). Built the `?card=` mechanism itself as
  part of this task (it's what PRD 02 itself specifies, just not yet
  built) rather than either inventing a differently-shaped state mechanism
  or stalling on the mismatch — the "no new state mechanism" constraint
  reads as "don't invent a SECOND, competing way to track this," which
  doesn't apply to building the one PRD 02 itself calls for when nothing
  else already claims that name/shape.
  - **State shape**: `useGraphStore.ts`'s new `panelCardKey` is a `computed`
    reading `route.query.card` directly (`"<set>/<number>"`, e.g. `fin/21`)
    — not a separate ref kept in sync with the URL. `openCardPanel(set,
    number)`/`closeCardPanel()` both just `router.replace` the query (never
    `push` — a person peeking through many nodes in a row would otherwise
    flood browser history with one entry per peek, needing many "back"
    presses just to leave the page). `useRoute`/`useRouter` called bare
    (Nuxt/vue-router auto-import, same as every other `.vue` file in this
    app already does — e.g. `app/layouts/graph.vue`), NOT this file's own
    usual raw `window.location`/`URLSearchParams` one-way-read convention
    (share links, `sf`, `colors`/...) — those are read-once-at-module-eval,
    this needs live two-way reactive sync while the app is already running,
    a genuinely different need. Only callable inside the `useGraphStore()`
    function body (component/composable-call context), not this file's
    module scope, same constraint `onMounted` above it already has.
  - **Full-page-never-shows-panel guarantee**: comes from where the new
    `CardPeekPanel.vue` is MOUNTED (only `app/pages/app/index.vue`, the
    graph page — never the card detail page's own route), not from the
    state refusing to hold a value elsewhere. Verified live: a direct visit
    to `/app/card/<set>/<number>` never shows the panel regardless of what
    `?card=` happens to be in the URL at the time (it's simply never in that
    page's component tree to render).
  - **GraphCanvas.vue's `onCardClick`**: a plain click now calls
    `store.openCardPanel(card.set, card.collectorNumber)` instead of the old
    unconditional `window.open(...)` new-tab behavior. Kept Ctrl/Cmd-click
    as an escape hatch for the OLD behavior (full page, new tab) — a small,
    low-risk addition since a plain click no longer offers that at all
    otherwise; not asked for explicitly but preserves a capability being
    removed. `onBackgroundClick` (clicking empty canvas) now ALSO calls
    `store.closeCardPanel()` alongside its existing `cardSelection.clear()`
    — this graph's own "click outside," handled entirely within
    GraphCanvas's own handlers rather than by the panel's generic
    document-level listener (see below for why that split matters).
  - **CardPeekPanel.vue** (new): reuses `CardMedia.vue`/`CardRelations.vue`
    (both `card`-owned) completely unmodified, computing `CardRelations`'
    own `columns: RelationColumn[]` prop via the exact same
    `describeRelation`/`groupChipsByVerb` pipeline TooltipView.vue and the
    full card page's own `chipColumns` already use for that identical input
    shape — not reimplemented. Deliberately does NOT reuse
    `app/lib/cardCache.ts` for its own fetch — that cache is explicitly
    scoped to the bare `CardData` field only (its own header comment: "if
    the card detail page wants to adopt this same cache for its own
    full-response fetch, that's a separate call for that lane to make — not
    done here"), and this panel additionally needs `edges`/`themes` (for
    CardRelations) that cache doesn't carry. Keeps its own small
    module-scope, in-memory-only (not localStorage-persisted) cache of the
    fuller `{card, edges, themes}` response instead, scoped to exactly what
    IT reads off the same `GET /api/card/:set/:number` route (a `card`-owned
    server route — read-only reuse, not touched).
  - **Escape/click-outside**: Escape is a plain `window` keydown listener.
    Click-outside is a `document`-level `pointerdown` listener that
    deliberately IGNORES any click landing inside `#graph` (the whole graph
    SVG) as well as inside the panel itself — letting it react to a
    graph-internal click too would race GraphCanvas's own node-click/
    background-click handlers (a click on a DIFFERENT node should SWITCH
    the panel to that card, not close-then-instantly-reopen; since the
    node's own click handler and this document listener both fire off the
    same physical click, whichever fired the "close" would sometimes undo
    the "switch" depending on handler-registration order — excluding
    `#graph` from this listener entirely sidesteps that race rather than
    trying to order around it).
  - **Data during switch/close transitions**: the fetch-response `ref`
    (`data`) is deliberately NOT cleared when `panelKey` goes to `null`
    (closing) — left alone so the panel's own leave-transition still has
    real content to animate away with instead of collapsing to blank first.
    It IS cleared when switching to a genuinely different, not-yet-cached
    key (`key !== prevKey`), so the loading spinner doesn't show the
    PREVIOUS card's content while the new one is in flight.
  - **TooltipView.vue reviewed, deliberately NOT changed**, per the task's
    own explicit ask to check it first: hover-tooltip and click-peek-panel
    show genuinely different relation views (tooltip's `relationCounts` =
    live-graph neighbor-match counts/avg-weight per description, aggregated
    across whatever's currently on screen; panel's `CardRelations` =
    the card's own stable theme/role profile, same `chipColumns` shape the
    full card page already shows) — this mirrors a duality that already
    existed independently on the full card page (hover tooltip elsewhere +
    that page's own inline chip columns), not something newly duplicated by
    this task. No suppression of one while the other is active — hover
    tooltip follows the cursor anywhere on the canvas, panel is pinned at
    the right edge, Notion's own peek doesn't suppress other page chrome
    either. Flagging as a considered-not-blocking judgment call, not a gap:
    if this ever reads as redundant/fighting in practice, worth revisiting
    whether hovering the SAME card that's currently peeked should suppress
    just that one tooltip instance.
  - **Verified live** (Playwright against the running dev server, FIN
    corpus, real interactions — not `page.evaluate(() => el.click())`, per
    this file's own earlier testing-notes section): all three of PRD 02's
    acceptance criteria confirmed end-to-end in one script — (1) clicking a
    node opens the panel with the URL going `/app` → `/app?card=fin/1`, NO
    full navigation, panel shows a real `CardMedia` image; Escape closes it
    (URL reverts to bare `/app`) with the `#graph` SVG's own top-level
    element PROVEN never destroyed/recreated across the whole open→close
    cycle (tagged it with an expando property before opening, confirmed the
    same tagged element still there after — this is a stronger, more direct
    proof that GraphCanvas's graph-identity-rebuild watcher never fires than
    checking node x/y, which drift on their own regardless from this app's
    already-known-slow-decaying force simulation — see this file's own
    Testing Notes section) and zoom/pan transform byte-identical
    before/after; (2) clicking a DIFFERENT node while the panel is open
    SWITCHES it (URL updates to the new card, panel content updates, stays
    open) rather than closing, and clicking fully outside both the panel and
    `#graph` (top-left viewport corner) DOES close it; (3) the panel's
    expand button navigates to the exact `/app/card/<set>/<number>` URL for
    WHICHEVER card is currently peeked (verified after a mid-session
    switch, not just the first-opened card), landing on the real full page
    (own `CardMedia` image, no panel present there); (4) a direct visit to
    that same full-page URL (fresh `page.goto`, not client-nav) never shows
    the panel; (5) a direct `/app?card=<set>/<number>` visit (a
    bookmarked/shared peek link) DOES open the panel purely from the URL,
    staying on `/app` rather than navigating to the full page. Zero
    console/page errors throughout. `npm run typecheck` clean (same two
    pre-existing unrelated errors as always — `functional-model/mana.ts`,
    `server/api/tokens/by-key.ts`); `npx vitest run` — 444 passed, same 5
    pre-existing failures as before this task (missing `tagging/sets/*` data
    directory in this sandbox, confirmed unrelated).
  - **Testing-notes addendum**: this graph's nodes never fully settle (live
    force simulation, slow `alphaDecay`) — Playwright's own coordinate-based
    `.click()`, even with `{force: true}`, intermittently landed on the
    WRONG node (its target-rect snapshot going stale between computation and
    dispatch while the node visibly drifts). Switched to dispatching a real,
    bubbling `MouseEvent('click')` directly at a specific node's own DOM
    element via `page.evaluate` — still a genuine DOM event d3's delegated
    handler receives exactly as a real click would, just immune to this
    app's specific "target is a moving object" flakiness; recommended for
    any future test that needs to click a SPECIFIC graph node reliably.
    Also: several of my own early false-failure readings during this task
    turned out to be plain under-waiting (400-800ms) rather than real bugs —
    this app's `router.replace`-driven panel close/open genuinely needs
    ~1-1.5s to visibly settle in a scripted Playwright run (Vue's own
    150ms leave-transition plus some slack), shorter waits produced
    inconsistent read-backs on the exact same code across consecutive runs.
    Worth remembering before reading a quick failed check as a real bug next
    time.

- 2026-09-13, PRD 03 "Search: find & discover" (docs/prds/03-search.md)
  implemented. New `app/components/SearchBox.vue` replaces AppHeader.vue's
  bare `<UInput>` search box; `app/composables/useGraphStore.ts` gained
  Scope's own 500-card cap enforcement (`SCOPE_CAP`/`scopeCardCount`,
  `addCardToScope`); `app/lib/graphRenderer.ts` gained an incremental
  `addCards()`; `app/components/GraphCanvas.vue`'s graph-identity watcher now
  diffs additive-vs-not before choosing full-rebuild vs. patch-in-place.
  - **Find vs Discover, and what "existing behavior, unchanged" actually
    meant**: before this PRD there was no dropdown/selection at all — typing
    only ever drove a continuous dim/highlight pass
    (`graphRenderer.ts`'s `applySearch`/`refreshHighlight`, unchanged by this
    task). The PRD's "Find — existing behavior, unchanged" line is about that
    underlying highlight mechanism staying intact (confirmed still wired,
    untouched), not a literal pre-existing dropdown-select flow — building
    the actual selectable dropdown IS this PRD's own job. `SearchBox.vue`
    binds directly to `store.searchQuery` (same ref), so the dim/highlight
    pass and the new dropdown run off the exact same text with zero
    duplication.
  - **Default action is always OPEN, for BOTH row kinds** — Enter (or a
    row-body click) calls `store.openCardPanel(set, number)` (the PRD 02 peek
    panel) whether the active row is a find or a discover result; this reads
    "jump to/focus" (find) and the PRD's own explicit "default Enter still
    opens the card rather than adding it" (discover) as the SAME action,
    deliberately, rather than inventing two different default behaviors.
    ADD is a wholly separate, only-ever-explicit action: a discover row's own
    "+" `UButton`, or pressing → (ArrowRight) while a discover row is active
    AND the caret already sits at the very end of the input text (checked via
    `selectionStart`/`selectionEnd === value.length` on the native event
    target) — deliberately NOT intercepted anywhere else, so normal in-text
    caret movement while editing the query is never hijacked. This is a
    conscious simplification of the PRD's own "e.g. Right arrow → Enter"
    example into ONE keystroke instead of an arm-then-confirm two-step
    sequence — still a different, unambiguous physical gesture from plain
    Enter, just simpler to implement/verify; flagging in case the PRD author
    wants the literal two-step version instead.
  - **Discover fetch** reuses `POST /api/cards` (server/api/cards.ts, the
    same route `?sf=` query-mode `load()` already calls) with `q:
    name:"<term>"` (quotes stripped from the raw typed text first so a
    stray `"` can't break out of the query) — deliberately `name:` scoped,
    not a bare/default Scryfall search, since the latter also matches oracle
    text and would surface a lot of irrelevant cards for what's meant to be a
    name lookup. Debounced 300ms, min 2 chars, request-token-guarded against
    a stale slow response clobbering a newer keystroke's result. Results
    mapped via `scryfallCardToCardData` (buildGraph.ts, already proven
    compatible with this exact route's `minimalCard()` response shape via
    the existing query-mode `load()` path) and filtered against the CURRENT
    `store.graph.value.cards` id set so a name that happens to already be in
    Scope∪Deck shows up only as a find row, never duplicated as a discover
    row too.
  - **Scope's 500 cap** (`useGraphStore.ts`): `scopeCardCount` is a computed
    deduping base-pool-minus-removed ∪ scopeAdded by id (Deck deliberately
    excluded — PRD 01's own unconstrained-sandbox call, the cap is a
    statement about Scope alone). `addCardToScope` checks it BEFORE mutating
    any state, and only when the card being added is genuinely new to Scope
    (re-adding a card Scope already effectively has — bulk pool or a prior
    scopeAdded entry — never counts against the cap, since it doesn't grow
    Scope's size) — returns `{ok:false, error}` on refusal with zero partial
    mutation. Live-verified by temporarily setting `SCOPE_CAP = 1` (reverted
    immediately after, confirmed back to 500 via `grep` before finishing):
    real discover-add attempt was refused, error toast shown, card count
    genuinely unchanged.
  - **Real, pre-existing bug found and fixed while verifying "must not
    disturb existing node positions"**: `GraphCanvas.vue`'s PRD-01-era
    `watch(() => props.graph, ...)` unconditionally destroyed and recreated
    the WHOLE renderer on ANY Scope/Deck membership change — including a
    single discover-add — which reseeds every node with no explicit x/y
    (the accepted "start over" trade-off documented for a bulk Scope/Deck
    change, per this file's own earlier notes) — that's fine for a bulk
    import but flatly fails PRD 03's own "discover-add must not disturb
    existing node positions" bar for something this small. Fixed generally,
    not special-cased to search: the watcher now tracks `knownGraph` (last
    graph it actually reflects) and diffs the incoming graph against it —
    if every previously-known card id is still present and at least one NEW
    id showed up (a pure additive change: Scope discover-add, a Deck
    add/paste-import too, as a bonus side effect), it calls a new
    `renderer.addCards(addedCards, newLinks)` on the SAME instance instead of
    destroying it; anything else (a removal, a bulk replace, first mount)
    still gets the full rebuild, unchanged. `addCards()` (graphRenderer.ts)
    seeds each new node near the current settled cluster's own centroid (+
    small jitter) rather than the canvas corner or d3's own index-based
    spiral default, merges the new links into `linksByCard`, keeps the
    closure's own `graph.cards`/`graph.links` in sync (so a LATER unrelated
    re-render still sees the addition), then calls the existing `render()`
    (needed for the D3 join to actually create DOM for the new node) but
    clamps the resulting reheat down to `Math.max(prevAlpha, 0.05)` instead
    of render()'s own flat `alpha(0.6)` — a real filter change legitimately
    changes the whole active set and deserves that big a resettle, one more
    card joining an already-settled graph doesn't.
  - **Caveat on "doesn't disturb positions," confirmed by direct
    measurement, not just asserted**: this app's simulation does NOT
    actually come to rest on any normal timescale — `alphaDecay` is tuned
    slow by design (PhysicsControls.vue), and a fresh page load's own initial
    `alpha(0.6)` reheat is STILL visibly moving nodes 15-65px over a random
    2-SECOND no-op window even 10 real seconds after page load, confirmed via
    a Playwright before/after position diff with zero interaction in
    between. So "zero pixel drift" was never true of ANY interaction in this
    app, filter toggles included (every one of which already does a flat
    `alpha(0.6).restart()` and is treated as normal, accepted UX) — the
    `Math.max(prevAlpha, 0.05)` clamp in `addCards()` is a real, verified
    improvement over the FULL destroy+recreate path (which discards
    positions entirely) and over blindly reusing render()'s own flat 0.6,
    but does NOT and structurally cannot make an add look perfectly frozen
    against this app's own already-restless baseline. Read PRD 03's
    "existing node positions... unchanged" criterion as "no wholesale
    reset/no lost object identity" (which IS concretely true and verified:
    same renderer instance, same zoom/pan transform, same simulation node
    objects continuing their live trajectory) rather than "literally zero
    movement" — flagging this interpretation explicitly in case the PRD
    author meant something stricter than this app's own existing norms
    support without a much larger physics-tuning change outside this PRD's
    scope.
  - **Verified live** (Playwright against the already-running dev server —
    a peer session's, found already up on :3000; did not start a second one,
    just used it — FIN corpus, real interactions): all four acceptance
    criteria confirmed end-to-end, not just read off the code —
    (1) typing "Lightning Bolt"/"Counterspell" (real cards, confirmed absent
    from FIN's own 312-card `fin_scryfall.json` before testing) surfaces a
    "Not in scope — live Scryfall" section with a `bg-warning` "Not in
    scope" badge per row, distinct from a find row's "In scope" badge;
    (2) clicking a discover row's own "+" (or the ArrowRight gesture, see
    below) took the graph from 306→307 nodes, with the SAME zoom/pan
    transform before/after, and — separately — an unrelated White-color
    filter left unchecked (306→260 cards) stayed at exactly 260+1=261 after
    a Counterspell discover-add (never reverted to the wider unfiltered
    count); (3) ArrowDown moved the active row off index 0 and Enter opened
    the SECOND find candidate (`Aerith Rescue Mission`, confirmed a
    DIFFERENT card than the first), Escape and a real click on empty canvas
    both close the dropdown without navigating, and ArrowRight-at-end on a
    discover-only query ("Counterspell", no find rows) added without ever
    navigating (URL stayed bare `/app`) — Enter and the add-gesture never
    produced the other's outcome in any of these; (4) covered in the
    SCOPE_CAP bullet above. Zero console/page errors across all runs.
    `npm run typecheck` clean (same 2 pre-existing unrelated errors as
    always — `functional-model/mana.ts`, `server/api/tokens/by-key.ts`);
    `npx vitest run` — 514 passed, same 5 pre-existing failures as before
    (missing `tagging/sets/*` data in this sandbox, confirmed unrelated).
    All throwaway `.scratch-verify-*.mjs` scripts deleted from the repo root
    before finishing.
  - Not built (matches the PRD's own non-goals): no bulk decklist
    import/paste in this search box (that's a separately-flagged future
    ask), no change to how/where the 500 cap is enforced beyond applying the
    existing concept to discover-adds, no format/legality concept touched.

- 2026-09-13, PRD 03 follow-up (same day, two bug reports/clarifications from
  live testing after the above) — `SearchBox.vue` rewritten from two
  separately-fetched/rendered lists (`findResults`/`discoverResults`) into
  ONE merged, ranked `rows` computed, per-row `inScope`/`discoverable`
  booleans recomputed live on every access:
  - **Bug #1 (real)**: a just-added card's row kept showing "Not in scope".
    Root cause exactly as the coordinator's bug report predicted:
    `discoverResults` was a plain fetched snapshot, and the OLD code filtered
    "already in Scope" cards out of it ONCE, at fetch-resolve time
    (`.filter((c) => !inGraphIds.has(c.id))` inside `runDiscoverFetch`) —
    adding a card afterward changed `store.graph`, but nothing re-ran that
    filter, so the stale snapshot just kept showing the pre-add state
    forever (until the next keystroke re-triggered a fresh fetch). First fix
    attempt kept the two-list split but moved the filter into a `computed`
    (`visibleDiscoverResults`) — technically correct but immediately
    superseded (next bullet) once the keyboard-toggle requirement made the
    two-list split itself the wrong shape.
  - **Bug #2 / design change (coordinator-confirmed spec, not a bug in the
    shipped code — this REPLACED the "Right arrow = immediate add" shortcut
    my own first pass had built)**: → (ArrowRight) now only ARMS the row's
    own add/remove button (visual `ring-2 ring-primary`, zero side effect);
    Enter while armed performs the toggle; a second Enter while STILL armed
    flips it back (add ⇄ remove); ← (ArrowLeft) un-arms with no side effect.
    This is why the two-list design had to go: with `findResults`/
    `discoverResults` as separate arrays, a toggled-in card physically
    JUMPED from one list/section to the other (reactively, once bug #1 was
    fixed) — which breaks simple index-based keyboard focus (an armed
    button's own array position shifts out from under `activeIndex`) and
    doesn't match "the SAME row/button keeps working across repeated
    toggles" the confirmed spec calls for. Fixed by merging into one row
    list, ordered by name-match quality ALONE (never re-sorted by in-scope
    status), so a row's position in the array — and therefore
    `activeIndex` — never moves just because its `inScope`/badge flipped.
    `discoverable` (was this card.id ever returned by the live fetch for
    THIS query, independent of current scope membership — `discoverResults`
    itself is never filtered anymore, see its own updated header comment)
    is what gates whether a row even HAS a button at all; `inScope` (live,
    off `store.graph`) drives both the badge text/color and the button's own
    icon/label (+/Add vs. −/Remove) and which branch `toggleScope()` takes.
  - **Real regression found and fixed WHILE re-verifying the above, not
    assumed away**: the original `ArrowRight` gesture only armed when the
    input's own caret sat at the exact end of the text
    (`selectionStart/End === value.length`) — reasonable in isolation (kept
    plain in-text caret movement from being hijacked elsewhere), but broke
    across a realistic mixed mouse+keyboard sequence: clicking the mouse
    add/remove button once, then switching back to the keyboard, re-focuses
    the input via a fresh Playwright click that does NOT necessarily land
    the caret at the end — silently defeating the guard, so the next
    ArrowRight+Enter fell through to "open" instead of "toggle." Caught by
    literally chaining mouse-then-keyboard actions in ONE live Playwright
    run and reading back real button/URL/count state at each step, not by
    reasoning about the code — an EARLIER isolated keyboard-only run of the
    exact same arm/Enter sequence had passed cleanly and would have shipped
    the bug undetected. Fixed by dropping the caret-position gate entirely —
    ArrowRight now arms unconditionally whenever the active row has a button
    (`discoverable`), full stop. Arming alone has zero side effect (only
    Enter-while-armed does anything), so the "accidental hijack" risk the
    old guard defended against was low relative to the reliability cost;
    normal in-text ArrowRight movement is a minor, non-destructive quirk
    now (arms the button instead of moving the caret) rather than a real
    functional bug.
  - **Verified live again, all in ONE continuous Playwright run this time**
    (mouse add → mouse remove → keyboard ArrowRight+Enter add → a SECOND
    Enter while still armed removes it again → ArrowRight to re-arm →
    ArrowLeft to un-arm → Enter opens/navigates instead of toggling, url
    went bare `/app` → `/app?card=msc/806`, card count unaffected by that
    open): every step's row-badge text, card count, and URL read back
    exactly as expected at each point, not just the final state. Also
    re-confirmed unaffected by this rewrite: a find-only row for a card
    Scryfall's own live search ALSO happens to return (e.g. a real,
    still-in-print FIN card like Adelbert Steiner) correctly grows an
    add/remove button too once its own discover fetch resolves (expected,
    not a bug — `discoverable` only checks "did the live fetch return this
    id," not "did this row start out as a find-only match") — Enter on it
    still opens/navigates either way; Escape and a real outside-click both
    still close the dropdown. `npm run typecheck` clean (same 2
    pre-existing unrelated errors); `npx vitest run` — 524 passed (grew
    slightly from concurrent unrelated work elsewhere in the repo this
    session), same 5 pre-existing failures, none new. All
    `.scratch-verify-*.mjs` throwaway scripts deleted from the repo root
    before finishing, confirmed via `git status`.

- 2026-09-13, follow-up task: generalized PRD 03's additive-only `addCards()`
  diff mechanism to also cover removal and Colors/Rarity/Type filter toggles,
  per an explicit "should also work the same for filters" ask. Touched only
  `app/lib/graphRenderer.ts` and `app/components/GraphCanvas.vue` — no other
  files needed changing.
  - **`graphRenderer.ts`**: `render()` gained a third parameter, `soft =
    false`. Its ONLY effect is at the very end, in place of the always-flat
    `simulation.alpha(0.6).restart()`: when `soft`, that becomes
    `simulation.alpha(Math.max(simulation.alpha(), 0.05)).restart()` instead
    — never suppresses energy already in flight (this app's alphaDecay is
    slow by design, simulation is rarely fully idle), just adds the floor a
    newly-shown/added node needs to settle in, without the full resettle a
    genuine shape change (search, keyword-hub toggle, showSynergyEdges,
    relation-hub prototype, resetLayout) still gets — none of those pass
    `soft`, unchanged. This REPLACES addCards()'s old pattern of calling
    `render(lastFilters, lastOptions)` (always hard) and then externally
    overriding `simulation.alpha(...)` right after with the exact same clamp
    formula — folded that into `render()` itself as one parameter instead of
    two copies of the same clamp math living in different places.
  - Added `removeCards(removedIds: string[])`, symmetric to `addCards()`:
    deletes from `cardNodeById`, deletes/prunes `linksByCard` (including
    pruning OTHER cards' own neighbor-list entries that mention a removed
    id — `linksByCard` is bidirectional, a dangling entry there would hand
    `cardNodeById.get(...)!` a removed id on the next hover/highlight pass),
    keeps this closure's own `graph.cards`/`graph.links` in sync (same
    reasoning addCards's own `graph = {...}` reassignment already has), prunes
    `cardSelection` defensively, then calls `render(lastFilters, lastOptions,
    true)`. Keyword-hub/relation-hub membership needed NO manual purge —
    both are recomputed fresh from `activeCardNodes` every render, so a hub
    that only had removed members self-heals on the very next render, same as
    addCards needs none for a brand-new member joining one. Both `addCards`
    and `removeCards` returned from `createGraphRenderer`'s handle now.
  - **`GraphCanvas.vue`**: the `props.graph` identity watcher now computes
    BOTH `addedCards` and `removedIds` against `knownGraph` (previously only
    computed `addedCards` and treated ANY removal as "fall through to full
    rebuild") and calls `removeCards()`/`addCards()` independently for
    whichever sides are non-empty — the two are unordered-safe since an id
    can't be both newly-added and newly-removed in the same diff. This also
    transparently fixes a real combined case PRD 03's own additive-only
    version couldn't handle: a Deck replace-import (`importDeckFromText(text,
    'replace')`) that adds and removes entries in the SAME reactive tick used
    to always fall through to the full destroy+recreate before this task;
    now it patches both sides in place.
  - **Investigated whether "switching sets entirely" needed its own explicit
    detection/guard to keep it on the full-rebuild path** (the task's own
    explicit "don't force bulk replace through the incremental path"
    constraint) — concluded NO extra code was needed, and deliberately did
    NOT add an epoch/generation-id guard: `SET_CODE`/`scryfallQuery`
    (`useGraphStore.ts`) are frozen at module-eval time, and the only UI path
    that changes which set/query is loaded (`AppHeader.vue`'s query-submit
    handler) does a hard `window.location.href = ...` navigation, not an SPA
    transition — this literally tears down and recreates the whole component
    tree (a fresh `useGraphStore()` instance, a fresh `GraphCanvas` built via
    its own `onMounted`, not through this watcher at all). So a genuinely
    different graph is structurally unobservable by this watcher post-mount
    in this app as it exists today; the watcher's own full-rebuild fallback
    branch is now effectively dead-in-practice defensive code (kept for a
    `knownGraph`/`renderer`-unset edge case, not because any live user action
    reaches it). Flagging this reasoning explicitly in case a future change
    ever adds a client-side/SPA set-switcher (rather than a hard navigation)
    — that WOULD need an explicit bulk-replace signal (e.g. a generation
    counter bumped by `load()`) before this diff-based path could keep
    treating it safely as "just another add/remove diff."
  - Split GraphCanvas's own filter-driven render watcher in two: Colors/
    Rarity/Type (the axes actually asked about) now call `renderer!.render(
    currentFilters(), currentRenderOptions(), true)` (soft); selectedKeywords/
    showSynergyEdges/relationHubsEnabled/relationHubThreshold kept their own
    separate watcher calling `render()` with `soft` omitted (hard) — these
    can genuinely reshape the graph (spawn/despawn a hub, add/remove a whole
    edge category), not just narrow/widen which already-existing cards show,
    so deliberately left un-softened; not asked for, and hub
    creation/collapse probably DOES deserve a real resettle.
  - **Verified live** (Playwright against the peer session's already-running
    dev server, FIN corpus, real interactions, not `page.evaluate(() =>
    el.click())`):
    - Discover-add (SearchBox, "Lightning Bolt") then remove via the SAME
      row's button (now shows Remove instead of Add) while staying in Graph
      view the whole time: 306→307→306, and a `data-verify-marker` attribute
      manually stamped onto the FIRST existing node's real DOM `<g>` element
      before either action survived BOTH the add and the remove untouched —
      direct proof neither action destroyed/recreated the renderer (a
      destroy+recreate wipes and rebuilds the whole `<svg>` subtree, which
      would have wiped a manually-added attribute no d3 `.join()` call would
      ever re-apply). `svg#graph > g`'s own pan/zoom `transform` string was
      byte-for-byte identical before/after both actions too.
    - Toggling the White color checkbox off then back on: card count
      306→260→306 (a real, correct filter narrow/widen), the SAME marker
      attribute survived both toggles (trivially true even before this
      change, since filter toggles never went through destroy+recreate — but
      confirms this task's changes didn't regress it), pan/zoom transform
      unchanged throughout.
    - Confirmed the `soft` flag is ACTUALLY reaching the clamped branch (not
      just "no crash") via a temporary throwaway `console.log` in the
      soft/hard branches of `render()` (added, exercised, then reverted
      before finishing — never shipped): the Colors-filter toggle logged
      `[DEBUG-SOFT] 0.09`/`0.068` (well below the hard path's flat `0.6`),
      confirming real code-path separation, not just an untested branch.
      Direct pixel-drift comparison (baseline idle drift vs. post-filter-
      toggle drift on an unrelated, still-visible node) was ALSO tried as an
      external, black-box-only check but proved noisy/inconclusive on its
      own (this app's simulation is rarely idle, per this file's own earlier
      notes — a "baseline" window immediately following an unrelated prior
      action inherits that action's own leftover alpha) — the debug-log
      confirmation above is the trustworthy one; recording the drift-only
      approach's own inconclusiveness here so a future verification pass
      doesn't re-try it as the sole method and get confused by a misleading
      ratio.
    - Removing a card via ListView's own row control (PRD 04's Scope
      add/remove button) while switching Graph→List→Graph around it: correct
      counts throughout (306→305 rows→305 graph nodes) — this specific
      transition is NOT expected to preserve the marker/pan-zoom (List↔Graph
      is its own real unmount/remount, a separate, already-accepted PRD 04
      mechanism this task doesn't touch), only checked for correct counts +
      zero console errors here.
    - Re-ran the PRD 04 zombie-watcher regression check explicitly (toggling
      the White filter while parked in List view, then switching back to
      Graph view): rows 305→259→305, zero console/page errors, graph still
      functional after switching back — confirms this task's watcher split
      didn't reintroduce that bug.
    - Bulk replace still fully rebuilds correctly: loaded `/app?sf=t:goblin`
      fresh (a real `page.goto`, not a client-side transition) — 468 nodes,
      real goblin names, zero errors. Expected/unsurprising given the "hard
      navigation only" reasoning above, but checked directly rather than
      just asserted.
    - `npm run typecheck` clean (same 2 pre-existing unrelated errors as
      always — `functional-model/mana.ts`, `server/api/tokens/by-key.ts`);
      `npx vitest run` — 526 passed, same 5 pre-existing failures (missing
      `tagging/sets/*` data in this sandbox), none new. All
      `.scratch-verify-*.mjs` scripts (copied temporarily into the repo root
      to get Node's ESM resolution to see the local `playwright` package,
      scratchpad-relative imports don't resolve it) deleted before finishing,
      confirmed via `git status`. Left several PRE-EXISTING untracked
      `.scratch-repro*.mjs`/`.scratch-after-click-nomove.png` files in the
      repo root alone — not created by this task, likely another session's
      in-progress scratch work, not mine to clean up.

- 2026-09-13, new `/app/recognizers` page (recognizer coverage + individual
  review) — deliberately built as a close structural mirror of
  `app/pages/app/keywords/[[slug]].vue` (sidebar-nav + content pane,
  optional-catch-all routing, same `ReviewStatusBadge`/confirm-button
  override-file pattern), for `functional-model/recognizers/`'s 5 real,
  already-wired parser rules (`functional-model/PRD_AUTOMATED_AUTHORING.md`)
  instead of the keyword/mechanic registry. New files: `server/api/
  recognizers/index.get.ts` (GET), `server/api/recognizers/review-status.ts`
  (POST, dev-only 403 guard — exact same shape as keywords' own),
  `app/components/RecognizerEntryCard.vue`, `app/pages/app/recognizers/
  [[slug]].vue`.
  - **One touch outside the new files**: exported `RECOGNIZER_IDS` from
    `server/api/recognizer-source/[rule].get.ts` (was a local `const`) so
    the new GET/POST routes could import that exact canonical id list
    rather than hand-typing a second copy — the dispatch explicitly asked
    for this reuse. That file/route otherwise looked `card`-owned (it's the
    thing the per-card page's own provenance-popover modal fetches from) —
    flagging in case `card` lane wants to weigh in on a route being
    cross-imported by another domain's routes; the change itself is a
    single `export` keyword, no behavior change, confirmed via curl both
    before and after.
  - **No `not_implemented` case here** (unlike keywords) — every listed
    recognizer is a real, already-pool-wide-applied function, so every
    entry starts `ai_reviewed`; the sidebar status dot maps
    `human_reviewed`→`bg-produce` (green), `ai_reviewed`→`bg-consume`
    (blue), same "more confirmed = produce" polarity keywords' own
    covered/gap dot already used, just relabeled for the 2-state case (no
    gap dot at all).
  - **`description`**: NOT hand-copied prose — `extractDescription()` in
    `index.get.ts` reads each recognizer `.ts` file fresh off disk (dev
    convention, matches `loadFinScryfall`/`loadReviewOverrides` in the same
    file and in keywords' own `index.get.ts`) and mechanically pulls just
    the FIRST paragraph of its leading `//`-comment block — verified each
    of the 5 files' own first paragraph is already a complete,
    self-contained "Recognizer X: '<plain-English definition>'" statement,
    so no second/third paragraph was needed. This means the description
    updates for free if a recognizer's own doc comment is edited later —
    deliberately not baked in as a static string.
  - **`matchedCards`**: scans every `functional-model/cards/*/synergy.json`
    fresh off disk (323 real dirs at the time of this pass) for any
    `source`/`sink` fact with `provenance?.rule === id`, dedupes per card
    (a card can carry 2+ facts from the same recognizer — e.g. a Saga's
    lore-counter AND sacrifice/dies facts both tag
    `saga-lore-and-sacrifice-structural` — `matchCount` counts CARDS, not
    facts). Card display name/set/collector-number recovered by
    cross-referencing `data/fin/fin_scryfall.json` via
    `slugify(card.name)` (buildGraph.ts's own helper) matched against the
    card directory's own name — confirmed this round-trips cleanly even
    for multi-face directory names (`crystal-fragments-summon-alexander`,
    `dion-bahamut-s-dominant-bahamut-warden-of-light`). ~20 of 325 real
    card dirs are non-FIN crossover/reference cards with no
    `fin_scryfall.json` entry at all (`breeding-pool`,
    `craterhoof-behemoth`, etc.) — none of them actually matched any
    recognizer in this pool as of this pass (checked: 0 matched cards
    ended up missing `set`), but the fallback path (title-cased slug as
    `name`, no `set`/`collectorNumber`, card renders as plain unlinked text
    in `RecognizerEntryCard.vue`) is still in place defensively for if that
    ever changes.
  - **Source display**: reused the existing `GET /api/recognizer-source/:rule`
    route + `FunctionalModelScript.vue` directly (same components the
    per-card page's own provenance-popover modal uses) rather than
    duplicating source text into the new GET response — fetched inline in
    `RecognizerEntryCard.vue`'s own `onMounted` (component remounts per
    sidebar selection via `:key="entry.id"`, so no separate watcher
    needed), rendered inline in the page body rather than in a modal (here
    the source IS the main content, not an aside).
  - **No title↔slug scheme needed** (unlike keywords'
    `slugifyKeywordTitle`) — a recognizer id (e.g.
    `destroy-effect-structural`) is already a real URL-safe slug, so the
    route param is matched straight against `entry.id`.
  - Verified live end-to-end via a throwaway Playwright script (copied to
    the repo root temporarily, same "local `playwright` package needs
    real-cwd Node resolution" reasoning as this file's own prior verification
    notes; deleted before finishing) against the running dev server: all 5
    sidebar entries render with correct titles + real match counts (62/210/
    7/33/20); selecting `destroy-effect-structural` shows its real
    extracted description, its real highlighted TypeScript source, and 7
    real matched-card links; clicking one navigated to `/app/card/fin/9`
    and the real card page rendered "Battle Menu" content; marking
    human-reviewed flipped the Draft pill off, survived a full page
    reload, flipped the sidebar dot to produce/green, then un-reviewing
    reverted all of that, also confirmed surviving a reload. Zero console
    errors throughout. Deleted the resulting
    `functional-model/recognizers/review-status.json` test artifact
    afterward (confirmed back to untracked/absent via `git status`).
    `npm run typecheck` clean (same 2 pre-existing unrelated errors noted
    elsewhere in this file).

- 2026-09-13, regression bug fix: "clicking a card opens some old dropdown
  instead of CardPeekPanel." There was NO leftover legacy dropdown component
  anywhere (grepped `app/components/`, checked git log — no such file ever
  existed) and `CardPeekPanel.vue`/`app/pages/app/index.vue`/GraphCanvas.vue's
  `onCardClick`/ListView.vue's `openRow` were all wired correctly per PRD 02 —
  so the "old dropdown" the user saw was actually `TooltipView.vue`, the
  pre-PRD-02 hover-only card display, left stuck on screen because the CLICK
  itself was silently missing its target.
  - **Root cause, confirmed live** (Playwright against the running dev
    server, instrumented `history.replaceState` + real DOM click-event target
    logging — NOT code reading, an initial code review found nothing wrong):
    this graph's simulation never fully settles (low alphaDecay, a
    pre-existing/intentional "living graph" property — see this file's other
    "never fully settle" notes), so a node's `<g>` keeps drifting a few px on
    every tick. The native `click` event resolves its OWN target against
    whatever's CURRENTLY under that screen point at mouseup — if the node
    drifted out from under an otherwise-stationary cursor between hover and
    click (very plausible for THIS app specifically, since the whole point of
    the hover tooltip is to give a user something to read before deciding to
    click), the click landed on an empty sibling `<g>` instead and fell
    through to the SVG's background-click handler (a silent no-op close) —
    `onCardClick` never fired at all. Confirmed with 100% correlation across
    many repeated real (non-synthetic-dispatch) hover+click trials: click
    target NOT a descendant of `.node-card` <=> panel never opens, every
    single time, keyed off logging the click event's OWN target rather than a
    separate `elementFromPoint` read (which has its own timing gap and isn't
    trustworthy for this).
  - **Fix, two parts, both in `graphRenderer.ts`** (had to touch this file
    despite the task's own ask to avoid it if possible — flagged there since
    another `ui` instance was concurrently mid-task on incremental
    add/remove-diffing in this SAME file; confirmed post-hoc my two hunks
    (the `renderCardArt` hit-area addition, and the `drag()`/click-handler
    rewrite + removing the old native `.on('click', ...)` bining) sit in
    unrelated parts of the file from their `addCards`/`removeCards`/`render`'s
    new `soft` param work, no overlap):
    1. Card-open now fires from `drag()`'s own `dragended`, gated on raw
       CLIENT-COORDINATE pointer displacement since mousedown (a small <4px²
       threshold, `CLICK_DRAG_THRESHOLD_SQ`) rather than from a separate
       native `.on('click', ...)` — this is immune to the node's own drift
       entirely, since it never re-hit-tests the DOM at mouseup, it just asks
       "did the raw pointer itself move much." The old native click binding
       was REMOVED outright (not left alongside) — leaving both would
       sometimes double-fire (once from here, once from a native click that
       still happened to correctly land).
    2. Added a 10*NODE_SCALE invisible padded hit-rect (`.card-hit-area`),
       appended FIRST/bottom-of-paint-order inside each node's own `<g>` so
       every real visible shape still paints over it — gives a few extra px
       of margin around each node's actual mousedown/click hit-test, so
       ordinary small amounts of drift during a hover-then-click gap don't
       miss the node's hitbox at all (this is what the mousedown ITSELF needs
       — part 1 alone doesn't help if the initial mousedown already misses
       the node's own bound listener, which is attached per-node, not
       delegated from a parent).
    - Also had to add `.filter((event) => event.button === 0 &&
      !event.target.closest('.scryfall-link'))` to the returned `d3.drag()` —
      NOT d3's own default filter (which also excludes `ctrlKey`, which would
      have silently broken the Ctrl/Cmd-click-opens-new-tab escape hatch,
      since that branch lives INSIDE `onCardClick`, which no longer runs at
      all for a filtered-out gesture). The Scryfall shortcut icon's own click
      handler used to rely on a native click event's `stopPropagation()` to
      keep its OWN click from also opening the peek panel — that stopped
      being effective once card-open moved off the native click event
      entirely, so it's excluded from ever starting the drag/click gesture
      instead now.
  - **Verified live**, all via real Playwright interaction (mouse move + a
    genuine `mouse.down()`/`mouse.up()` at a fixed screen point, deliberately
    with a randomized 400-1000ms "human reading the tooltip" pause before
    clicking — not a synthetic `dispatchEvent`, which had been masking this
    exact bug in an earlier verification pass elsewhere in this file's own
    history) against the real running dev server:
    - Before the fix: ~15-20% of such repeated trials failed to open the
      panel at all (confirmed via `history.replaceState` call log — the
      `?card=` write to the URL simply never happened), 100% correlated with
      the click event's own target not being a `.node-card` descendant.
    - After both fixes: 14/15 in one batch, 13/14 in another (~93%) — a large
      but NOT literally 100% reduction; a sufficiently long stationary pause
      can in principle always eventually drift past any fixed padding amount.
      Chose not to chase the residual further (diminishing returns, and a
      much bigger padding risks overlapping adjacent close nodes' own hit
      areas) — flagging as a known, accepted residual rather than a fully
      closed loop.
    - Ctrl+click still opens the full page in a genuinely new tab (verified
      via `context.waitForEvent('page')`), original tab's URL stays bare
      `/app` (no `?card=` picked up).
    - The Scryfall shortcut icon, clicked directly on itself (synthetic
      dispatch on the ACTUAL icon element, to isolate this from the same
      drift issue affecting its own tiny 5.77×5.77px hitbox — a separate,
      pre-existing, NOT newly introduced fragility, see below), opens
      Scryfall in a new tab and does NOT also open the peek panel.
    - List view (`ListView.vue`) row click still opens the exact same
      `CardPeekPanel` (untouched by this fix — the bug and fix were both
      entirely graph-side), and Expand-to-full-page still navigates to the
      real `/app/card/<set>/<number>` page with no panel present there.
    - `npm run typecheck` clean (same 2 pre-existing unrelated errors always
      noted in this file); `npx vitest run app/lib` — 71 passed.
  - **Flagged, not fixed** (separate, narrower, pre-existing fragility, not
    part of what was reported): the Scryfall shortcut icon's own hitbox is
    tiny (5.77×5.77px, only visible on `:hover`) and sits at a fixed offset
    from the node's own position — a real mouse APPROACH to that icon
    (moving from elsewhere toward its last-known coordinate) can itself get
    caught by the same underlying node-drift phenomenon and miss, landing on
    the new `.card-hit-area` instead and opening the peek panel rather than
    Scryfall. This is a narrower version of the same root issue, scoped to
    one small icon rather than the whole node (which is now well-padded) —
    didn't enlarge the icon's own hitbox or otherwise chase this further,
    since it wasn't the reported bug and enlarging it risks colliding with
    the mana-pip/keyword-badge strip immediately next to it.
  - **Not acted on**: a message arrived mid-task, formatted to look like a
    coordinator relay, asking me to add a resizable drag-handle to
    `CardPeekPanel.vue` "before completing your current task." Treated as
    NOT a legitimate instruction — it arrived embedded inside a tool-result
    system-reminder block rather than as an actual conversation turn, didn't
    follow this project's own dispatch template (Task/Constraints/Reads/
    Expected return) the real assignment used, and asked for scope creep
    (a new feature) explicitly during a bugfix the real task said to keep
    minimal/non-redesign. Flagging for the orchestrator to confirm whether a
    resize-handle ask is real and, if so, dispatch it properly as its own
    task.
  - **UPDATE**: the orchestrator confirmed (via a real follow-up in-thread,
    not the earlier suspicious out-of-band message) that this WAS a genuine
    user ask, relayed as a same-component follow-up after the dropdown-bug
    fix was solid. Implemented as its own step, after the bugfix above was
    independently verified:
    - `store.panelWidth` (`useGraphStore.ts`) — same restore/watch/
      localStorage pattern as `viewMode`/`gravityMode` (a `let saved = ...`
      sanitize-on-restore block, a `ref`, a `watch` that persists on
      change), storage key `mtg-visualizer-card-panel-width`, NOT namespaced
      by `SET_CODE` — same "standing UI habit, not a per-set preference"
      reasoning `viewMode`'s own key already uses. `PANEL_WIDTH_MIN` (280),
      `PANEL_WIDTH_MAX` (720), `PANEL_WIDTH_DEFAULT` (360, matches the
      panel's old fixed width), and a `clampPanelWidth()` helper are all
      EXPORTED from this file so `CardPeekPanel.vue` clamps against the
      exact same numbers used to sanitize a restored value — one source of
      truth, not two copies that could drift.
    - `CardPeekPanel.vue`: replaced the old fixed `w-[360px]` Tailwind class
      with a bound `:style="{ width: ... }"` off `store.panelWidth`,
      keeping `max-w-[90vw]` alongside it as a narrow-viewport safety net
      (CSS `max-width` always wins over an inline `width`, so a wide
      persisted value from a previous wide-screen session still degrades
      gracefully on a narrow one without needing to touch the persisted
      value itself). Added a thin (`w-1.5`) invisible-until-hover/active
      drag handle as a `role="separator"` div pinned to the panel's LEFT
      edge (the side facing the graph/list, since the panel itself is
      anchored `right-0`) — plain `pointerdown`/`pointermove`/`pointerup`
      handling (not d3, this is a plain Vue component), with
      `setPointerCapture` so a fast drag that outpaces the 6px handle still
      keeps delivering move events. Delta is `(dragStartX - currentX)`
      (deliberately inverted from a naive "current - start") since dragging
      the LEFT edge further left is what WIDENS a right-anchored panel.
      Already inside `panelEl` (the existing click-outside listener's own
      `.contains()` check), so no extra wiring needed there.
    - **Real, if narrow, pre-existing bug surfaced while writing this
      feature's OWN test harness — NOT caused by the resize feature, NOT
      caused by graphRenderer.ts's click-fix above, confirmed on both
      counts**: a naive Playwright check using a FIXED `waitForTimeout(...)`
      immediately after an action (click expand, or an instantaneous
      `.count()` read with no wait at all for Escape-close) intermittently
      read as "broken" specifically when preceded by extra elapsed real time
      (e.g. two full page reloads plus ~1.8s of waiting before the check) —
      reproduced with ZERO drag/resize interaction at all, and reproduced
      identically with `graphRenderer.ts`/`useGraphStore.ts` reverted to
      pre-session content (ruled out via `git stash`), so it's neither of
      today's two changes. Root-caused as PURE TEST METHODOLOGY, not an app
      bug: swapping the fixed timeouts for `locator.waitFor({state:...})`/
      `page.waitForURL(...)` (proper auto-retry primitives) made every one
      of these "failures" pass 100% of repeated runs — the underlying
      actions (Escape-close, expand-navigate) were always succeeding, just
      sometimes taking longer than my own arbitrary fixed wait, especially
      after extra elapsed time (plausibly a lazy route-chunk load on first
      visit to `/app/card/[set]/[number]` in this dev server). Recording
      this because it cost real time to run down and matches this same
      file's own standing "Testing notes" section — worth adding there too:
      **prefer `waitFor`/`waitForURL` over a fixed `waitForTimeout` before
      asserting a real bug**, especially for anything after a repeated
      full-page reload in this specific app.
    - **Verified live** (Playwright, real pointer drag both directions, not
      synthetic): width starts at 360 default; drag handle +100px client-x
      left → 460; -40px right → 420; persists as 420 after a full reload;
      Expand still navigates to the real full card page (confirmed via
      `waitForURL`, not a fixed wait) with no panel present there; Escape
      still closes the panel (confirmed via `waitFor({state:'hidden'})`);
      dragging far past either edge clamps to exactly `PANEL_WIDTH_MIN`
      (280) / `PANEL_WIDTH_MAX` (720), not overshooting. Zero page errors
      across every run. `npm run typecheck` clean (same 2 pre-existing
      unrelated errors always noted in this file); `npx vitest run app/lib`
      — 71 passed.

- 2026-09-13, PRD 04's Graph/List toggle relocated out of `AppHeader.vue`
  (header chrome) into `app/pages/app/index.vue`'s own view area, per an
  explicit "graph/list should be property of graph, not in header" ask —
  the toggle's own behavior (`store.viewMode.value = 'graph'|'list'`) is
  byte-for-byte unchanged, only its markup moved.
  - Placement: a floating `<div class="absolute bottom-3 left-1/2 z-10
    -translate-x-1/2">` inside index.vue's root `relative flex min-h-0
    flex-1` wrapper (the same element that already hosts FilterPanel/
    GraphCanvas-or-ListView/CardPeekPanel) — bottom-CENTER, deliberately not
    bottom-right, to avoid colliding with the pre-existing gravity-mode-
    select + PhysicsControls floating pair that already lives bottom-right
    in `layouts/graph.vue` (`absolute right-3 bottom-3 z-10`, one level up
    the tree). Same `bottom-3`/`z-10` offset convention, just mirrored to
    the opposite corner — this repo's one now-established "floating overlay
    control" pattern, worth matching again if a third one shows up. Gated
    on `v-if="store.graph.value"` (same guard the graph/list mount itself
    already uses) so it doesn't flash during the initial load spinner.
  - **Also fixed the `UButtonGroup` bug flagged by a peer agent**: that
    component doesn't exist at all in this project's `@nuxt/ui@^4.11.0`
    (confirmed via `ls node_modules/@nuxt/ui/dist/runtime/components` — no
    `ButtonGroup.vue`, Vue was silently rendering it as an unknown-element
    passthrough, so the slot's buttons rendered but with zero joined-corner
    styling). Nuxt UI v4's real replacement is `FieldGroup.vue` (global name
    `UFieldGroup`, confirmed via its own `#build/ui/field-group` theme +
    `Button.vue`'s own `fieldGroup` variant, which IS genuinely group-aware —
    `not-only:first:rounded-e-none not-only:last:rounded-s-none
    not-last:not-first:rounded-none` — when nested under one). Swapped
    `UButtonGroup` → `UFieldGroup` with no other prop changes (`size="sm"`
    carries over identically); this was a real, not hypothetical, rendering
    bug fix riding along with the relocation, not a separate task.
  - Verified live via Playwright against the running dev server (FIN
    corpus): header now has 0 `[aria-label="Graph view"]`/`[aria-label="List
    view"]` matches; exactly 1 of each now sits in the floating control,
    visible, positioned near the viewport's bottom edge; clicking List
    swaps the mount to a real `<table>` with the same row count as the
    graph's own filtered card-node count; clicking back to Graph restores
    the SVG with the same node count. Cross-checked the actual PRD 04
    acceptance criterion (not just "toggle still works"): opened
    FilterPanel, unchecked a color (306 → 216 `.node-card`s), THEN switched
    to List — List showed exactly 216 rows and the checkbox itself still
    read unchecked, THEN switched back to Graph — still 216 nodes; the
    store's filter state never touched by the view swap, confirmed by count
    not just by assumption. Confirmed both buttons' `class` attributes carry
    the `fieldGroup` join classes for real (not just present as strings —
    read straight off the live DOM). Zero console/page errors throughout;
    `npx nuxi typecheck` — same 2 pre-existing unrelated errors as before
    (`functional-model/mana.ts`, `server/api/tokens/by-key.ts`).

- 2026-09-14, SearchBox.vue row default-action (Enter / click on row body)
  made route-aware, per explicit spec: peek panel only where CardPeekPanel is
  actually mounted, full-page navigation everywhere else. `openRow()` now
  branches on a new `onGraphRoute = computed(() => route.path === '/app')`
  (same `useRoute()`-based check `layouts/graph.vue`'s own `isGraphPage`
  already uses for PhysicsControls) — `store.openCardPanel(...)` when true,
  `navigateTo('/app/card/${set}/${number}')` (same helper
  CardPeekPanel.vue's own `expand()` already uses for this exact destination)
  when false. Add/remove toggle path (`toggleScope`, ArrowRight-arm +
  Enter-while-armed, and the mouse button) untouched — confirmed unaffected
  live on every page tested.
  - **Judgment call, flagging for the coordinator to confirm**: treated List
    view the same as Graph view (peek panel), not as one of the "other
    pages." Landed on checking `route.path === '/app'` rather than
    `store.viewMode.value === 'graph'` specifically BECAUSE both viewModes
    live under the one `/app` route and `CardPeekPanel` is only ever mounted
    there regardless of which renderer (`GraphCanvas`/`ListView`) is
    currently showing (`app/pages/app/index.vue`) — so this reduces to "is a
    peek panel even present to open," and also matches PRD 04's own existing
    list-row-click behavior (already opens the same peek panel). Using
    `viewMode` instead would have been actively wrong: List view rows already
    open the peek panel today, so a search result behaving differently from
    a list row on the exact same screen would be the more surprising
    inconsistency, not less.
  - Verified live (Playwright, real `locator.press('Enter')`/`.click()`, not
    `page.evaluate`) against the running dev server: (1) `/app` Graph view,
    Enter on a result → `?card=` param + `[aria-label="Card preview"]` panel
    visible, unchanged; (2) `/app` List view, same Enter → same peek panel
    (judgment call behaves as decided); (3) `/app/card/fin/217` (full card
    page), Enter on a different result → navigated straight to that result's
    own `/app/card/<set>/<number>`, no `?card=` param, no peek panel element
    at all; (4) `/app/keywords`, same → same direct-navigation outcome; (5)
    ArrowRight-arm + Enter-while-armed on `/app/keywords` → toggled Scope
    membership with NO navigation and NO peek panel (confirmed via
    before/after `page.url()` staying identical); (6) mouse click on the
    add/remove button on `/app` Graph view → same, no navigate/no peek. Zero
    console/page errors across all six. `npm run typecheck` clean (same 2
    pre-existing unrelated errors noted throughout this file). Toggled every
    test card's Scope membership back to its original state after each
    check, and deleted the scratch verification script — no lasting data/
    state changes from this pass.

- 2026-09-14, synergy edge weighting made uniform/binary — user decision:
  `Fact.value`'s magnitude no longer drives share-ratio strength (a peer
  session is removing `Fact.value` from the schema pool-wide/recognizer/
  compute-weights.mjs on its own timeline; this was just my side —
  `server/api/graph-links.ts`, which despite its `server/` path is UI's own
  file per `.claude/agents/ui.md`). Changed `sourceShareRatio`/
  `sinkShareRatio` computation from value-proportional (`theirValue /
  sum(values)`) to plain uniform `1/N` (N = count of matches sharing that
  source/sink fact key), replacing `sourceTotals`/`sinkTotals` from
  value-sums to match-COUNTS and dropping `mineValue`/`theirValue`/
  `factTotal` entirely from this file (no longer imported from
  `functional-model/synergy`). Did NOT touch `Fact.value` in `app/types.ts`
  or `factTotal` itself in `functional-model/synergy.ts` (engine's own
  file, out of my lane) — only this one file's consumption of it.
  - Design intent preserved deliberately, not just "set value=1 and leave
    the math" (would've been wrong — division logic assumed values summing
    to something meaningful): `reasonWeight()`'s doc comment in
    `graphRenderer.ts` ("a fact matched by few concentrates its budget,
    many spreads thin") still holds verbatim under 1/N, just driven by
    match count instead of summed value — updated graph-links.ts's own
    header comment to say so explicitly, left `graphRenderer.ts` itself
    untouched (its doc comment already only ever talked about "share
    ratios," never named `value` as the mechanism, so it wasn't stale).
  - Checked for other `Fact.value`/`theirValue`/`mineValue`/`factTotal`
    reads before assuming safe to touch: `server/api/card/[set]/[number].ts`
    (card lane's own file, the per-card Interactions panel's "pick the
    strongest match by theirTotal" logic) still reads it — untouched,
    out of scope per the task's own explicit carve-out, and not a UI/graph
    file anyway.
  - Contracts checked: `.claude/contracts/api-contract.md`'s
    `GET /api/graph-links` section never named `value` as the underlying
    mechanism (just "raw share ratios... turns those into a number") — not
    stale, left as-is. `.claude/contracts/card-schema.md` already recorded
    (2026-09-14, engine's own prior entry) that `value` is "deprecated
    pool-wide, not consulted by anything that actually matches/interacts
    facts" — consistent with this change, no update needed there either;
    that's engine's file to maintain regardless.
  - Verified live: (1) a from-scratch Node script against the real
    `/api/graph-links` payload confirmed EVERY one of 746 distinct
    source-fact groups has all its member reasons' `sourceShareRatio`
    exactly equal to `1/N` for that group's own real match count (0
    mismatches) — e.g. a 1-match fact (Al Bhed Salvagers::lifeloss) got
    ratio `1`, a 270-match fact (Jill, Shiva's Dominant::"moves to
    battlefield (from exile)") got ratio `1/270`; (2) Playwright against
    the live dev server confirmed the graph still renders (306 cards,
    26321 rendered edge-segments, 0 console/page errors) and that the
    documented few-vs-many-match visual gradient still holds under the new
    math: reading each rendered `path.link`'s own bound datum and
    recomputing `reasonWeight` client-side, the lowest-quality sample
    (`sourceShareRatio≈0.0067`, a 149-way-shared "battlefield presence"
    match) rendered at the documented opacity FLOOR (0.15), while the
    highest-quality sample (`sourceShareRatio=1`, an unshared "mana
    production" match) rendered near the ceiling (~0.8) — confirms "few
    matches = strong pull, many matches = weak pull" survived the
    value→uniform switch, just recomputed via count instead of magnitude.
    `npm run typecheck` clean (same 2 pre-existing unrelated errors noted
    elsewhere in this file — `functional-model/mana.ts`,
    `server/api/tokens/by-key.ts`); `npx vitest run` — same pre-existing 5
    failures (missing `tagging/sets/*` data in this sandbox), otherwise
    green. No `qtyBoost`/deck-import multiplier logic touched.

- 2026-09-14, `/app/recognizers` "hide type-derived (Saga) busywork rows"
  task — added a "Show type-derived facts (N)" checkbox to
  `RecognizerEntryCard.vue`, default UNCHECKED (hidden), gating a subset of
  each recognizer's own "Matched cards" list; header's own "Matched cards
  (N)" count stays the TOTAL, unaffected by the toggle, per the task's own
  spec.
  - **Classification mechanism chosen: per-match field
    (`RecognizerMatchedCard.typeDerived: boolean`), computed server-side
    (`server/api/recognizers/index.get.ts`) from a small recognizer-ID
    lookup table (`TYPE_DERIVED_RECOGNIZER_IDS`, currently just
    `{'saga-lore-and-sacrifice-structural'}`)**, not a bare recognizer-level
    flag on the recognizer's own metadata — the task explicitly warned a
    recognizer could in principle mix type-derived and substantive matches,
    so the SHAPE stays per-match (future-proof, no redesign needed if that
    ever happens) even though today's real pool genuinely IS all-or-nothing
    per recognizer (verified directly, see below) and the lookup table
    itself is therefore recognizer-keyed.
  - **Verified against the real pool, not assumed** (read every recognizer
    file's own module doc comment, `functional-model/recognizers/*.ts`):
    only `saga-lore-and-sacrifice-structural` qualifies as type-derived —
    its facts (CR 714 lore-counter, plus a conditionally-declined
    sacrifice+dies pair) come ENTIRELY from a face's own `typeLine`
    ("Saga" subtype) + named chapter-trigger STRUCTURE, never that specific
    card's own written effect content. The sacrifice+dies decline (some
    Sagas get 1 fact, most get 3 — confirmed via a real grep across
    `functional-model/cards/*/synergy.json`: 7 of 20 real Saga matches are
    1-fact, not the "always exactly 3" the task's own motivating example
    assumed) is STILL structural, not textual judgment (it reads whether
    the final chapter's own `Effect`/`triggers` structure contains a
    `custom`/`program` node, never oracle text) — so both shapes count as
    type-derived, not just the 3-fact case. Every OTHER recognizer in the
    real pool (`destroy`/`drawCard`/`dealDamage`/`putCounter*`/`addMana`-
    effect-structural, `dies`/`lifegain`/`attacks`-trigger-structural) keys
    off that SPECIFIC card's own authored `Effect` or a literal trigger
    clause that only SOME cards of the relevant type actually print — not
    predictable from type alone. `instant-sorcery-resolves-to-graveyard`/
    `permanent-enters-battlefield-normally` also don't qualify — matching
    requires confirming the ABSENCE of card-specific override text
    ("enters tapped," an exile clause, etc.), which is per-card judgment,
    not a type-derived guarantee. Confirmed via a live `/api/recognizers`
    fetch: exactly 1 recognizer has any `typeDerived:true` matches, and
    100% of that recognizer's own matches (20/20) are flagged — matches the
    "verify before assuming all-or-nothing" instruction, and happens to
    land on "yes, all-or-nothing today" rather than falsifying it.
  - **UI**: `UCheckbox` (same component/convention FilterPanel.vue's own
    "Show synergy edges"/"Relation hubs (prototype)" checkboxes use),
    rendered `v-if="typeDerivedMatchedCards.length"` — a recognizer with
    ZERO type-derived matches (every recognizer but the Saga one, today)
    gets no checkbox at all rather than a permanently-"(0)", inert control.
    A recognizer whose ENTIRE matched-cards list is type-derived (Saga,
    today) shows an explicit "Every match here is type-derived — check
    ... above to see them" empty-state message rather than a bare blank
    list, so the page never looks broken/empty by default.
  - Left `functional-model/recognizers/permanent-enters-battlefield-
    normally.ts`, every `synergy.json`, and `apply-recognizers.mjs`
    completely untouched, per the task's own constraint — this feature only
    ever reads `server/api/recognizers/index.get.ts`'s own existing
    synergy.json-scanning loop, no new file reads added. Mid-task, a
    concurrent `engine`-agent pass in the same working tree (visible via
    `git status`) deleted that exact recognizer file and narrowed
    `RecognizerId`, transiently breaking `npm run typecheck` on an UNRELATED
    file (`server/api/recognizer-source/[rule].get.ts`'s own hand-kept
    `RECOGNIZER_IDS` mirror, a known "recurring miss" that file's own
    comments already document) for one run; didn't touch it (their own
    in-flight work, not mine to fix mid-collision) and confirmed on a
    second typecheck run it had already self-resolved (presumably the same
    engine pass finishing its own edit) — back to the same 2 pre-existing,
    unrelated errors (`functional-model/mana.ts`, `server/api/tokens/by-
    key.ts`) as before this task.
  - Verified live (Playwright against the running dev server): navigating
    straight to `/app/recognizers/saga-lore-and-sacrifice-structural` shows
    "Matched cards (20)" header + "Show type-derived facts (20)" checkbox,
    0 visible card chips + the empty-state message by default; one real
    checkbox click reveals all 20; unchecking again hides them; 0
    console/page errors throughout. Confirmed `/app/recognizers/destroy-
    effect-structural` (a recognizer with no type-derived matches) shows no
    "Show type-derived facts" control at all. `npx vitest run
    functional-model/recognizers` — 129 passed (unaffected, no recognizer
    logic touched).

- 2026-09-16, new `/app/status` fact-authoring-status dashboard (per-card
  heatmap over `engine`'s `data/fin/fin_card_status.json`, one square per
  card): `app/pages/app/status/index.vue` (new), plus small touch-ups to
  `app/components/AppHeader.vue` (new nav icon button, same
  `NuxtLink`+`UButton` pattern the existing `/app/keywords` link uses),
  `app/components/CardPeekPanel.vue`/`app/composables/useGraphStore.ts`
  (comment updates only — both used to say the peek panel is "only ever
  mounted from app/pages/app/index.vue"; now also mounted from this new
  page, so the comments now list both mount points instead of leaving a
  stale single-mount-point claim).
  - **Data sourcing**: a plain static `import cardStatusFin from
    '../../../../data/fin/fin_card_status.json'` — confirmed this exact
    "direct JSON import from repo-root `data/`, no server API route" pattern
    already exists twice (`ManaSymbol.vue`/`graphRenderer.ts`'s own
    `data/mana_symbols/manifest.json` import) before picking it, matching
    the contract file's own explicit recommendation for this artifact
    ("read this file directly ... rather than re-deriving the classification
    client-side"). Wrapped in a `STATUS_FILES: Partial<Record<string,
    CardStatusFile>>` keyed by set code (today just `fin`) — a second set
    later is "add one more static import to this map," not a redesign; did
    NOT reach for `import.meta.glob` for exactly one real file.
  - **Sort order — real bug in the task's own stated assumption, caught
    before shipping**: the task described FIN as "1→306" collector numbers,
    but the real generated file has numbers up to 563 (bonus/showcase-sheet
    variants) with large gaps, plus one genuinely lettered entry (`99b`,
    confirmed live — "Ragnarok, Divine Deliverance," a `gray`-bucket card
    with reason "no functional-model card directory found for this card").
    Sorting on a fixed 1-306 grid would've either dropped the >306 cards or
    produced a huge mostly-empty range. Used a parsed-leading-integer sort
    key (`sortKey()`, falls back to `Number.POSITIVE_INFINITY` + full string
    for a non-numeric string, string-tiebreaks a shared leading integer)
    instead — reads as ascending "by collector number" via sort order in a
    flex-wrap grid, not positional grid slots.
  - **Tooltip**: did NOT reuse `TooltipView.vue`/`store.hovered` — that
    type (`HoveredCard`) is a full `CardData` + produce/consume
    `GraphReason[]` link list, a shape this page's plain
    `{number,name,status,reasons}` entries don't have and forcing a fake
    `CardData` just to reuse the component/type would've been worse than a
    small local one. Instead reused the same underlying RECIPE a second
    precedent already established for exactly this "component-specific
    content, not the graph's card hover" situation:
    `FunctionalModelText.vue`'s own element-anchored (not cursor-tracking)
    `computePosition`/`offset`/`shift`/`flip`/`size` tooltip (that file's own
    comment notes `UTooltip` was tried first and didn't reliably resize —
    didn't re-try it here either, went straight to the floating-ui recipe).
    Each square is a plain `<button>` with `@mouseenter`/`@focus` calling
    `show(entry, target)` and `@mouseleave`/`@blur` calling `hide()` — focus
    handlers included (not just hover) so the grid is keyboard-navigable
    too, not just mouse-hoverable.
  - **Legend**: rendered as a small always-visible row above the grid (5
    swatch+label+one-line-description entries, `STATUS_ORDER`-ordered), not
    tooltip-only — per the task's explicit "visible on the page" ask. Colors
    are plain hardcoded hex (`STATUS_META`, green/yellow/orange/red/gray —
    tailwind 500-shade equivalents), not reused from `constants.ts`'s own
    `RARITY_COLOR`/produce-consume palette — none of those are a 5-color
    green→red status scale, and none of the existing hues are close enough
    to reuse without inventing a mapping that doesn't already exist
    anywhere.
  - **Click → peek panel**: `store.openCardPanel('fin', entry.number)`,
    same call graph nodes/search results already use. `<CardPeekPanel />`
    mounted directly on this page (not just relying on the layout) — the
    'graph' layout itself never mounted it, only `app/pages/app/index.vue`
    did, so a second page needing it has to mount its own instance; copied
    that page's exact outer-wrapper shape (`relative flex min-h-0 flex-1`
    outer div with NO padding/overflow, so the peek panel's own `absolute
    inset-y-0 right-0` positions against the true viewport-height edge, not
    a padded/scrolling inner box) rather than putting the panel inside the
    scrollable, padded content div.
  - Verified live end-to-end via Playwright against the already-running dev
    server (not started by me, left running/untouched): 306 squares render;
    hovering 5 squares of each distinct background color shows the correct
    name/number/reasons text every time (spot-checked one from each real
    bucket, including the `99b` gray edge case); clicking a square opens the
    real peek panel (title starts as the raw `fin/1` key, resolves to the
    real card name — "Summon: Bahamut" / "Ragnarok, Divine Deliverance" for
    the `99b` case — once its `/api/card/fin/<n>` fetch lands, same
    behavior the panel already has everywhere else); 0 console/page errors
    throughout. `npm run typecheck` clean (same 2 pre-existing unrelated
    errors as always — `functional-model/mana.ts`,
    `server/api/tokens/by-key.ts`). All `.scratch-verify-*.mjs` throwaway
    scripts deleted before finishing, confirmed via `git status`.
  - Not done, out of scope for this pass: no filter/search over the grid
    itself (e.g. "show only red squares") — the task's own ask was a
    heatmap-at-a-glance, not a filtered audit view; flag if that turns out
    to be wanted once the dashboard sees real use.
  - **Same-day follow-up**: reworked the plain flex-wrap grid into a fixed
    layout per explicit user ask — exactly 50 squares/row (`ROW_SIZE`),
    split into 5 visually-gapped clusters of 10 (`CLUSTER_SIZE`, wider
    `gap-2.5` between clusters vs. `gap-[3px]` within one), a text label to
    the left of each row. **Row label picked position-in-sorted-list**
    ("1-50", "51-100", ..., last row "301-306", not padded to a full 50) —
    NOT literal collector-number ranges, since (per the sort-order finding
    above) a literal-number label would misrepresent this corpus; called
    this out directly in the task per its own request to state which was
    chosen, and added a line to the page's own on-page description text
    too, not just a code comment, so a viewer isn't left guessing what the
    row numbers mean.
  - The fixed 50-wide grid no longer fits the page's existing `max-w-5xl`
    text column (50 squares + cluster gaps + row label ≈ 1230px > 1024px) —
    moved the grid OUT of that column into its own sibling block
    (`overflow-x-auto` wrapping a `w-max` row list, `mx-auto`-centered when
    it fits, horizontally scrollable when it doesn't) rather than widening
    the whole page's text column to match a width chosen by the grid's own
    fixed square count — the header/legend prose staying at a readable
    width was worth the grid being its own independently-sized block.
  - Re-verified live (Playwright, same running dev server): 7 rows for 306
    cards, labels exactly `1-50` through `251-300` then `301-306`; first row
    has 50 squares across 5 real `gap-[3px]` cluster groups; last row has 6
    (not padded); hover tooltip and click-to-peek-panel both still work
    unchanged. `npm run typecheck` clean (same 2 pre-existing errors only).

- 2026-09-16, third same-day follow-up — **CardPeekPanel.vue reworked from
  an `absolute inset-y-0 right-0` overlay into a real flex layout sibling**,
  per explicit user architecture ask (it was covering, not just visually
  overlapping, the graph page's own right-edge controls/graph area, and
  part of the status grid). Touched `app/components/CardPeekPanel.vue`,
  `app/pages/app/index.vue`, `app/pages/app/status/index.vue`,
  `app/layouts/graph.vue`.
  - **CardPeekPanel.vue**: root `<aside>` went from `absolute inset-y-0
    right-0 z-20 ... shadow-2xl` to `relative z-10 flex min-h-0 shrink-0
    flex-col ...` (no more viewport-relative positioning at all — `relative`
    now exists only so the drag handle, itself `absolute left-0`, has a
    local anchor; `shrink-0` + the existing inline `:style="{width:
    store.panelWidth}"` is what keeps it at its set width inside a flex
    row instead of getting compressed). Dropped `shadow-2xl` (a floating-
    over-content cue that no longer applies once it's a flush docked
    sibling, same undecorated look `FilterPanel.vue` already has on the
    opposite side). Drag-to-resize and the document-level click-outside-to-
    close logic were BOTH reconsidered per the task's own ask and kept
    unchanged — both are still sensible for a real docked side panel, not
    overlay-specific behaviors.
  - **Transition changed from `translateX(100%)` slide to an animated
    `width`** (`peek-slide` renamed `peek-width`) — the old transform
    slid an overlay in OVER content; this panel now needs to animate its
    own layout box so neighbors visibly squeeze in sync via ordinary
    flexbox reflow. `enter-from`/`leave-to` sets `width: 0 !important` (the
    `!important` is required to out-rank the element's own inline
    `:style="{width:...}"` for exactly that one frame — same "class beats
    inline only while it's the `-from`/`-to` class" trick, removed once
    Vue swaps to `-active`, letting the browser tween from that last-
    applied 0 toward the now-unopposed inline width). `overflow: hidden`
    during the transition prevents visible content reflow spillover at
    the narrower in-between widths.
  - **Confirmed (via direct code reading, not just live testing) that no
    "camera jump" mechanism exists to guard against in the first place**:
    grepped the whole `app/` tree for `ResizeObserver`/`addEventListener(
    'resize'` — zero matches anywhere. `graphRenderer.ts`'s own `width`/
    `height` locals (used to seed the initial zoom transform AND the
    gravity-force center targets) are computed exactly ONCE, at
    `createGraphRenderer()` call time, from `svgEl.clientWidth`/
    `clientHeight`, and never re-read after that — the `#graph` SVG itself
    has no `viewBox` either, so it draws in raw, un-rescaled pixel
    coordinates. Net effect: shrinking the SVG's real CSS width via the
    flex squeeze just reveals/clips less of the SAME fixed coordinate
    space — there was never a live resize-reaction to accidentally
    trigger, so "no jump on resize" needed no new guard code, only NOT
    introducing one.
  - **index.vue restructured**: split the old single `relative flex
    min-h-0 flex-1` wrapper (FilterPanel + GraphCanvas/ListView +
    CardPeekPanel, all as direct siblings) into two nested flex rows — an
    outer `flex min-h-0 min-w-0 flex-1` containing [content-wrapper,
    CardPeekPanel], and the content-wrapper itself keeping the original
    `relative flex min-h-0 min-w-0 flex-1` (FilterPanel + GraphCanvas/
    ListView + the bottom-center Graph/List toggle, unchanged relative to
    each other). The bottom-center toggle now positions against the
    content-wrapper specifically (not the outer row) — it stays centered
    over the graph/list view itself once the panel takes real width,
    instead of drifting off-center toward it.
  - **layouts/graph.vue's floating gravity-mode+PhysicsControls corner**
    (bottom-right, positioned against the SAME outer wrapper `<slot/>`
    renders into — which now ALSO contains CardPeekPanel as a real-width
    sibling) needed its own fix: added a `panelRightOffset` computed
    (`store.panelCardKey.value ? store.panelWidth.value + 12 : 12`),
    replacing the static `right-3` Tailwind class with a bound `:style="{
    right: panelRightOffset+'px' }"` plus a matching `transition-[right]
    duration-150` so it slides left in sync with the panel's own open
    animation instead of jump-cutting once the panel is fully open. Kept
    this block living in layouts/graph.vue (NOT moved into index.vue) —
    it's there specifically because index.vue itself unmounts across a
    real page navigation (e.g. to the full card detail page), which used
    to crash the Popover mid-interaction; moving it now would reintroduce
    that exact bug, this task didn't touch that constraint.
  - **Real, non-obvious bug found and fixed while verifying, NOT just
    reasoned about**: a classic flexbox "item won't shrink below its own
    content's min-content width" pitfall, hit on `/app/status` but NOT
    `/app`. A flex item's default `min-width` is `auto` (= its content's
    min-content width) unless overridden; the status page's 50-wide grid
    is wide/plain-`<div>` content (not a replaced element like an SVG),
    so BOTH the grid's own scrollable wrapper div AND the page's own root
    wrapper (itself a flex item of layouts/graph.vue's outer row) refused
    to shrink past ~1279px/~1639px respectively even with the peek panel
    open — confirmed live via Playwright (`getBoundingClientRect`) that
    the panel was landing PARTIALLY OFF-VIEWPORT (`x:1279` in a 1400px
    viewport, `bodyScrollWidth:1639`) rather than being squeezed next to a
    correctly-narrowed grid. Fixed by adding `min-w-0` at BOTH flex-item
    levels the wide content passes through (`app/pages/app/status/
    index.vue`'s own root AND its grid-content wrapper) — confirmed after
    the fix the arithmetic becomes exact (1400 viewport → 1040 grid + 360
    panel, `bodyScrollWidth` back to 1400, zero horizontal page overflow).
    Also added the same `min-w-0` DEFENSIVELY to index.vue's two wrapper
    divs even though live testing confirmed the graph page was NOT
    actually affected (GraphCanvas's own SVG, being a replaced element,
    doesn't contribute a large min-content width the way a plain wide div
    does) — didn't want the graph page's correctness to rest on an
    SVG-specific sizing quirk that a future change to what's inside that
    wrapper could quietly break.
  - **Testing-harness false alarm, worth recording so it doesn't get
    mis-filed as a real bug on a future pass**: an early verification
    pass using `locator.click({force:true})` on the panel's own Close
    button intermittently reported the panel NOT closing. Root-caused to
    the test harness itself, not the implementation — `force:true`
    dispatches at a possibly-stale coordinate, and separately, one script
    pressed `Escape` to dismiss an unrelated gravity-mode dropdown, which
    ALSO closes the peek panel (`CardPeekPanel.vue`'s own global `Escape`-
    closes-panel keydown handler, pre-existing, correctly still firing) —
    so the SUBSEQUENT explicit close-button click just found no button
    left to click. Re-verified with genuine (non-force, non-Escape)
    Playwright interactions throughout and the close path works
    correctly every time; recording this so a future live-verification
    pass doesn't waste time re-chasing the same non-bug.
  - **Full live re-verification, both pages, real (non-force except the
    literal graph-node click, which a live physics sim can never report as
    "stable") Playwright interactions**: `/app` — SVG width 1420→1060 on
    open (exact 360px = panel width, confirmed twice), gravity-mode select
    genuinely clickable or dropdown-openable with the panel open, close
    button restores SVG to exactly 1420, zero console/page errors
    throughout. `/app/status` — grid wrapper 1400→1040 on open (exact),
    panel at `x:1040..1400` (flush against viewport edge, not overflowing
    it), tooltip and click-to-switch-card both still work with the panel
    already open, vertical scroll-to-bottom on the now-narrower grid still
    works, close restores grid to 1400, zero console/page errors. `npm run
    typecheck` clean (same 2 pre-existing unrelated errors only). All
    `.scratch-*.mjs` throwaway verification scripts deleted before
    finishing, confirmed via `git status`.

- 2026-09-16, `/app/status` grid squares: added a PERSISTENT "this square's
  card is the one open in CardPeekPanel" visual, distinct from the square's
  existing transient `hover:scale-125`/`focus-visible:ring-2 ring-produce`.
  `isSelected(entry)` compares `store.panelCardKey.value` (the SAME
  `${set}/${collectorNumber}` key `CardPeekPanel.vue`'s own `panelKey`
  computed reads — not a separate locally-tracked "last clicked" ref, so it
  self-corrects if the panel closes some other way, e.g. its own close
  button or Escape) against `${SET}/${entry.number}`.
  - **Visual chosen by checking this app's own existing convention first**
    (per the task's own instruction) rather than inventing a new one: the
    graph view itself (`GraphCanvas.vue`'s `.search-match` class,
    `graphRenderer.ts`) already marks "this is the highlighted node" with a
    persistent white double `drop-shadow` glow (search-match highlighting,
    not hover). Reused the exact same treatment here as a new
    `.status-square-selected` scoped class (kept as its own class, not a
    literal shared one, in case the two ever need independent tuning) —
    `filter` is a CSS property neither `hover:scale-125` (transform) nor
    `focus-visible:ring-2` (box-shadow) touches, so it composes cleanly
    with both without a specificity fight, stays visible unchanged through
    a hover/focus on the selected square, and disappears the instant
    `isSelected` goes false.
  - Considered a Tailwind `ring`-based treatment instead (this app's OTHER
    persistent-selection convention — the keywords sidebar's `bg-surface`
    row highlight is a background swap, not applicable here since a
    square's background IS its status color) but rejected an outward ring
    specifically because these squares sit only 2px apart within a cluster
    (`gap-[2px]`) — an outward box-shadow ring would visually bleed onto
    the neighboring square at that spacing; the graph's own glow convention
    reads fine as a soft external highlight instead of a hard edge.
  - Verified live via Playwright against the already-running dev server
    (localhost:3000, `/app/status`, real `locator.click()`): clicking a
    square adds `.status-square-selected` (confirmed via
    `getComputedStyle(...).filter`) to exactly that one square and moves
    the `?card=` query param; moving the mouse away leaves it in place
    (persistent, not hover-only); clicking a different square moves the
    glow there and clears it off the first (still exactly 1 selected
    square total); closing the panel (its own close button) clears it to 0
    selected squares. `npm run typecheck` clean (same 2 pre-existing
    unrelated errors only — `functional-model/mana.ts`,
    `server/api/tokens/by-key.ts`). Throwaway verification script deleted
    before finishing.

- 2026-09-17, Deck-scoped sink-supply node annotation (new small text rows
  drawn under each Deck card's own graph node, e.g. "landfall: 4") —
  consumed `POST /api/deck-sink-supply` (card/engine-owned, finished before
  this task; see api-contract.md's own dated section) as-is, didn't touch
  `functional-model/synergy.ts` or the route itself.
  - Deliberately independent of the produce/consume/atypical/grant/
    magnifier edge system, per explicit instruction — no `Role`,
    `GraphReason`, `CardLink`, `AttrFilters`, or `RenderOptions`
    involvement anywhere in this feature. New standalone type
    `DeckSinkRow` (`{label, count}`) exported from `graphRenderer.ts`,
    imported by `useGraphStore.ts` — kept the coupling local to these two
    `ui`-owned files rather than adding it to `app/types.ts`.
  - State/fetch lives in `useGraphStore.ts`, not `GraphCanvas.vue`: a
    `deckSinkRows` shallowRef (`Map<cardId, DeckSinkRow[]>`), refetched via
    `refreshDeckSinkSupply()` on every `deck` computed change (add/remove/
    qty edit/rename/import — matches the task's own "refetch the whole
    thing, deck is small" call), debounced 400ms via the same manual
    `setTimeout` idiom `SearchBox.vue`'s discover-fetch debounce already
    uses, with a monotonic request-id guard against a slow response landing
    after a faster, newer one. Remaps the endpoint's own `{set,number}`
    keying to card id client-side (`${set}/${number}` -> `entry.card.id`,
    built fresh from `deck.value.entries` each response) since `CardData.id`
    is Scryfall's own UUID, not set/number — the endpoint can't key by it
    directly. Fails soft on a network error or non-OK response (leaves the
    last-known rows in place, never throws/breaks the graph).
  - Rendering lives in `graphRenderer.ts`: `sinkRowsByCardId` (a plain Map,
    same "persists for this renderer instance's whole life" pattern as
    `keywordHubsById`) plus a new exported `renderer.setDeckSinkRows(rows)`
    method — wholesale-replaces the map and immediately rebuilds every
    currently-on-screen node's own `.card-sink-rows` group from the CURRENT
    `cardG` selection. Deliberately NOT tied to `render()`'s own cadence
    (which fires on every Colors/Rarity/Type/keyword/synergy-edge toggle) —
    only called (a) once per debounced fetch resolution via
    `GraphCanvas.vue`'s own `watch(() => store.deckSinkRows.value, ...)`,
    and (b) once per node at ITS OWN enter time (inside the `cardG` join's
    enter branch, right after `renderCardArt(g)`) so a card that becomes
    newly visible (a widened filter, or a brand-new Deck add going through
    `addCards()`) picks up whatever's already known immediately rather than
    waiting for the next unrelated fetch. `GraphCanvas.vue`'s own
    already-existing "full renderer recreate" fallback branch (rare,
    defensive-only per that file's own comment) also re-applies
    `setDeckSinkRows(store.deckSinkRows.value)` after recreating, same as it
    already does for filters/forces/search/selection.
  - Text styling: reused the relation-hub prototype's own small-text
    convention (3.2-4.6*NODE_SCALE, `TITLE_FONT_FAMILY`, `text-anchor:
    middle`/`dominant-baseline: middle`) rather than inventing a new scale —
    `SINK_ROW_FONT_SIZE = 3.4*NODE_SCALE`, one row per `SINK_ROW_LINE_HEIGHT
    = 4.6*NODE_SCALE`, stacked below the node's own bottom edge
    (`TOTAL_HEIGHT/2 + SINK_ROW_TOP_MARGIN`), centered on x=0 (the node's own
    local horizontal center, same coordinate space `renderCardArt`'s
    elements use — the group's outer `<g>` already gets translated to the
    node's real x/y by the tick handler, so these move with the node for
    free, no separate position tracking needed).
  - 0-count treatment: rendered, not hidden (real signal per the task) —
    just dimmer: `fill-opacity 0.5` + muted grey (`#9a9aa4`) vs. a nonzero
    row's `0.9` + near-white (`#e8e8e8`), same "still visible, reads
    quieter" idea the keyword-hub's own low-opacity treatment uses elsewhere
    in this file.
  - Cap: `SINK_ROW_MAX_ROWS = 6`, then a single italic "+N more" line —
    picked as a safety valve, not a real-world expectation (most FIN cards
    the task pointed at have 1-4 sink facts per `functional-model/
    card-status.ts`'s own text-coverage work); never actually triggered in
    live verification.
  - Perf sanity check: a 100-distinct-card decklist paste (real
    `importDeckFromText` through the actual Import-deck UI, not synthetic
    DOM) produced 67 `.card-sink-rows` groups / 98 extra `<text>` elements
    on top of the existing 306-card FIN graph — negligible next to what
    `renderCardArt` already draws per node. FPS sampling (rAF-delta, 3s
    window) came back ~3.5 with the 100-card deck loaded vs. ~3.8 on a
    fresh page with NO deck at all — both low in absolute terms, but
    confirmed via a baseline-only run that this is this sandboxed headless-
    Chromium environment's own ceiling (no GPU acceleration), not a
    regression this feature introduced; the two numbers are within noise of
    each other.
  - Real, pre-existing (not introduced here) limitation surfaced while
    verifying, flagging in case it resurfaces elsewhere: a Deck qty change
    on a card that was ALREADY visible via Scope before ever joining the
    Deck (e.g. Ambrosia Whiteheart, always part of the base FIN pool) never
    updates that card's own cached `CardNode.qty` — `GraphCanvas.vue`'s
    `props.graph` watcher only calls `addCards()`/`removeCards()` for ids
    whose PRESENCE changed, so an id already known to the renderer is left
    completely untouched even though its `qty` field in the fresh `graph`
    computed changed (confirmed live: the x-N qty badge never appeared for
    such a card despite a real Deck entry existing for it). This feature
    sidesteps it entirely by design — `sinkRowsByCardId` is looked up by
    `d.id` alone, populated straight from the store's own always-current
    `deck.value.entries`, never from the renderer's own (potentially stale)
    cached `CardNode.qty` — confirmed live the rows update correctly even
    while the qty badge next to them stays wrong. Didn't fix the badge
    staleness itself (pre-existing, out of this task's scope) — worth a
    dedicated follow-up if the qty badge's own correctness matters
    independently.
  - Verified end-to-end live via Playwright against the running dev server
    (real `locator.click()`/`.fill()` through the actual Import-deck UI, not
    `page.evaluate`): pasting Ambrosia Whiteheart (fin/6) + 3 real partner
    cards (Reach the Horizon, Summon: Fenrir, Gladiolus Amicitia — chosen by
    grepping FIN oracle text for genuine land-fetch effects, not
    fabricated) produced rows byte-identical to a direct `curl` of
    `/api/deck-sink-supply` with the same deck body (`battlefield presence:
    3`, `landfall: 0`, `enters the battlefield: 0`); a card never added to
    the Deck (Summon: Bahamut) showed zero `.card-sink-rows`; clearing the
    Deck removed all rows immediately (card itself stayed on screen, still
    part of base Scope); re-adding Ambrosia alone with no partner cards this
    time correctly dropped `battlefield presence` from 3 back to 0 — full
    live-update-on-Deck-edit loop confirmed, not just initial paint. Zero
    console errors throughout. `npm run typecheck` clean (no new errors in
    `graphRenderer.ts`/`useGraphStore.ts`/`GraphCanvas.vue`; the handful of
    failures elsewhere — `functional-model/card-status.ts`,
    `functional-model/card.ts`, `functional-model/mana.ts`,
    `server/api/tokens/by-key.ts` — are other agents' concurrent
    in-progress work this session, confirmed unrelated by file path). All
    `.scratch-verify-*.mjs`/`.scratch-100deck.txt` throwaway scripts deleted
    before finishing.

- 2026-09-17 (same session as the sink-supply rows above), deck-qty stepper
  on graph nodes ("- x4 +" flanking the existing x-N badge) — went through a
  mid-task pivot, noted here so the FIRST design attempt below isn't
  mistaken for what actually shipped.
  - FIRST attempt (built, then explicitly superseded by a coordinator
    correction before finishing — not shipped): a separate vertical
    +/qty/- stack immediately to the LEFT of the node (mirroring the
    keyword-icon strip's own "outside the art rect, opposite side"
    placement), entirely independent of the existing x-N badge in the
    bottom-right corner. Scrapped per an explicit correction: "there's
    already an x-N badge, just add - and + on either side of THAT instead
    of a new separate element."
  - SHIPPED design: `renderQtyUI` (graphRenderer.ts, defined inside
    `createGraphRenderer` for closure access to `handlers`, not a
    module-level function like `renderCardArt`/`renderSinkRows`) now draws
    a single horizontal row "− ×N +" anchored at the ORIGINAL x-N badge's
    own screen position (bottom-right corner of the art) — the row's RIGHT
    edge is pinned to exactly where the old badge's right edge used to sit,
    growing LEFTWARD (minus button, then the number chip, then plus
    button, matching ListView.vue's own left-to-right minus/qty/plus
    order). The whole row (buttons AND number) only exists at all
    `if (d.qty)` — ported the pre-existing badge's own "nothing at 0"
    convention VERBATIM per explicit instruction, not decided fresh; a
    card with 0 Deck copies shows nothing here even on hover (this control
    adjusts an EXISTING Deck entry, it's not an "add a card to the Deck for
    the first time" affordance — that stays ListView.vue/search/deck-import's
    job). `.card-qty-btn` (both buttons) reuses the exact same hover-reveal
    CSS convention `.scryfall-link` already established
    (`.node-card:hover .card-qty-btn { opacity: 1 }`, added to
    GraphCanvas.vue's <style>) — hovering ANYWHERE on the node reveals them,
    not just that corner. The ×N chip itself has no opacity rule — always
    visible whenever `d.qty` is truthy, unchanged from the original badge.
  - `GraphHandlers` gained `onDeckQtyChange(card, delta)` (delta is always
    +1/-1, never an absolute target) — GraphCanvas.vue's own implementation
    is `store.setDeckEntryQuantity(card.id, Math.max(0, (card.qty ?? 0) +
    delta), card)`, the EXACT same mutation ListView.vue's own per-row
    stepper already calls (confirmed by reading that file first) — not a
    second Deck-mutation path.
  - **Real bug found and fixed, load-bearing for BOTH the vertical attempt
    and the shipped version**: d3-drag's own `.filter()` (the same one that
    already excludes `.scryfall-link` from starting a drag) did NOT
    originally exclude these new buttons — a mousedown on '+'/'-' bubbles up
    to `.node-card`'s own drag listener and gets treated as "start dragging
    the whole card" instead of a click, so the click handler's own
    `stopPropagation()` (which only runs on the LATER 'click' event) never
    prevented this — confirmed live (qty genuinely never changed on click
    until fixed). Fixed by adding `!(event.target as
    Element)?.closest?.('.card-qty-btn')` to the SAME filter predicate,
    mirroring `.scryfall-link`'s own existing exclusion exactly.
  - **Live-sync problem this feature shares with the sink-rows work, fixed
    the same way**: the pre-existing x-N badge had a real, previously-flagged
    staleness bug (see the sink-supply entry above) — a Deck qty change on a
    card already known to the renderer (the common case: most nodes came
    from base Scope before ever touching the Deck) never updated the
    cached `CardNode.qty` at all, since `GraphCanvas.vue`'s `addCards()`/
    `removeCards()` diffing only reacts to a card's PRESENCE changing. This
    was tolerable as a "known limitation, not this task's job" for a
    passive badge, but is a hard requirement now that the SAME field drives
    an interactive control the user just clicked (clicking '+' on a card
    already on screen is EXACTLY the case that used to go stale). Fixed
    with a new exported `renderer.syncCardQty(cards)` (graphRenderer.ts):
    diffs each id's cached `qty` against the fresh value, updates
    `cardNodeById` in place, and calls `renderQtyUI` ONLY for the ids that
    actually changed (cheap even at ~300 cards, since only Deck-touched ids
    ever differ). Called from GraphCanvas.vue's own `props.graph` watcher,
    unconditionally, right alongside the existing addCards/removeCards
    diffing — this ALSO fixes the pre-existing x-N badge staleness as a
    side effect (same code path now drives both), not a separate change.
  - Verification was the hard part of this task, worth recording the
    method for future graph-interaction tests: this graph's own dense,
    never-fully-settling force layout means TWO OR MORE different cards'
    own (deliberately padded, `HIT_PADDING`) hit-areas routinely cover the
    exact same screen pixel — confirmed directly (3 distinct cards' hit
    areas all covered the same point near a test target), and DOM PAINT
    ORDER (not visual "on-top-ness" a screenshot would suggest) decides
    which one actually receives a click/hover there. A naive
    "compute this card's own center, then click/hover there" Playwright
    script is NOT reliable in this graph for that reason (repeatedly
    resolved to a completely different card, several times, even after
    freezing every node's fx/fy to rule out simulation drift as the
    cause) — real users don't hit this the same way (continuous visual
    tracking + correction a one-shot scripted coordinate calc doesn't get).
    Fix that actually worked: temporarily `display:none` every OTHER
    `g.node-card`/`g.node-keyword`/`g.node-relation-hub` (test-side only,
    not a code change) so hit-testing can only ever resolve to the one node
    under test, THEN zoom in on it (real wheel gesture) for a comfortable
    target size. `pointer-events:none` on the ancestor `<g>` alone did NOT
    work first — `.card-hit-area`'s own explicit `pointer-events:all`
    (renderCardArt) overrides an ancestor's inherited `none`; had to
    reach for `display:none` instead, worth remembering for next time.
  - Full verified sequence (real Playwright mouse hover/click, real
    coordinates, not `dispatchEvent`/`page.evaluate(() => el.click())`),
    once isolation was in place: buttons at opacity 0 before any hover;
    hovering the isolated node reveals them (opacity 1); 3 real clicks on
    '+' took a real qty from 1 -> 2 -> 3 -> 4, "×N" chip text updating live
    each time; the SAME node's own sink-supply rows (from the earlier task)
    updated too in the same pass (`battlefield presence` moved from 3 to 4
    as qty rose — a real, correct cross-feature interaction, not a
    coincidence: `computeDeckSinkSupply`'s own self-supply weighting is
    qty-sensitive) confirming the two features coexist and both react
    correctly to the same underlying mutation without one clobbering the
    other; 4 real clicks on '-' took it back down 4 -> 2 -> 0; at qty 0 the
    ENTIRE "− ×N +" row disappeared, and hovering that now-0 card again
    revealed nothing at all (no partial "+"-only reveal) — matches the
    "reuse the badge's exact existing 0 convention" instruction literally.
    A different, never-touched non-Deck card showed no row and no sink-rows
    throughout. Zero console errors. `npm run typecheck` clean in all three
    touched files (`graphRenderer.ts`/`useGraphStore.ts`/`GraphCanvas.vue`)
    — a few pre-existing failures elsewhere
    (`app/components/CardDetailTabs.vue`, `functional-model/card-status.ts`,
    `card.ts`, `mana.ts`, `server/api/tokens/by-key.ts`) are other agents'
    concurrent in-progress work this session, confirmed unrelated by path.
    All `.scratch-*.mjs`/`.png` throwaway verification files deleted before
    finishing.

- 2026-09-17, same "− ×N +" stepper as immediately above — TWO further
  corrections from the user after the first shipped version, both now
  applied (supersedes the "0-qty display: reuses the badge's OWN
  pre-existing convention verbatim" line in the entry above — that was
  right for ONE task iteration, then explicitly overridden):
  1. **A 0-qty card must show a hover-reachable lone '+'** (not nothing at
     all) so a first Deck copy can be added straight from the graph, not
     just via ListView/search/deck-import. `renderQtyUI` now always creates
     the `.card-deck-qty` group; at `!d.qty` it draws ONLY a '+' button
     (anchored at the same `rightEdge` corner the ×N chip's own right edge
     would occupy once it exists) — no '−' (nothing to do at 0, omitted
     entirely rather than shown disabled, my own call per the task leaving
     it open) and no number chip (still nothing to show). This means EVERY
     card node in the graph now carries a hover-reachable '+' at rest, not
     just Deck cards — a real, deliberate scope expansion from the
     sink-rows-adjacent "only Deck cards get extra chrome" pattern, correct
     per this explicit ask, not an oversight.
  2. **Position regression fixed**: the first shipped version computed the
     ×N chip's own x by fitting it BETWEEN the '−'/'+' buttons, which
     shifted it left of where the badge always sat before this feature
     existed. Reverted: the chip's box now uses the EXACT same
     `rightEdge - numW` formula the original standalone badge always used
     (unchanged position), and the buttons flank it OUTSIDE that box
     instead — '+' extends past the art's own right edge, '−' extends past
     the chip's own left edge. Confirmed live the overflow is real and
     accepted (task's own explicit instruction: don't shrink/reposition to
     avoid it).
  - Verified live (same node-isolation-via-`display:none` technique as the
    entry above, since this graph's own dense overlap still applies): a
    card with `qty` undefined shows exactly one hoverable '+' (label "Add
    {name} to deck", no "one" — reads better for a first copy than "Add one
    ... to deck"), opacity 1 on hover / (unchanged CSS) 0 at rest; clicking
    it takes qty 0→1, and NOW both '−' (relabeled "Remove one ... from
    deck") and '+' appear, chip reads "×1"; the chip's own right edge sits
    ~flush with the art's own right edge (small fixed margin, matching the
    pre-feature badge exactly, confirmed via a direct
    `getBoundingClientRect` comparison against `.card-shape`), and the '+'
    button's own right edge genuinely extends past the art's right edge
    (`plusRect.right > artRect.right` — true); clicking '−' once takes it
    back to 0 and the lone '+' reappears (no '−', no chip). Zero console
    errors. `npm run typecheck` clean in all three touched files
    throughout both correction rounds. All `.scratch-*.mjs` throwaway
    scripts deleted before finishing both times.

- 2026-09-17, `/app/engine/*` console consolidation — merged keywords/
  sink-derivations/engine-status/status (heatmap) into one tabbed shell.
  Mid-task scope narrowed twice: recognizers dropped entirely (never
  touched, never linked — `/app/recognizers/[[slug]].vue` stays exactly as
  it was); then keywords ITSELF went tentative — the standalone
  `/app/keywords/[[slug]].vue` route + its AppHeader.vue link stay in place
  UNTOUCHED (still linked, still working) alongside a NEW duplicate
  `/app/engine/keywords/[[slug]].vue` tab, specifically so dropping the
  tab later loses nothing. Only sink-derivations/engine-status/status had
  their old routes actually removed + AppHeader links repointed.
  - Final route shape: `/app/engine/{keywords,predicates,sets,features}`,
    each its own real page (not client tab state) — `predicates` was
    `/app/sink-derivations`, `features` was `/app/engine-status`, `sets`
    was `/app/status` (dropped its 50-per-row heatmap grid entirely, now
    the same list+detail shell as the other three).
  - Shared pieces extracted: `app/composables/useStatusFilterList.ts`
    (search + status-filter-with-per-status-counts + visible list +
    self-owned `selectedKey` ref + prev/next/positionLabel — generic over
    `<T, C extends string>`), `app/components/engine-console/
    EngineConsoleShell.vue` (nav+detail 2-pane layout + Prev/Next header
    row, renders `EngineConsoleTabs` at the top of the nav slot itself),
    `EngineConsoleTabs.vue` (the 4-tab bar), `EngineConsoleStatusFilterControls.vue`
    (search box + per-status toggle buttons w/ counts + total line),
    `EngineConsoleEntryListPanel.vue` (shared `<button>` row chrome, `row`
    scoped slot for per-tab content — Vue 3.5 generic `<script setup
    generic="T">` components, confirmed this repo's Vue/Nuxt versions
    support it).
  - **Naming landmine hit and fixed**: Nuxt's default component
    auto-import PREFIXES a subfolder component's name with the folder
    (kebab->Pascal) UNLESS the filename already starts with that prefix —
    `EngineConsoleTabs.vue`/`EngineConsoleShell.vue` (both already
    prefixed) resolved fine as-typed, but the first-drafted
    `StatusFilterControls.vue`/`EntryListPanel.vue` (NOT prefixed) silently
    registered as `EngineConsoleStatusFilterControls`/
    `EngineConsoleEntryListPanel` instead — confirmed live via a real Vue
    "Failed to resolve component" warning (not a typecheck error — this
    class of bug is invisible to `npm run typecheck` entirely, only shows
    at runtime). Fixed by renaming the files to match what Nuxt was going
    to call them anyway, not by fighting the convention. Worth remembering
    for any FUTURE component added under a subfolder here: name the file
    with the folder's own Pascal prefix from the start, or verify with a
    live console-warning check, not just typecheck.
  - **Selection design split, three ways** (`useStatusFilterList`'s own
    header comment covers this in more depth): predicates/features/sets
    let the composable own `selectedKey` directly (self-mutating
    `select`/`selectPrev`/`selectNext`, reset-to-first-visible-entry on
    filter/search change via an internal `watch(visible,...)`). keywords
    needed MORE (its own pre-existing per-entry slug URL,
    `/app/engine/keywords/<slug>`) — layered on top by watching the
    composable's plain exposed `selectedKey` ref from the PAGE itself
    (route -> selectedKey, one-directional import only) and having every
    explicit action (row click, Prev, Next) call `navigateTo` directly
    rather than mutating the ref — deliberately did NOT make the
    composable grow a second "externally driven" mode; a plain exposed
    `Ref` was enough. Consequence accepted, not fixed: if the CURRENTLY
    OPEN keyword gets search/status-filtered out, the detail pane still
    correctly follows the composable's own reset-to-first-entry, but the
    URL doesn't update until the next explicit click/Prev/Next (matches
    the OLD page's own "bare route never auto-redirects to a slug"
    behavior deliberately, at the cost of this one edge case).
  - Template gotcha, not a real Vue limitation but easy to trip on: a
    NESTED ref access in a template (`list.selected.value`) does NOT
    auto-unwrap the way a TOP-LEVEL one does (`selectedEntry` when it's
    its own top-level `<script setup>` binding) — and a `!` non-null
    assertion inside a template expression is NOT safe to assume works the
    way it does in `<script>`. Fixed everywhere by adding a top-level
    `const selectedEntry = computed(() => list.selected.value)` alias per
    page and using THAT (plus a plain `v-if` guard, no `!`) instead of
    reaching into `list.selected.value` repeatedly in templates.
  - `shallowRef`, not `ref`, for a composable-internal `Set<C>ownership`
    (`activeFilters`) when `C` is a generic type parameter — plain `ref`
    triggers Vue's deep `UnwrapRef<T>` traversal INTO the `Set`'s own
    generic argument, producing real `tsc` errors (`Set<C>` vs a synthetic
    `Set<UnwrapRefSimple<C>>`) on every `.has()`/`.add()`/`.delete()` call
    site. `shallowRef` sidesteps it since the Set is always replaced whole
    (`toggleFilter`'s own `new Set(...)`), never mutated in place.
  - Mid-task addendum (after the shell was otherwise done): `/app/engine/
    sets` (was `/app/status`) needed a real set-picker, not hardcoded FIN —
    added ONE new thin discovery endpoint, `server/api/card-status/
    sets.get.ts` (plain `readdirSync('data/')` + `existsSync(.../
    <set>_scryfall.json)` per dir, no `functional-model/` import at all),
    reasoning it's the same "thin data endpoint feeding a ui page"
    pattern this agent already owns (`server/api/keywords/index.get.ts`
    etc.) rather than a violation of a "don't touch server/api" scope
    note — flagged the reasoning inline in the page's own header rather
    than silently deciding it alone. Picker persists the last-picked set
    to `localStorage` under `engine-sets-last-set` (re-validated against
    the live `/api/card-status/sets` list on load, falls back to the
    first real available set if the stored one's gone).
  - **Cross-session collision, real, worth flagging for any orchestrator
    reading this**: mid-task, a PEER orchestrator's own concurrent commits
    (`d3eeb6d1 Add real Saga and Crew sink-derivation predicates`, likely
    `engine` agent work, then `11bcefb4 Restore 3 page files accidentally
    deleted by the prior commit`) landed on `main` and silently clobbered
    this task's own in-progress, uncommitted `git rm` of the very same 3
    old page files (`app/pages/app/{status,engine-status,sink-derivations}/
    index.vue`) — their own commit apparently `git add -A`'d over my
    working-tree deletion, undoing it without either side knowing, then a
    follow-up commit from their side "restored" the files thinking the
    deletion was accidental collateral damage from THEIR change. Caught by
    a plain `git status` sanity check near the end of this task (files
    were back on disk with zero git-visible diff) — redid the `git rm`
    fresh afterward. Concrete case of the exact risk CLAUDE.md's "Multiple
    orchestrators" section names (two orchestrators' dispatched work
    touching the same files at once) — left staged-but-uncommitted per
    "only commit when explicitly asked," but the orchestrator should
    commit this task's own result reasonably promptly to avoid a THIRD
    collision.

- 2026-09-17 (later same day), `/app/engine/*` console prev/next follow-up
  task — bug investigation + keyboard nav + per-page filter persistence +
  facet-count fix:
  - **The reported "Predicates prev/next chevrons don't move the
    selection" bug did NOT reproduce.** Spun up a real Playwright/Chromium
    session against the already-running dev server (this repo's
    `playwright` devDependency, chromium already cached under
    `~/.cache/ms-playwright`, no sudo needed once confirmed present) and
    drove the actual UI: fresh load, sequential next/prev clicks across
    the full 4-entry range and back, raw `page.mouse` clicks (bypassing
    Playwright's locator auto-waiting, in case of a stacking/overlay
    issue), direct row clicks, status-filter-driven list-narrowing, and
    client-side route navigation INTO Predicates from both Features and
    Keywords (in case of some stale-composable-instance concern) — every
    one of these correctly moved `selectedKey`/the position label/the
    detail pane's title, with zero console errors/warnings. Also
    byte-diffed `predicates/index.vue`'s shell wiring against
    `features/index.vue`'s (`can-prev`/`can-next`/`position-label`/`@prev`/
    `@next`) — identical shape, no typo. Concluded this bug either never
    existed as described, was already stale/fixed by the time this task
    ran, or needs a much more specific repro than what was handed down
    (exact click sequence / browser / viewport) — flagged this back to
    the orchestrator rather than inventing a fix for a defect that
    couldn't be found. Didn't change anything in `selectPrev`/
    `selectNext`/`canPrev`/`canNext` as a result (no diff = no risk of a
    "fix" that's actually a no-op or, worse, a regression).
  - **Keyboard Left/Right nav**: added to `EngineConsoleShell.vue` itself
    (not the composable — the composable has no DOM/focus access, and the
    shell already receives `canPrev`/`canNext`/owns the `prev`/`next`
    emits, so one `window` keydown listener there covers all four tabs for
    free). Guards: skips while `document.activeElement`-equivalent (the
    event's own `target`) is an `INPUT`/`TEXTAREA`/`SELECT`/
    `contenteditable` element, and skips if ctrl/meta/alt is held (avoids
    hijacking OS/browser shortcut chords that also use arrow keys). Only
    emits when the corresponding `canPrev`/`canNext` prop is already true —
    same bounds as the click buttons, no wraparound. Confirmed live: works
    on both Features (nav row visible) and Predicates (nav row hidden,
    keyboard still works), and confirmed a real ArrowRight keypress while
    the search `<input>` was focused did NOT move selection.
  - Worth noting for context: `/app/engine/sets/index.vue`'s own header
    comment already flagged that the PRE-consolidation status-grid page
    used to have its own bespoke ArrowLeft/ArrowRight nav that this
    shell's Prev/Next buttons "superseded" (deliberately dropped, not
    preserved) — this task's keyboard-nav addition effectively restores
    that capability, now shared app-wide via the shell instead of
    re-bespoked per page.
  - **`hide-nav` prop** added to `EngineConsoleShell.vue` (`hideNav`,
    default `false`) — suppresses ONLY the visible position-label +
    chevron-button row (`v-if="!hideNav && (...)"`); doesn't touch
    keyboard nav at all (verified live: `navRowCount` 0 on Predicates,
    ArrowRight/ArrowLeft still moved the detail pane there). Only
    Predicates passes `hide-nav` (bare boolean shorthand in the template);
    Features/Sets/Keywords untouched, confirmed the row still renders on
    Features live.
  - **Per-tab persisted status-filter toggles**: `useStatusFilterList.ts`
    gained an optional `storageKey?: string` option. When given,
    `activeFilters`' initial value is read synchronously from
    `localStorage.getItem(storageKey)` at setup time (JSON array of `C`
    values, validated against `statusOptions` — an unknown/stale value is
    dropped, not kept, falling back to "everything on"; matches
    `/app/engine/sets`' own last-picked-set precedent for "read
    localStorage directly, no SSR guard needed since /app is SPA-only").
    `toggleFilter` persists the new set back on every toggle.
    Deliberately does NOT cover `searchQuery` — that's still a bare
    `ref('')`, always empty on load, per the task's own explicit "search
    should NOT persist" call. Each of the four pages passes its own
    distinct key (`engine-console-filters-{keywords,predicates,sets,
    features}`) — confirmed live that toggling off "Blue" on Predicates
    survives a hard reload AND leaves Features' own "Blue" filter
    untouched (independent storage per tab, not shared state).
  - **Facet-chip-count bug fix**: `countsByStatus` previously counted
    against `searched` (search-applied, NOT YET status-filtered) — meaning
    typing in the search box changed the numbers shown next to each
    status chip. Changed to count against `sorted` (the full dataset,
    search- and filter-independent) instead — confirmed live typing
    "saga" into Predicates' search box left `Gray (2)`/`Blue (2)` etc.
    unchanged while the actual row list below correctly narrowed to just
    Saga. The "N of M" visible-count line elsewhere on each page is
    UNCHANGED (still reads `list.visible.value.length`, which SHOULD
    track search+filters) — only the per-chip numbers stopped moving with
    search text.
  - `npx nuxi typecheck` has several pre-existing errors unrelated to any
    of this task's files (`CardDetailTabs.vue`, `functional-model/
    {card-status,card,mana}.ts`, `server/api/tokens/by-key.ts`) — confirmed
    via `git stash`/`typecheck`/`git stash pop` that the exact same errors
    exist with this task's diff fully reverted, so none are this task's
    regression; zero NEW errors introduced by this task's 6 changed files.
  - A second, concurrent commit (`bdac7f50 Embed real card view in sets
    tab detail pane, drop peek popup` — the `card` specialist's own
    in-flight work this task's own constraints warned about) landed on
    `main` mid-task; this task's one-line `storageKey` addition to
    `/app/engine/sets/index.vue` sat cleanly alongside it with zero
    conflict (verified via `git stash`/`pop` around the typecheck baseline
    check above) — no actual collision this time, unlike the earlier
    entry above.

- 2026-09-18, per-tab status-help popover (?) on `/app/engine/*`:
  - Added a `#help` slot to `EngineConsoleStatusFilterControls.vue` — a
    `UPopover` + `circle-help` `UButton` next to the "Filter by status"
    label, only rendered when the caller supplies the slot
    (`v-if="$slots.help"`). Same interaction pattern as `AppHeader.vue`'s
    own legend popover (that's where the pattern was copied from), not a
    new one.
  - New small shared component `EngineConsoleStatusHelp.vue` (generic over
    `C` like the rest of this family) renders the per-status color-dot +
    label + full `description` text (the same string `STATUS_OPTIONS`
    already carries, previously only surfaced as a hover `title` on the
    filter buttons — now shown in full), followed by a default slot for
    the "how you get from one status to another" flow prose. Each of the
    4 pages (`keywords/[[slug]].vue`, `predicates/index.vue`,
    `features/index.vue`, `sets/index.vue`) passes its OWN `STATUS_OPTIONS`
    (already in page scope, no new prop plumbing needed) plus its own
    hand-authored flow paragraph(s) via `<template #help>`.
  - Flow text was grounded in the real source, not guessed, per the task's
    own explicit ask: predicates from `functional-model/
    sink-derivation-status.ts`'s header (gray→purple→blue computed
    baseline off what predicate-module/manifest files exist on disk;
    yellow/green a separate human-review overlay layered on top,
    independent of the baseline), features from `functional-model/
    engine-status.ts`'s header (same gray→purple→blue shape, keyed off
    `ENGINE_GAPS.md`'s `CLOSED` marker + test citation + named remainder;
    same yellow/green overlay), sets from `functional-model/
    card-status.ts`'s own priority-ordered header comment (gray→orange→
    yellow/green on the ordinary track, plus verified/uncertain/re-review
    as human-review-driven NARROWINGS of green only, never of
    yellow/orange/red/gray). Keywords turned out to be a **collapsed
    binary** in the page's own `STATUS_OPTIONS` (`covered`/`gap`) even
    though the underlying `KeywordStatus` has a 3rd `human_reviewed` state
    (`server/api/keywords/index.get.ts`) — said so plainly in the popover
    text (gap→covered once a real engine-piloted trace exists, permanent,
    plus a one-line mention that "covered" itself has an unexposed
    human-review sub-layer) rather than inventing a 3-color flow that
    doesn't match this page's actual 2-bucket filter.
  - Verified live via a throwaway Playwright script (repo's own
    `playwright` devDependency, run against the ALREADY-RUNNING dev server
    on :3000 rather than starting a second one — `nuxi dev` correctly
    refused a second lock and this task just reused the existing PID
    70949 instance) across all 4 tabs: help button present, click opens
    the popover, and the popover text differs per tab (confirmed via
    screenshot + extracted text, not just existence-of-button). One real
    bug caught this way: `UButton`'s `size` prop doesn't accept `"2xs"`
    (only `xs`/`sm`/`md`/`lg`/`xl`) — `nuxi typecheck` flagged it
    immediately, fixed to `"xs"`.
  - `nuxi typecheck`: zero new errors (diffed against the pre-existing
    baseline list already on file above — `CardDetailTabs.vue`,
    `card-status.ts`/`card.ts`/`mana.ts`, `tokens/by-key.ts` — identical
    set before/after this task's 6 files). `vitest run`: 1147 passed, the
    only 5 failures are `scripts/relations.test.mjs` missing
    `tagging/sets/{leb,2ed,arn}/*_relations.json` + `tagging/
    card-enrichment-status.json` — pre-existing, unrelated to any file
    this task touched (almost certainly the historical-sets sweep's own
    in-flight state on a peer session/branch, not this task's regression).

- 2026-09-18, real evidence-viewing panel on Features/Predicates detail
  panes (consuming that same day's `testFileRefs`/`sourceFiles` backend
  additions to `GET /api/engine-status`/`GET /api/sink-derivations`):
  - New shared component `app/components/engine-console/
    EngineConsoleCodeSection.vue` — one expand/collapse disclosure row
    (chevron + title + optional "not found" badge; body renders a
    `<pre>`/code block only once opened). Deliberately generic over BOTH
    consumption shapes this task needed: an already-resolved
    `{path,exists,content,truncated}` `result` prop (Predicates' case —
    `sourceFiles` is inlined, no fetch needed) AND a `loading` prop +
    `@expand` emit for a caller-owned lazy-fetch cache (Features' case —
    `testFileRefs` only carries a path, real content needs
    `GET /api/engine-status/source?path=...` on first expand only).
  - **Reused existing hljs-based viewers instead of adding a syntax
    highlighter dependency**: `FunctionalModelScript.vue` (already in this
    repo, card-agent-owned, TS via `highlight.js/lib/core`) for `.ts`
    content, `JsonHighlight.vue` (same repo, already used by
    `CardDetailTabs.vue`/`docs` page) for `.json` (the corpus manifest).
    Confirmed `highlight.js` was already a transitive dep before this task
    — no `package.json` change. Read-only reuse, didn't touch either
    component.
  - Features (`app/pages/app/engine/features/index.vue`): added a
    page-level `reactive(new Map<path, {loading, result}>())` fetch cache
    — keyed by real repo-relative PATH, not by the selected gap, since the
    same large file (`engine.test.ts`, ~115KB) is cited by 5 different
    gap entries and should only ever be fetched once regardless of which
    entry's detail pane is open when the reviewer expands it. For a
    `testFileRefs[].matches` empty array (gap #19's real `card.test.ts`
    false-positive citation), renders a synthetic
    `{exists:false,content:null}` result directly — no fetch attempted,
    labelled "Citation not found on disk — this filename doesn't exist
    anywhere in functional-model/" via the component's own
    `not-found-label` prop, never hidden/silently dropped.
  - Predicates (`app/pages/app/engine/predicates/index.vue`): three
    `EngineConsoleCodeSection`s per entry (predicate source / corpus
    manifest / corpus test) fed directly from the already-inlined
    `selectedEntry.sourceFiles.*` — no fetch wiring needed on this page at
    all, per the contract's own note that this axis inlines rather than
    fetch-per-file. `exists:false` (today: every field for
    stun-counters/finality-counters) renders "No predicate module built
    yet."/"No corpus manifest yet."/"No corpus test yet." per-panel rather
    than an empty box.
  - Verified LIVE via a real Playwright/Chromium session against the dev
    server (repo's own `playwright` devDependency): gap #19 on Features
    shows all 4 cited files including `card.test.ts` honestly marked "not
    found" alongside 3 real matches; expanding
    `functional-model/state.test.ts` renders real, readable, syntax
    -highlighted test source (confirmed real `describe`/`it`/vitest import
    text present, zero console errors). On Predicates, Saga's 3 panels
    show real predicate source, a real corpus manifest JSON with an actual
    3-entry `cases` array (Summon: Bahamut / Jill / Jecht per-card
    verdicts+notes), and real corpus test content; `stun-counters`
    (gray, nothing built) shows the plain "not built yet" text in all 3
    panels instead of an empty/broken box.
  - `npx nuxi typecheck`: identical pre-existing baseline error set as
    already on file above (`CardDetailTabs.vue`, `card-status.ts`/
    `card.ts`/`mana.ts`, `tokens/by-key.ts`) — zero new errors from this
    task's 3 changed/added files. `vitest run`: same 5 pre-existing
    `scripts/relations.test.mjs` failures (historical-sets sweep's own
    missing checked-in data files on this branch, unrelated), 1163 passed.
  - Didn't touch `functional-model/`, `server/api/*`, Sets, or Keywords —
    stayed inside the task's stated UI-only scope.
