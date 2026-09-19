# "Sink" → "Matcher" rename across the catalog-matcher layer (2026-09-19)

## Why

"Sink" named TWO unrelated things: the catalog-matcher machinery
(`SinkInstance`/`SinkFamily`/`SinkQuery`/`matchSink`/`CountersSink`/...)
AND the per-card `Fact.role: 'sink'/'source'` label. User's own framing:
"Matcher basically would be a thing that sits between cards." Renamed the
FIRST usage only — role labels, "Source/Sink Candidate" UI vocabulary, and
the whole sink-derivation-PREDICATE subsystem stay "sink"/"source"
unchanged (that's the concept being disambiguated FROM).

Full rename map + rationale is written up as dated section 14 in
`.claude/contracts/card-schema.md` (search "Sink" → "Matcher" rename") —
this topic file only covers what a future task needs that ISN'T already
there.

## Physical moves (the one non-obvious judgment call)

`sink-model/predicates/` (crew/saga/lifelink — the sink-derivation-
predicate subsystem, explicitly OUT of this rename) physically lived
NESTED inside `sink-model/`, the exact directory being renamed to
`matcher-model/`. Moving the whole directory would have broken
`sink-derivation-status.ts`'s own hardcoded `predicatesDir` path constant
and `sink-derivation-status.test.ts`'s hardcoded path assertions — both
explicitly listed as DO-NOT-TOUCH files. Resolved by relocating predicates
to their own top-level home instead:
`functional-model/sink-derivation-predicates/` (NOT under `matcher-model/`
at all) — then fixed the resulting one-line physical-path-string breakage
in the 2 otherwise-untouched files (zero identifier/vocabulary changes
there, purely `join('functional-model', 'sink-model', 'predicates')` →
`join('functional-model', 'sink-derivation-predicates')` and the matching
test assertion strings). If a future task moves things again, re-check
this exact tension before assuming the whole directory can move as one
unit.

Relative-import depth gotcha: `sink-derivation-predicates/*.ts` moved from
2-levels-deep (`sink-model/predicates/`) to 1-level-deep — every
`'../../card'`/`'../../saga'`/`'../../combinator'` import in
`crew.ts`/`saga.ts`/`lifelink.ts` (and their own `.test.ts` files) needed
`../` not `../../`. Easy to miss since `tsc`/vitest both report it
immediately as a real "cannot find module" error — just re-run typecheck
after any future move of this directory.

## `server/api/sink-catalog/**` — route path deliberately NOT renamed

Renamed internal types/imports (`SinkCatalogEntry`→`MatcherCatalogEntry`
etc.) but kept the directory name and served route path
(`GET /api/sink-catalog`, `/app/engine/sinks/<slug>`) UNCHANGED — a route
rename is a real API-contract change `ui`/`card` would need to coordinate
on (their own fetch calls), out of scope for a same-day mechanical rename.
Flagged, not decided unilaterally. `app/pages/app/engine/sinks/[[slug]]
.vue`'s own `SinkCatalogPageEntry` import HAD to be fixed too (typecheck
break otherwise) — did the same mechanical identifier-only rename there,
found the `ui` agent had already concurrently fixed this file's
"corpus test"→"unit test" wording (a different in-flight task) while I was
working; layered on top cleanly, didn't revert their edit.

## `card-interactions.ts` touched despite being `engine`-owned

Real, dense `Sink`-identifier usage throughout (imports + `matchEntry`
logic + comments) — not optional to fix, since leaving it unrenamed would
leave the whole `functional-model` tree non-compiling (its imports point
at files this rename physically moved). Did the full mechanical rename,
zero behavior change, flagged to `engine` for review rather than asking
first (typecheck-clean was a stated hard requirement).

## Deliberately preserved (not stray misses)

- `SinkMatchDetail` — a real, already-DELETED type name, mentioned only in
  historical prose (`MATCHER_MODEL_DESIGN.md`, `entry.ts`,
  `battlefield-presence.test.ts`, `server/api/sink-catalog/index.get.ts`).
  Left exactly as-is everywhere — same "keep history intact" convention
  `MATCHER_MODEL_DESIGN.md` already established for its own stale prose.
- `sinkCandidateMatches`/`sinkCandidateNames`/"Sink Candidate" (`server/api
  /sink-catalog/index.get.ts`) — the OTHER, deliberately-unrenamed
  Source/Sink-role UI vocabulary, not the catalog-matcher machinery.
- ~230 bare-English-word "sink"/"sinks" prose occurrences across
  `matcher-model/**` doc comments (e.g. "does this candidate satisfy this
  sink?") — judged out of the hard "no Sink-named identifier" bar (that's
  about real TS identifiers/filenames, verifiable by typecheck; rewriting
  every sentence would be "a redesign," not "a rename"). Flagged as a
  known, accepted cosmetic residual, not silently ignored.
- `app/lib/graphRenderer.ts`/`useGraphStore.ts`'s `DeckSinkRow`/
  `SINK_ROW_*` — an entirely unrelated graph-rendering concept, never in
  scope, not touched.

## Still stale (out of scope, flagged not fixed)

`SYNERGY_DESIGN.md`/`synergy.ts` (1-line stale `sink-model` citation each,
`engine`-owned) and `server/api/sink-derivations/index.get.ts`'s own stale
predicates-path comment — low priority, not explicitly asked, left alone.

**Follow-up (same day, coordinator-approved narrow fix)**: `.claude/
contracts/sink-derivation-status-schema.md`'s 8 literal path citations
(`sink-model/match-sink.ts`->`matcher-model/match-query.ts`,
`sink-model/predicates`->`sink-derivation-predicates`, ×7) and
`.claude/agents/{schema,engine}.md`'s own `sink-model/*` mentions
(->`matcher-model/*`/`sink-derivation-predicates/*`) WERE fixed —
path-string-only, zero identifier/vocabulary change to the sink-derivation
subsystem itself, confirmed acceptable despite the file's general
do-not-touch status.
