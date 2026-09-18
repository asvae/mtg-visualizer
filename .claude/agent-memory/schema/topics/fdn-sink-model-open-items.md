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
- **Sink catalog now has 6 real entries (2026-09-18, later still)**:
  `lifegain`, `graveyard-fodder`, `etb`, `battlefield-presence-cats`,
  `battlefield-presence-creatures`, `counters-plus1plus1`, all `blue`.
  `counters-plus1plus1` (Exemplar of Light, FDN #11) is the first member of
  a general "puts a counter of type X" FAMILY — needed zero new matching
  code on either side (producer reuses the pre-existing generic `putCounter`
  occurrence + its `counterType` equality check; consumer reuses
  `consumerTriggerNames`), and does NOT set
  `requireConsumerForSelfOwnership` (unlike Battlefield presence) — putting
  a counter via a real effect is a genuine authored ability, not bare type
  membership. A future `counters-minus1minus1`/`counters-loyalty` sibling
  would be the identical shape, just a different `counterType`/`category`.
  `etb.ts` also gained a `consumerTriggerNames: ['onOtherCreatureEnter']`
  sibling to its pre-existing `consumerTriggerOn` (Dazzling Angel, FDN #9 —
  "whenever ANOTHER creature enters" has no real `Trigger.on` member,
  same engine gap as counter-added).
  **Real, general lesson, found live doing this pass — worth checking
  next time a `consumerTriggerNames` list looks stale**: `Trigger.name` is
  free text with NO canonical spelling — Exemplar of Light's own real
  "gain life" reactor trigger is named `'onLifeGain'` (missing the `d`),
  genuinely different from Ajani's Pridemate's `'onLifeGained'` despite
  meaning the same real precondition; `lifegain.ts`'s list was missing it
  entirely until this pass (silently returned `[]`/no-Lifegain-row for
  Exemplar of Light, contrary to an initial assumption it already worked).
  Don't assume one canonical name per real precondition — grep for
  near-miss spellings too, not just the one already in a catalog entry's
  list.
- **Sink catalog, 5-entry state (superseded by the 6-entry state
  immediately above — kept only as the prior real checkpoint)**: `lifegain`,
  `graveyard-fodder`, `etb`, `battlefield-presence-cats`,
  `battlefield-presence-creatures`, all `blue` — `lifegain` has a producer `query` +
  `consumerTriggerNames`; `graveyard-fodder` is producer-only; `etb` is
  ALSO now a real two-role entry (producer `query` + `consumerTriggerOn`,
  see below) — its original "single-role, has-an-`on:'enter'`-trigger"
  design was found wrong and replaced the same day. The
  `battlefield-presence-*` pair (Claws Out, FDN #6) shares one matcher
  (`consumerBattlefieldPresence`/`matchesBattlefieldPresenceConsumer`,
  reads `CostReduction.perControlled`/`pumpAll`/`putCounterAll` directly —
  genuinely different in kind from the trigger-keyed consumer signals) and
  introduced a new, general `SinkCatalogEntry
  .requireConsumerForSelfOwnership?: boolean` escape hatch — real bug
  fix, a card that merely IS a Cat/Creature (bare type/subtype membership)
  must NOT self-display the category, only a genuine consumer effect
  does; the reverse direction (producer matches for someone ELSE's want)
  is unaffected. Full writeup: `card-schema.md` section 9. Growing the
  catalog further for real FDN authoring is future work.
- **Real bug fix, 2026-09-18 (self-ownership vs. reverse-direction, the
  Healer's Hawk/Felidar Savior "Lifegain" bug)**: `ProducerOccurrence`
  (`match-sink.ts`) gained `predicateDerived?: boolean`, set ONLY by
  `deriveOccurrences` at its 3 predicate call sites (never by a predicate
  module itself) — `SinkMatchResult` surfaces it too. `card-interactions
  .ts`'s self-ownership gate now requires a match to be BOTH `matched` AND
  NOT `predicateDerived` (`selfDirectProducerMatch`) before a card
  self-displays a category; the reverse pool-matching loop (another card
  seeing THIS card as a producer) and `consumerTriggerNames` ownership are
  both unaffected. Fixes: `healer-s-hawk`/`felidar-savior`/`sun-blessed-
  healer`/`guarded-heir`/`sire-of-seven-deaths` (all real Lifelink-only
  FDN cards, no `gainLife` effect) no longer self-show "Lifegain"; Ajani's
  Pridemate still sees all of them as real producers. No Saga/Crew card
  exists in the FDN pool yet to cross-check the same fix for those 2
  predicates — flag for whenever one is authored. Full writeup:
  `card-schema.md` section 7.
- **Real bug fix, 2026-09-18, same day — `etb` redesigned as a genuine
  two-role "blink/bounce value" archetype (the Felidar-Savior-"ETB:20"
  bug)**: the original "no split needed, has-an-`on:'enter'`-trigger-alone"
  design over-matched (confirmed live: `count:20` against the real
  100-card pool). Now mirrors `lifegain`'s own shape: **producer** =
  `query: {category:'ETB', event:'bounce', controller:'you'}`, matched via
  a NEW `event:'bounce'` `ProducerOccurrence` in `match-sink.ts`'s
  `walkEffects`'s `case 'move'` (fires when `from` includes `'Battlefield'`
  AND `to === 'Hand'` — a card is only a "permanent," CR 110.1, while on
  the battlefield, so this can't be confused with graveyard-recursion
  `move` effects); real motivating producer: Bigfin Bouncer (FDN). **Consumer**
  = `SinkCatalogEntry.consumerTriggerOn?: Array<Trigger['on']>`
  (`catalog/entry.ts`), checked via `match-sink.ts`'s NEW
  `matchesConsumerTriggerOn` — a sibling to `consumerTriggerNames`, but
  checking the engine's own real CLOSED `Trigger.on` enum instead of the
  free-text `Trigger.name` field (genuinely safer, zero name-collision
  risk) — `etb` declares `consumerTriggerOn: ['enter']`, the one part of
  the original design that was already right. The old, now-dead
  `event:'etb'` occurrence (`collectForFace`'s `hasOnEnterTrigger` push)
  was deleted outright, not left unused. Verified live: `felidar-savior`
  full-pool `ETB` count dropped from the real, confirmed 20 to 1 (Bigfin
  Bouncer only, correctly excluding itself — no bounce effect of its own);
  Bigfin Bouncer self-matches (producer AND consumer). A peer
  server/card-agent route (`server/api/sink-catalog/index.get.ts`) was
  ALREADY coded against this exact `consumerTriggerOn`/
  `matchesConsumerTriggerOn` naming before this fix landed (same dispatch,
  parallel work) — confirmed type-compatible, zero new typecheck errors.
  Full writeup: `card-schema.md` section 8.
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
- **Scale-up to 100 cards (2026-09-18, later same day): mechanical setup
  done for 89 more slugs, cheap-tier authoring itself NOT done here** —
  the real in-scope FDN pool is 271 distinct names (`set_code='fdn' AND
  booster:true`, Basic Lands excluded, verified 0 name collisions,
  `layout:'normal'` for literally all 271 — no DFC/split/adventure shapes
  exist in-pool at all, so no authoring-shape gap to flag there). Target
  list (collector-number order, the 11 already-authored names excluded)
  starts `sire-of-seven-deaths` (cn 1) through `kellan-planar-trailblazer`
  (cn 91, with cn 12/16 skipped as the two already-done). Every one of the
  89 got a real `functional-model/.fdn-scratch/<slug>/` folder via
  `prep-card-context.mjs`, and EVERY one found real Forge source AND real
  XMage source (89/89 both — zero "not found" cases to flag this round,
  unusually clean).
- **Known, narrow gap, flagged not fixed**: `server/api/sink-catalog/
  index.get.ts`'s own `computeRealMatches` (`hasConsumerSignal`) only
  checks `entry.consumerTriggerNames`/`entry.consumerTriggerOn` — doesn't
  yet know about the newer `entry.consumerBattlefieldPresence`, so the
  `/app/engine/sinks` review-tool page's own `consumerMatches` list stays
  `undefined` (not a crash, just omitted) for `battlefield-presence-cats`/
  `-creatures` even though both have a real consumer signal;
  `producerMatches` still renders correctly (8/72 respectively). Card-
  serving-API-side file, `card`/`server`-owned — out of scope for the
  `engine`-scoped task that added the new field.
- **Sink catalog now has 7 real entries (2026-09-18, later still) —
  `battlefield-presence-hare-apparent`, a THIRD "Battlefield presence"
  filter variant (Hare Apparent, FDN #15's "create a Rabbit token for each
  OTHER creature you control named Hare Apparent").** Design chosen: Option
  1 from the task brief (a new declarative `combinator.ts` primitive,
  `FilterPredicate: {field:'sameNameAsSelf'}`, mirrors `'excludeSelf'`'s
  shape but compares `Card.getName()` and bakes in the self-exclusion) —
  rejected Option 2 (a narrower additive marker) because Option 1 was NOT
  disproportionate effort: only one new `FilterPredicate` variant was
  needed (`Query.source:'creaturesInPlay'` + `Aggregate{op:'count'}` already
  existed), and it's the same "combinator DSL is default for new
  vocabulary" convention this whole file already follows. Real changes:
  `combinator.ts` (`FilterPredicate`, `resolveQuery`, `QueryChain.filter`
  overload, `describePredicate`, exported `resolveValue`); `card.ts`
  (`createToken.amount` widened to `Computed<number> | ValueRef`, new
  `resolveCreateTokenAmount` helper — deliberately NOT a widening of the
  generic `resolve<T>`, scoped to this one field); `hare-apparent/
  definition.ts` rewritten onto `you.creaturesInPlay().filter
  ('sameNameAsSelf').count()`, replacing the raw closure (gate re-run,
  still `blue`); `sink-model/match-sink.ts` (`matchesBattlefieldPresenceConsumer`'s
  filter type widened to `{subtype?} | {sameNameAsSelf:true}`, new
  `effectsCareAboutSameNameCount`/`isSameNameCountValueRef`/
  `queryChainHasSameNameFilter` walking `createToken.amount`'s own AST, NOT
  `costReduction`/`pumpAll`/`putCounterAll` at all — a genuinely different
  consumer-detection shape from the `-cats`/`-creatures` pair);
  `sink-model/catalog/entry.ts` (`consumerBattlefieldPresence` widened to a
  union); new `sink-model/catalog/battlefield-presence-hare-apparent.ts`/
  `.test.ts` (7 cases)/`.corpus.json`, registered in `catalog/index.ts`.
  `recognizers/program-ast-walker.ts`'s `readPool` and `combinator.ts`'s
  `describePredicate` both needed one new branch each to stay exhaustive
  (`readPool` declines `sameNameAsSelf` — no real `kind:'program'` effect
  chains it, out of scope for that walker).
  **PRODUCER side is a deliberate divergence from `-cats`/`-creatures`**:
  "same name as self" is inherently self-referential per card (unlike a
  shared type/subtype), so there's no honest generic producer query —
  `query` uses a literal `name:{eq:'Hare Apparent'}` constraint instead,
  satisfied only by Hare Apparent's own baseline `entersBattlefield`
  occurrence (zero new producer code, reuses `name` in `Constraints`/
  `satisfiesConstraints` already). This makes the entry genuinely
  bespoke/one-card (sanctioned explicitly by `entry.ts`'s own "a bespoke
  sink is still just a catalog entry with low reuse" doc comment) — a
  future second same-name-counting card would need its own sibling entry
  (different slug, different literal `name`), sharing this same
  `sameNameAsSelf` consumer check and matcher function.
  **Self-ownership**: `requireConsumerForSelfOwnership: true`, same escape
  hatch as `-cats`/`-creatures`, reasoned through fresh — Hare Apparent's
  own baseline producer match against its OWN literal-name query is just as
  trivial/non-deliberate as "being a Cat" (every card's baseline occurrence
  always carries its own name), so bare producer identity does NOT grant
  self-display; the CONSUMER side (its own ETB effect genuinely depends on
  counting other copies) does.
  **Verified live** (real dev server, `GET /api/card/fdn/15`):
  `cardInteractions` now includes `{category:'Same-name copies', count:1,
  matches:[{card:'Hare Apparent', self:true}]}`. `GET /api/sink-catalog`:
  new entry `blue` (7/7 corpus), `realMatches.producerMatches:
  ['Hare Apparent']` only (self, confirming the bespoke-name-query design),
  `consumerMatches` omitted — same pre-existing, already-flagged
  `computeRealMatches`/`consumerBattlefieldPresence` gap `-cats`/
  `-creatures` already have (not fixed here, out of scope, `card`/
  `server`-owned). Full `functional-model` suite: 120 files, 1276 passed / 5
  skipped. `npm run typecheck`: identical pre-existing baseline error set
  (`CardDetailTabs.vue`/`card-status.ts`/`card.ts`'s `endTurn`/`mana.ts`/
  `server/api/tokens/by-key.ts`), zero new errors.
- **New script**: `functional-model/scripts/gate-and-write-status.mjs`
  (vite-node, uncommitted as of authoring — orchestrator's to review/
  commit) — the missing "run the gate, write `pipeline-status.json` from
  the real result" wrapper around `validateCardDefinition` +
  `pipelineStatusFromGateResult`, batchable: `npx vite-node
  functional-model/scripts/gate-and-write-status.mjs <slug> [<slug> ...]`
  or `--all` (discovers every `fdn-cards/<slug>/` that already has a
  `definition.ts`). Live-verified against all 11 real cards (byte-
  identical output modulo `computedAt`) plus a missing-slug case; writes
  nothing to disk for a `failureKind:'other'` result (reported loudly in
  the summary instead, per `pipelineStatusFromGateResult`'s own deliberate
  throw) or a missing-`definition.ts` slug.
