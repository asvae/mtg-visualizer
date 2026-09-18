# CountersSink migrates off SinkQuery/matchSink (2026-09-18)

Deliberate, scoped-down first step of a bigger planned architecture
change ("sink family should produce sink out of card definition, not out
of magical query") — `BattlefieldPresenceSink`/`lifegain`/
`graveyard-fodder`/`etb` are UNCHANGED, still build+match via a real
`SinkQuery`/`matchSink` call. Only `CountersSink`
(`sink-model/catalog/families/counters.ts`) migrated.

**What changed**: `CountersSink`'s producer check no longer builds a
`SinkQuery` object. It still calls `deriveOccurrences(candidate, root)`
(`match-sink.ts` — real, reused, unchanged), but the match condition is
now real inline code: `occ.event === 'putCounter' && occ.counterType ===
counterType`, plus a small inline controller-compatibility check
mirroring `match-sink.ts`'s own private `effectiveController`/
`sidesCompatible` (NOT literal `occ.controller === 'you'` — that would
wrongly reject `putCounterTarget`/`putCounterAll` occurrences, which never
set `controller` at all, only `target:'self'`/nothing).

**Type/API ripple, not just internal**:
- `SinkCatalogEntry.query` (`catalog/entry.ts`) is now OPTIONAL.
  `CountersSink` instances have none — genuinely `undefined`, no
  synthesized display-only stand-in (explicit user call: "just put these
  mock definitions somewhere within test" — the corpus test IS the real
  documentation now).
- New `SinkCatalogEntry.category?: string` top-level field — the display
  label a query-less entry uses instead of `query.category`. Every read
  site (`card-interactions.ts`, `sink-catalog-status.ts`,
  `server/api/sink-catalog/index.get.ts`) now does
  `entry.category ?? entry.query?.category` (or `!` where a non-callable
  branch guarantees `query` is present).
- `card-interactions.ts` gained a local `matchEntry(entry, candidate,
  root)` helper: routes a callable `SinkInstance` through `entry(candidate,
  root)`; falls back to the old direct `matchSink(entry.query!, ...)` +
  3-way consumer check only for a plain non-callable entry. Behavior
  unchanged for every entry — verified live (`GET /api/card/fdn/11`,
  Exemplar of Light's own "+1/+1" row: 19 matches, self-included, same
  names before/after a `git stash`-mediated before/after comparison).
- `server/api/sink-catalog/index.get.ts`: `query: members[0]?.query` (no
  more `?? {category}` synthetic fallback); `SinkCatalogRealMatches`
  fields renamed `producerMatches`/`consumerMatches` →
  `sourceCandidateMatches`/`sinkCandidateMatches` (user-directed
  terminology, "Source Candidate"/"Sink Candidate" — avoids colliding with
  FIN's own `Fact.role` `'source'`/`'sink'` labels in
  `CardDetailTabs.vue`; the broader `producer`/`consumer` vocabulary
  elsewhere — `ProducerOccurrence`, `matchesConsumerTriggerNames`,
  `SinkMatchDetail.producer`/`.consumer`, `card-interactions.ts`'s
  internal names — is explicitly UNCHANGED, flagged open, not done).
  `SinkCatalogSourceFiles.corpusManifest` field DROPPED (no raw
  `.corpus.json` JSON dump anymore — "I'll read tests directly"); `entry`
  field now resolves to the FAMILY's shared factory file
  (`families/<slug>.ts`) for a real multi-instance family group, not the
  thin per-instance config file.
- `app/pages/app/engine/sinks/[[slug]].vue`: "Curated SinkQuery" panel
  renders conditionally on `selectedEntry.query`; "Source — real evidence"
  now shows exactly 2 blocks ("Sink source", "Corpus test").

**A real transient typecheck regression caught and fixed same-pass**:
`sink-catalog-status.ts:282`'s `group.members[0]!.query.category` broke
once `query` became optional (TS2532) — fixed to
`group.members[0]!.category ?? group.members[0]!.query!.category`.
Confirmed back to the exact 7-diagnostic baseline before finishing.

**Tests**: `counters.test.ts` fully rewritten — producer-mode cases now
call the entry's own callable contract (`entry(card)`) instead of
`matchSink(entry.query, card)` (there's no `query` left to pass);
"SOURCE CANDIDATE"/"SINK CANDIDATE" case-label terminology, matching the
UI rename. `counters-plus1plus1.corpus.json` case labels relabeled to
match (still 12/12, still `blue`).

**Zero regression, live-verified**: real FDN pool producer/consumer match
sets for the `counters` entry are byte-identical before/after (19 source
candidates, 1 sink candidate — Exemplar of Light) — confirmed via a real
dev server run against the pre-change code (`git stash`) and again against
the post-change code.

**Open follow-up, not done**: `BattlefieldPresenceSink` hasn't migrated to
this shape. Once/if it does, `matchSink`/`SinkQuery`/
`occurrenceSatisfiesSink` would have zero remaining callers inside
`sink-model/catalog/` besides the 3 plain singletons (`lifegain`/
`graveyard-fodder`/`etb`) — whether those should also migrate is an open
question. Also open: the wider `producer`/`consumer` vocabulary rename
(explicitly out of scope this task, per the orchestrator's own message)
across `match-sink.ts`/`card-interactions.ts`/`SinkMatchDetail` if the
user wants the "Source/Sink Candidate" terminology to go further than the
sinks review page.

Full detail: `sink-model/SINK_MODEL_DESIGN.md`'s "SinkQuery becomes
optional, `CountersSink` migrates off it" section;
`.claude/contracts/card-schema.md` section 11.
