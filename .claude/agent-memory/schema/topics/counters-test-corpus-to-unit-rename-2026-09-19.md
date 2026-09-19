# counters.test.ts: "corpus test" -> "unit test" rename + Test2/Test3 removal (2026-09-19)

## Why

`catalog/<slug>.test.ts` files are, by convention (`.claude/contracts/
card-schema.md`'s "Sink catalog" section), the STRUCTURAL GATE: real vitest
cases running `matchSink(query, mockedFixture)` against MOCKED
`CardDefinition` fixtures. `counters.test.ts` stopped fitting that
description as of the 2026-09-18/19 `CountersSink` rewrites (commits
73c42fb7/45bc682e/b3721f9c) — it has no `SinkQuery`/`matchSink` call at all
(`CountersSink`'s entry has no `query` field, per `entry.ts`'s own doc
comment), and no longer even uses hand-authored mocks — it compiles real
Forge JSON via `forge-json-compiler`. Calling it a "corpus test" was stale
terminology specific to this one file.

## Terminology fix — files touched

- `functional-model/sink-model/catalog/entry.ts:44` — "family's own corpus
  test" -> "family's own unit test" (the `CountersSink`-specific paragraph
  about `query` becoming optional).
- `functional-model/sink-model/SINK_MODEL_DESIGN.md:200` — same swap, same
  paragraph, design-doc mirror of the above.
- `server/api/sink-catalog/index.get.ts:73` — "a family's own corpus test
  file is ALSO named..." -> dropped "corpus" entirely (this sentence is a
  general file-NAMING-convention claim true for every family, corpus-test
  or not — `counters.test.ts` is just the illustrating example — so
  "unit test" would have overclaimed for the general case, and "corpus
  test" was already wrong for the specific example).
- `server/api/sink-catalog/index.get.ts:199` — "a mocked `CardDefinition`
  in the family's own corpus test" -> "...unit test" (same `CountersSink`
  paragraph as `entry.ts:44`; left "mocked `CardDefinition`" itself alone —
  that phrase describes the 2026-09-18 decision point being quoted, not
  today's file mechanics, and touching it was out of this task's scope).

## Deliberately left untouched (generic "corpus test" usage, still accurate)

- `functional-model/card-interactions.ts:120`, `.claude/contracts/
  card-schema.md:1896`, `server/api/sink-catalog/index.get.ts:128` — all
  say "the catalog's own corpus tests" in the context of `entry.query`-
  based matching, which genuinely still describes `lifegain`/
  `graveyard-fodder`/`battlefield-presence`'s own real mocked-fixture
  test files. Not specific to `counters.test.ts`.
- `.claude/contracts/card-schema.md:1874` — the ORIGINAL general spec for
  `catalog/<slug>.test.ts` (written before the `CountersSink` exception
  existed). Left as-is rather than retrofitted with a carve-out — later
  sections of the same doc (search "CountersSink producer check migrates
  off") already fully document the exception; this file's own convention
  is additive dated sections, not rewriting earlier ones.
- `.claude/contracts/engine-status-schema.md:341`, `.claude/contracts/
  sink-derivation-status-schema.md:222`, `server/api/sink-derivations/
  index.get.ts:42`, `functional-model/card-interactions.ts:120` (predicate
  side) — all describe sink-derivation PREDICATES, a different family that
  still legitimately uses mocked-fixture corpus tests. Out of scope per
  the task's own explicit constraint.
- `app/pages/app/engine/predicates/[[slug]].vue:336`,
  `app/pages/app/engine/sinks/[[slug]].vue:92,351` — Vue page components,
  out of `schema`'s lane (ui/card domain). Line 92 specifically names
  `counters.test.ts` a "corpus test" too (same phrasing pattern as the
  server/api file) and should get the same swap — flagged back to the
  orchestrator to route to `ui`, not edited here.

## counters.test.ts stripped to 3 real CountersSink comparisons

Same session, orchestrator mid-task instruction: removed 'Test2 - forge
json' (hand-rolled inline Forge-DSL interpretation, never calls
`CountersSink`/`matchSink` at all) and 'Test3 - compiled from forge json'
(exact duplicate of the surviving first case's body) entirely, along with
their two inline `forgeSource`/`forgeSink` literals. Renamed the 3
survivors to drop the leftover `TestN -` numbering (only existed to
distinguish from the now-gone Test2/Test3) and fixed the file's own header
comment, which referenced "Test2 is the one deliberate exception" for the
"no hand-authored mocks" claim — that sentence's exception no longer
exists post-removal. Verified: `npx vitest run
functional-model/sink-model/catalog/counters.test.ts` (3/3 pass), full
`functional-model` suite (1330 passed/1 pre-existing unrelated failure —
`card-interactions.test.ts`'s Ajani's Pridemate categories case, confirmed
failing identically on `git stash` back to the pre-task committed state,
not caused by this pass), `npm run typecheck` (pre-existing 11-diagnostic
baseline, none touching `sink-model/`/`counters.test.ts`).
