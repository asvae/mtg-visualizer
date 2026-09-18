# Sink catalog: family/instance factory refactor + family-scoped review (2026-09-18)

Real architecture change, NOT the shallower `family: {slug,label,variant}`
display-metadata field tried earlier the same day (`116afa14`, reverted
`d3e92571` — "we don't need variants," zero behavior attached). This pass
gave the concept real behavior on two axes: matching AND review status.

## Vocabulary (user-specified, use going forward)

- **Sink family** — the factory: `BattlefieldPresenceSink`/`CountersSink`
  (`functional-model/sink-model/catalog/battlefield-presence.ts`/
  `counters.ts`). Real type: `SinkFamily<Config> = (config: Config) =>
  SinkInstance` (`catalog/entry.ts`).
- **Sink instance** — one configured value a family factory returns (the
  Cats config, the +1/+1 config). Real type: `SinkInstance = SinkCatalogEntry
  & ((candidate: CardDefinition, root?: string) => SinkMatchDetail | null)`
  — literally a function VALUE with the entry's own data fields
  (`slug`/`query`/`consumerTriggerNames`/...) assigned onto it via
  `Object.assign`. `SINK_CATALOG` stays a flat array of individual
  instances — nothing about matching changed shape.
- **`self`** = the card asking "who matches my own sink category."
  **`candidate`** = the card being tested against one instance. Matches
  `SinkInstance`'s own call signature; not yet wired into `card-
  interactions.ts` (still does its own separate per-signal checks) — see
  "Not done" below.

## Matching (per-instance, unchanged behavior)

`entry(candidate)` returns `null` when neither the instance's producer
`query` nor any declared consumer signal matches, or `{producer?:
{via,predicateDerived?}, consumer?: {via: 'triggerName'|'triggerOn'|
'battlefieldPresence'}}` when it does — strictly more detail than the old
separate boolean checks (`matchSink(...).matched`,
`matchesConsumerTriggerNames(...)` etc., which are UNCHANGED and still the
real underlying logic the wrapper calls). No existing production consumer
(`card-interactions.ts`, the server API route) calls an instance as a
function yet — `battlefield-presence.test.ts`/`counters.test.ts` are the
first real callers (3 new CALLABLE-contract cases per family, folded into
the existing corpus.json total/passing counts).

## Review status — now FAMILY-scoped, not per-instance (real scope change)

`sink-catalog-status.ts`'s `computeSinkCatalogStatus()` groups every real
`SINK_CATALOG` instance by `entry.family ?? entry.slug` (`groupCatalogByFamily`)
and returns ONE `SinkCatalogStatusEntry` per GROUP:
- `slug` = the family key (`'battlefield-presence'`/`'counters'`) for a real
  family, or the singleton's own slug otherwise (unchanged for
  `lifegain`/`graveyard-fodder`/`etb` — grouping degenerates to 1:1).
- `category` = a small hand-maintained `FAMILY_LABELS` map value for a real
  family (`'Battlefield presence'`/`'Counters'`), or the singleton's own
  `query.category` otherwise.
- `baseline`/`evidence.corpusTotal`/`corpusPassing` = SUMMED across every
  member instance's own real `<instance-slug>.corpus.json` (unchanged
  per-instance corpus/test files — 4 files still exist on disk, just no
  longer independently reviewable).
- `evidence.members: SinkCatalogMemberEvidence[]` — always present, full
  per-instance breakdown (never lost).
- `instanceSlugs?: string[]` — present only for a real multi-instance group.

**`isFamily` is keyed off an EXPLICIT `entry.family !== undefined` check,
NOT `members.length > 1`** — `counters` is a real family with only 1
instance today (`counters-plus1plus1`) and is still reported as "Counters,"
not silently folded back to singleton treatment. Caught by a real test
failure the first time (`members.length > 1` gave `counters` no
`instanceSlugs`/wrong category, and broke the fingerprint drift test since
`sourceFileFor` picked the wrong file) — fixed before landing.

`computeSinkCatalogColor`/`computeSinkCatalogFingerprint`/
`isSinkCatalogEntryUsable` all accept EITHER a real instance slug (what
`card-interactions.ts`'s existing, UNCHANGED per-`SINK_CATALOG`-entry loop
still passes) OR the group's own key, via `resolveGroupKey` — every
instance slug in the same family resolves to and shares the identical
color/fingerprint. This is why `card-interactions.ts` needed ZERO edits: a
human review verdict now genuinely applies to the whole family at once
(the actual ask), while every existing call site keeps working unmodified.

**Confirmed as the real, load-bearing consequence (2026-09-18, later
clarified by the user directly)**: pages/slugs are now family-scoped ONLY —
an old instance-level slug (`'battlefield-presence-cats'`,
`'counters-plus1plus1'`) is no longer independently servable/reviewable as
its own top-level catalog entry. This fell out for free from the
`computeSinkCatalogStatus()` restructuring above, verified two ways without
touching either server route: (1) `GET /api/sink-catalog`'s `index.get.ts`
maps directly over `computeSinkCatalogStatus()`'s output, so it now only
ever serves 5 rows (2 families + 3 singletons), never the old 7 instance
rows; (2) `review.post.ts`'s own `entries.find((e) => e.slug === slug)`
validation now 404s on an old instance-level slug automatically. Live
`computeSinkCatalogStatus()` check (`npx tsx -e ...`) confirmed exactly 5
rows, all `blue`, `battlefield-presence.corpusTotal:31` (14+10+7 summed),
`counters.corpusTotal:12`.

## Known, flagged gaps (not fixed here — API route out of scope this task)

- `server/api/sink-catalog/index.get.ts`'s `SINK_CATALOG.find((e) => e.slug
  === entry.slug)` / `loadSourceFiles(slug, evidence)` still assume 1 row
  per real instance slug — for the 2 family rows this degrades to
  `catalogEntry: undefined` (graceful `query` fallback, no crash) and wrong/
  incomplete `sourceFiles.entry`/`corpusTest` content (reads
  `${familyKey}.ts`/`.test.ts`, which DO happen to exist for real now —
  `battlefield-presence.ts`/`.test.ts`, `counters.ts`/`.test.ts` — but
  `sourceFiles.corpusManifest` reads `evidence.corpusManifestPath`, which
  `sink-catalog-status.ts` only sets to the FIRST member's own path as a
  compatibility shim, not the real combined picture). `review.post.ts`
  needs no fix for validation (see above) but its `computeSinkCatalogFingerprint(entry.slug,
  root)` call already correctly resolves through `resolveGroupKey`.
  Exact fix needed: thread `evidence.members`/`instanceSlugs` through
  `loadSourceFiles` instead of the single legacy path fields.
- `SinkCatalogEntry.family` doc comment (`catalog/entry.ts`) spells out both
  gaps above in full for whoever picks this up.

## Not done (flagged, not built — explicit user permission to defer)

- No `hasSink(self, sinkType)`/`getSinks(self, sinkType)` pair exists yet —
  `card-interactions.ts`'s own self-ownership derivation
  (`selfDirectProducerMatch`/`selfConsumerMatch`/
  `requireConsumerForSelfOwnership`) is still the real "does self own this
  category" logic, unrefactored to call through `SinkInstance`. A natural
  follow-up, not required for this task.
- `/app/engine/sinks` UI page + its server API route: NOT touched (explicit
  task boundary) — `ui`/`card`/`server` agents own wiring the family-scoped
  data shape into actual page routing once ready.

## Verification (this pass)

`npx vitest run functional-model`: 120 files / 1338 passed / 5 skipped
(zero regressions). `npm run typecheck`: identical pre-existing 7-diagnostic
baseline (`CardDetailTabs.vue` x3, `card-status.ts`, `card.ts`'s `endTurn`,
`mana.ts`, `server/api/tokens/by-key.ts`) — caught and fixed one NEW
diagnostic of my own first (`BattlefieldPresenceFilter`'s `subtype` needed
to stay optional, dropped by accident copying from `entry.ts`'s union).
Live spot-check via `npx tsx -e ...` against real FDN cards (Claws Out/
Helpful Hunter/Hare Apparent/Exemplar of Light `computeCardInteractions`)
reproduced byte-identical categories/counts/self-ownership to the
pre-refactor documented behavior (Helpful Hunter still does NOT self-show
"Cats"; Claws Out still owns both "Cats" and "Creatures"; Hare Apparent/
Exemplar of Light still self-own their own bespoke categories).
