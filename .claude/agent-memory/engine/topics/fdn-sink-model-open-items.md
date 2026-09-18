# FDN / sink-model experiment: still-open items (as of 2026-09-18)

Full design/contract lives in `.claude/contracts/card-schema.md`'s "FDN
authoring-pipeline status" and "Sink CATALOG (shared, reviewed)" sections
— read those for the actual shape. This is only the punch-list of what's
genuinely still unbuilt/unresolved as of the last touch, so a future
session doesn't have to rediscover it:

- **No per-card sink ATTACHMENT concept exists — tried, then reverted the
  SAME day (2026-09-18).** `sink-attachment.ts` + its `pipeline-status.ts`
  `blue`-redefinition were built, shipped, live-verified — then the SAME
  user explicitly reversed it: no persisted per-card decision, ever;
  which cards own/are-selected-for a catalog sink is computed LIVE by
  `card-interactions.ts` instead (matches `definition`/pool against each
  usable `SINK_CATALOG` entry's own `query` via the existing `matchSink`,
  no fs persistence). `sink-attachment.ts`/its test/both real
  `sinks.json` files are deleted; `pipeline-status.ts`'s `blue` is back to
  gate-only. See `pipeline-status.ts`'s own header ("tried then
  reverted") and `card-schema.md`'s catalog section for the full
  writeup — don't re-propose the attachment shape.
- **SUPERSEDED, 2026-09-18, later the same day: consumer/want-side
  recognition IS now real, via a second, EXPLICITLY user-approved
  mechanism — `SinkCatalogEntry.consumerTriggerNames?: string[]`**
  (`sink-model/catalog/entry.ts`), checked via `sink-model/match-sink.ts`'s
  `matchesConsumerTriggerNames` (pure `Trigger.name` field comparison,
  never oracle text). The earlier "declined twice, don't fix without a
  fresh ruling" caution below was specifically about trusting `Trigger.name`
  to drive engine-firing/simulation; the user later drew a different,
  narrower line: using it as a MATCHING/categorization signal is fine,
  with the catalog's own human-reviewed corpus gate as the real check on
  false positives. `lifegain` now declares `consumerTriggerNames:
  ['onLifeGained']` — confirmed `ajanisPridemate` is the ONLY real FDN card
  with that trigger name (zero false-positive risk today).
  Historical record of the original finding, kept for context: catalog-first
  matching is PRODUCER-shaped (`matchSink(lifegainQuery, ajanisPridemate)`
  is still `false`, unchanged) — the consumer signal is a genuinely separate
  second check, not a change to the producer one.
- **Sink catalog still has only 2 real entries** (`lifegain`,
  `graveyard-fodder`, both `blue`) — `lifegain` now has BOTH a producer
  `query` and a consumer `consumerTriggerNames`; `graveyard-fodder` still
  producer-only. Growing the catalog for real FDN authoring is future work.
- **No route serves `computeSinkCatalogStatus` yet** — no `GET`/review
  `POST`, same "scaffolding only" starting point `pipeline-status.ts`/
  `sink-derivation-status.ts` both had before their own review routes
  landed.
- **5 sink-derivation mechanisms now seeded, 3 real (`saga`/`crew`/
  `lifelink`, all `blue`)** — `stun-counters`/`finality-counters` still have
  no real predicate module, stay `gray`. `lifelink`
  (`sink-model/predicates/lifelink.ts`, 2026-09-18) is the newest — a bare
  `CardDefinition.keywords.includes('Lifelink')` structural read (front AND
  back face independently), real-engine-verified via direct `state.ts`
  `dealDamage` calls (not a scripted scenario), added for `felidar-savior`
  (FDN #12, the second real card with printed Lifelink after
  `healer-s-hawk`). Deliberately does NOT un-park `synergy.ts`'s own
  `LIFELINK_SYNTHETIC_FACT_ENABLED = false` (2026-09-14) — that flag still
  governs FIN's real, served Interactions/graph-links pipeline, completely
  untouched; the new predicate lives only in the separate sink-only/catalog
  prototype matcher (FDN-scoped in production serving today). See
  `card-schema.md`'s "Full chain worked example" section for the full
  writeup, including the one existing test (`match-sink.test.ts`'s "sink D",
  a FIN-pool cross-check corpus, never served output) whose own assertion
  flipped as a deliberate, documented consequence — flagged there for
  anyone surprised by it, not silently changed.
- **`fdn-cards/` "siblings" search in `prep-card-context.mjs`** matches
  any existing `functional-model/cards/*/definition.ts` whose card name
  also happens to appear in the fdn set (not specifically cards authored
  FOR the FDN pipeline — none exist yet, so this is currently
  unobservable either way). Treated as a genuine feature (a real,
  working same-shape example beats zero), not a bug — flagged for the
  user/orchestrator to revisit once FDN's own authored pool exists and
  the two styles might diverge.
- `functional-model/cards/` (FIN's pool) is reference-only for new
  authoring as of 2026-09-18 — new FDN cards live in
  `functional-model/fdn-cards/<slug>/` instead (just
  `definition.ts` + `pipeline-status.json`; no `Facts`/`synergy.json` by
  design, see `card-schema.md`'s "FDN authoring-pipeline status"
  section). Several pool-scanning scripts (`card-status-batch.mjs`,
  `build-fm-bundle.mjs`, `sync-combos.mjs`) blindly scan every entry
  under `functional-model/cards/` with no filter — the `fdn-cards/` split
  is itself what keeps FDN cards out of that ambient scan, not a
  filter added to those scripts.
