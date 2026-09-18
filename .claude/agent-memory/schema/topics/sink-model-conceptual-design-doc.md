# Sink model conceptual design doc (2026-09-18)

Wrote `functional-model/sink-model/SINK_MODEL_DESIGN.md` — the missing
"why does this system look the way it does" doc for the sink-only
synergy model, grounding the user's own Self/Sink/(Predicates)/Candidate
framing in real code:

- Self/candidate = `card-interactions.ts`'s own terminology; a Sink =
  a `SinkInstance` (`sink-model/catalog/entry.ts`), a real callable
  `(candidate, root?) => SinkMatchDetail | null` — the node between them.
- "Compression" = `CardDefinition.keywords: Keyword[]` (a closed label
  standing in for real behavior); predicates
  (`sink-model/predicates/{saga,crew,lifelink}.ts`) are the
  uncompression mechanism, feeding `match-sink.ts`'s `deriveOccurrences`
  (`ProducerOccurrence.predicateDerived` tracks predicate-derived vs.
  directly-authored evidence — consulted by `card-interactions.ts`'s
  self-ownership gate, never trusted alone for self-ownership).
- Sink's 4 responsibilities all mapped to real code and confirmed
  correct, not aspirational: self-applicability →
  `requireConsumerForSelfOwnership`; narrowing → `SinkFamily<Config>`
  factories (`BattlefieldPresenceSink`/`CountersSink`); instance-vs-
  candidate → the `SinkInstance` callable contract; per-instance UI
  naming → `entry.query.category` (confirmed already per-instance, e.g.
  'Cats' not 'Battlefield presence' — no gap found).
- New point (from a mid-task coordinator correction): confirmed
  DIRECTLY in code (not assumed) that a card's own page
  (`card-interactions.ts`'s `computeCardInteractions`) reports at
  INSTANCE granularity (loops `SINK_CATALOG` flat array, keys by
  `entry.query.category`, only imports `isSinkCatalogEntryUsable` from
  `sink-catalog-status.ts`, never the family-grouping functions) — a
  card matching 2+ instances of one family gets 2+ separate rows, never
  collapsed. Family-level rollup is confined to
  `sink-catalog-status.ts`'s `computeSinkCatalogStatus`, consumed only by
  `server/api/sink-catalog/index.get.ts` (the review dashboard route) —
  genuinely different granularity for a genuinely different question
  (review browsing vs. per-card display), not a bug.
- Added a short top-of-file pointer in `SYNERGY_DESIGN.md` (FIN's
  paired-Fact model doc) noting it does NOT cover this newer model and
  linking to the new doc.
- Mid-task correction handled: a coordinator relay first suggested a
  possible `appliesToSelf()`-style gap, then retracted it after user
  pushback — self-check is NOT a separate sink capability, it's the same
  `instance(candidate) => SinkMatchDetail | null` callable invoked with
  `self` as the candidate; `requireConsumerForSelfOwnership` stays a
  plain config flag, and `card-interactions.ts`'s
  `selfDirectProducerMatch`/`selfConsumerMatch` is external
  post-processing filtering over the returned `{producer?, consumer?}`
  detail, not sink-level behavior. My draft never actually proposed the
  wrong method (checked before editing), but strengthened §1 to state
  this explicitly so a future reader can't misread it that way either.

**Flagged, not done (orchestrator-owned)**: `.claude/ORCHESTRATOR_PRIMER.md`'s
doc map (currently lists only `SYNERGY_DESIGN.md`, stale at "624L" —
it's actually grown to 3095L) should get a new bullet for
`sink-model/SINK_MODEL_DESIGN.md`. Did not edit it myself per task
constraints.

No code changed — pure documentation task. Verified everything the doc
claims against current source directly (entry.ts, battlefield-presence.ts,
counters.ts, match-sink.ts, card-interactions.ts, sink-catalog-status.ts,
sink-catalog/index.get.ts — read-only, did not touch the in-flight
concurrent fix there).
