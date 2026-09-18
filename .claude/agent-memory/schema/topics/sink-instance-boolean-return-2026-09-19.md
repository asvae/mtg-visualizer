# `SinkInstance` callable returns a plain `boolean` (producer-only); `SinkFamily<Config>` returns `SinkInstance[]` (2026-09-19, later still)

3rd real design iteration on the `SinkInstance` callable contract this
week: `SinkQuery`-based -> config-object-based ->
`CardDefinition`-based (see `countersSink-takes-carddefinition-2026-09-19.md`)
-> **boolean-return-based**. This is now the established precedent for
whichever family migrates off `SinkQuery` next — read this before touching
`lifegain`/`graveyard-fodder`/`etb`/`BattlefieldPresenceSink`'s own internal
matching logic.

## What changed

`functional-model/sink-model/catalog/entry.ts`:
- `SinkMatchDetail` type — **deleted entirely**, nothing returns it anymore.
- `SinkInstance = SinkCatalogEntry & ((candidate, root?) => boolean) &
  { isPredicateDerived?: (candidate, root?) => boolean }` — was `SinkCatalogEntry
  & ((candidate, root?) => SinkMatchDetail | null)`.
- `SinkFamily<Config> = (config: Config) => SinkInstance[]` — was `=>
  SinkInstance` (single). Live user correction mid-task: "we need array
  handling here obviously."

The callable now answers the **PRODUCER question only** — "does `candidate`
itself structurally produce this sink's event" — never a combined
producer-or-consumer question. Verified against every real consumer of the
old combined return before scoping this as a real simplification, not a
loss: the CONSUMER check already lived as a separate, already-boolean
function (`matchesConsumerTriggerNames`/`matchesConsumerTriggerOn`/
`matchesBattlefieldPresenceConsumer`, never actually routed through the
callable by `counters.test.ts`'s own pre-existing "SINK CANDIDATE" cases);
every real production reader (`card-interactions.ts`'s `matchEntry`,
`server/api/sink-catalog/index.get.ts`) already reduced the old combined
return to `!!detail?.producer`/`!!detail?.consumer` immediately; `.via` (the
debug string) had zero real readers in `app/`/`server/`.

`predicateDerived` survives as `SinkInstance.isPredicateDerived?(candidate,
root?) => boolean` — still genuinely needed by `card-interactions.ts`'s
`selfDirectProducerMatch = self.producerMatched && !self.predicateDerived`
(Healer's Hawk/Felidar Savior self-ownership fix). Both families implement
it: `CountersSink` re-derives from its own `producerPredicate`'s occurrence;
`BattlefieldPresenceSink` re-exposes `matchSink`'s own already-computed
`predicateDerived` field (a real conforming edit, not a migration of its
internal `SinkQuery`/`matchSink` logic).

## `CountersSink` now returns `SinkInstance[]` — one per distinct `counterType`

`deriveCounterType` (singular, first-match-wins — silently discarded any
non-first counter type found) -> `deriveCounterTypes` (plural — collects
every DISTINCT `counterType` across `definition.effects` +
`definition.triggers[].effects`, deduped via a `Set`). `CountersSink`
now maps each distinct `counterType` to its own `buildCounterInstance`.
Exemplar of Light (only real driving definition in the pool) has exactly
one distinct `counterType`, so `CountersSink(exemplarOfLight)` still
resolves to a single-element array in practice — zero real behavior change,
only a widened, honest contract. `catalog/counters-plus1plus1.ts` now reads
`CountersSink(exemplarOfLight)[0]!`.

**General dedup principle (stated explicitly by the user, applies to
whichever family adopts this array shape next)**: "we should not have any
absolutely identical sinks (i.e. when card has 2 locations for exactly the
same effect), but any difference should create separate sink." Two
occurrences producing the SAME derived instance collapse to one; a genuine
difference produces a separate instance. For `CountersSink`, `counterType`
IS the complete identity key (every other derived field is a pure function
of `counterType` + the whole `definition`, never of which occurrence
produced it) — deduping on the raw string is the correct, COMPLETE
implementation of the rule for this family, not an approximation. A future
family's own dedup key must be whatever fields actually determine ITS
instance identity, not necessarily one string.

## `BattlefieldPresenceSink` — conforming edit only, not migrated

Per explicit task scope (same "one family at a time" precedent as the prior
two passes): its own internal `SinkQuery`/`matchSink`-based matching logic
is UNCHANGED. Its callable now returns `matchSink(query, candidate,
root).matched` (a plain boolean) and gained `isPredicateDerived`; its
factory now returns `[sink]` (single-element array) to satisfy the widened
`SinkFamily<Config>` type — a genuine structural degenerate case, not a
special exception. All 3 instance files
(`battlefield-presence-{cats,creatures,hare-apparent}.ts`) now read
`BattlefieldPresenceSink({...})[0]!`.

**Watch for**: `noUncheckedIndexedAccess: true` is set in the Nuxt-generated
tsconfig (`.nuxt/tsconfig.node.json`) but NOT in
`functional-model/tsconfig.json` — confirmed via a live `tsc` probe that
plain array destructuring (`const [x] = fn()`) infers `x: T | undefined`
under that flag. Every array-unwrap site in this pass therefore uses
`arr[0]!` (an explicit, structurally-justified non-null assertion, each
with a doc comment explaining why it's safe) rather than destructuring, to
stay typecheck-clean regardless of which program a given file ends up
compiled under.

## Verification

`npx vitest run functional-model`: 120 files / 1347 passed / 5 skipped (net
+3 vs the prior 1344/5 baseline — new `isPredicateDerived` coverage in both
`counters.test.ts`/`battlefield-presence.test.ts` plus 2 new array/dedup
derivation cases proving the "2 distinct counterTypes -> 2 instances" and "2
occurrences, same counterType -> 1 instance" rules). `npm run typecheck`:
unchanged 7-diagnostic pre-existing baseline (`CardDetailTabs.vue`×3,
`card-status.ts:263`, `card.ts`'s `endTurn` line, `mana.ts:275`,
`server/api/tokens/by-key.ts:32`), zero new. Live dev-server check
byte-identical to pre-change: `GET /api/sink-catalog` — `counters` 19
source-candidate/1 sink-candidate (Exemplar of Light); `battlefield-
presence` 111 source-candidate/4 sink-candidate. `GET /api/card/fdn/11`'s
`"+1/+1"` row still `count: 19`, self included. `GET /api/card/fdn/6`
(Claws Out) — `"Creatures"` `count: 111`, `"Cats"` `count: 10`.
`/app/engine/sinks/counters`, `/app/engine/sinks/counters-plus1plus1`,
`/app/engine/cards/fdn/11` all 200.

Full writeup: `functional-model/sink-model/SINK_MODEL_DESIGN.md`'s new
"2d / 3b" section; `.claude/contracts/card-schema.md`'s new section 13.

## Open / not done

- `BattlefieldPresenceSink`'s own internal `SinkQuery`/`matchSink`-based
  matching logic (and its hand-authored `BattlefieldPresenceSinkConfig`)
  still not migrated — same deliberately-deferred follow-up as before, now
  3 passes deep.
- No Forge re-verification needed this pass — purely a callable-contract/
  return-shape refactor, no new oracle-text/rules claims.
- Real production pool still only ever has ONE distinct `counterType`
  (`'+1/+1'`) — the 2-distinct-counterTypes/dedup behavior is covered by
  mocked-fixture tests only, not yet exercised by a real second card; worth
  re-checking once a `-1/-1` or loyalty-counter FDN card is authored.
