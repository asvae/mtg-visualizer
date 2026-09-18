# Graph edge model: three independent, non-overlapping mechanisms

Don't conflate these on a future touch — each is a genuinely different
mechanism with its own state/rendering path:

1. **Card-to-card synergy edges** (`store.showSynergyEdges`, default
   `true`). A plain whole-category show/hide toggle over every produce/
   consume/atypical/grant/magnifier reason — checked = normal full graph,
   unchecked = zero card-to-card edges (removed from both the simulation's
   `SimLink`s and the visual fan-out, not just faded). This REPLACED an
   earlier "Source-Sink" topological isolate-filter design (pure-producer
   -> pure-consumer subset only) that was tried, verified working, and
   then explicitly scrapped by the user as the wrong model entirely — the
   old `computeNodeDegrees`/`isSourceSinkReason`/`NodeDegree` machinery in
   `filters.ts` is gone, not deprecated-in-place. Don't resurrect a
   topological source/sink subset filter without confirming this history.
2. **Keyword hubs** (`store.selectedKeywords`). Checking a keyword spawns a
   synthetic, client-only "hub" node (not part of `GraphFile`/buildGraph,
   not a real `d3.SimulationNodeDatum`) that every currently-visible card
   with that keyword is pulled toward via a custom named force
   (`keywordHub`). Fully decoupled from mechanism 1 — toggling
   `showSynergyEdges` never touches keyword hubs or vice versa. Color is
   muted slate-violet `#7d739c` (deliberately the one hue family nothing
   else in this UI uses — WUBRG/rarity/produce-consume-etc. are all
   spoken for). Known unaddressed limitation: multiple active hubs have no
   mutual repulsion and can visually crowd.
3. **Relation hubs — PROTOTYPE ONLY, unshipped, off by default**
   (`relationHubsEnabled`/`relationHubThreshold` in FilterPanel's "Edges"
   section, explicitly labeled non-production). Generalizes the same
   custom-force hub mechanism to ordinary synergy edges: any
   `${sourceId}::${reason.description}` group whose fanout exceeds the
   threshold collapses into one hub (click to expand/collapse). Known
   issue if this graduates past prototype: FIN's real dominant high-fanout
   case is ~93 near-identical "battlefield presence" cliques (nearly the
   same member population, different source card each) — each gets its
   OWN hub today, so they end up visually stacked/overlapping. Fix
   direction if pursued: merge hubs by membership-signature rather than
   one-hub-per-source. Also: FIN has no real single-card "anthem buffs
   whole board" edge in the actual graph-links data (confirmed — the
   functional-model matcher doesn't model that as a two-card interaction
   yet, an `engine`-side gap, not a UI one) — the prototype's demo relies
   on "battlefield presence" cliques as a stand-in, not a true anthem case.

**Edge weighting is uniform, not value-proportional.** `Fact.value` was
retired pool-wide (user decision) — `server/api/graph-links.ts`'s
`sourceShareRatio`/`sinkShareRatio` are now plain `1/N` (N = match count
sharing that fact key), not value-weighted sums. `reasonWeight()`'s "few
matches = strong pull, many matches = weak pull" behavior in
`graphRenderer.ts` still holds, just driven by count instead of magnitude.
Don't propose reintroducing weight magnitude (see also orchestrator
MEMORY.md `project_uniform_edge_weighting.md`).
