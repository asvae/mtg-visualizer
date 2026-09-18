# FDN Interactions section: wired to `computeCardInteractions`, live

2026-09-18, follow-up to `engine`'s sink-attachment revert (`d4de805`).
`functional-model/card-interactions.ts`'s `computeCardInteractions(definition,
poolDefinitions, root?)` had existed unwired since an earlier same-day pass —
now it's real, served, rendered.

## Server: `server/api/card/[set]/[number].ts`

- New `FunctionalModelData.cardInteractions: CardInteractionCategory[]` —
  `fdn`-only, always `[]` for `fin` (that set keeps the OLD top-level
  `interactions` field / `loadInteractionGroups`, a genuinely different
  mechanism — no merge attempted).
- New `loadFdnDefinitionPool(root)` — the FDN-pool loader
  `computeCardInteractions` needs. **Must spawn `functional-model/scripts/
  list-fdn-definitions.mjs` under `vite-node`, not a plain in-process
  `pathToFileURL`+`import()`** (the pattern `loadFunctionalModelPool`/
  `loadCardDefinitionDev` use for FIN) — tried the plain-import version
  first and it silently DROPPED `day-of-judgment` from the pool: that's the
  one real fdn-cards file with a VALUE-level (non-type-only) relative
  import (`import { anyPlayer, destroyEach } from '../../combinator'`, no
  extension) — every other fdn-cards file only imports `CardDefinition`/
  `Effect` as types, which get erased, so this gap was invisible until a
  card needing a real value import existed. Plain Node ESM resolution
  throws on the missing extension; `vite-node`'s own resolver tolerates it
  (confirmed directly, same reason `validate-card-definition.mjs`'s own
  dynamic import already has to run under vite-node). `list-fdn-
  definitions.mjs` prints the whole real fdn-cards/ pool as one JSON array
  (a `CardDefinition`, even a `kind:'program'` combinator-DSL `program`
  field, is plain JSON-serializable data — confirmed).
- `loadFdnFunctionalModel` resolves `definition = pool.find(d => d.name ===
  name)` (Scryfall name, this app's identity key) rather than a second
  separate dynamic import of the same file.
- Dev-only, same posture as the rest of this FDN wiring — no production
  branch (matches `pipelineStatus`/`oracleText`).

## Client

- `app/lib/cardResponse.ts` — `cardInteractions: CardInteractionCategory[]`
  added to the hand-mirrored `functionalModel` type (imports the real type
  from `functional-model/card-interactions`, doesn't hand-duplicate the
  shape).
- `app/components/CardDetailTabs.vue` — a NEW, clearly-labeled Interactions
  block (`fdnInteractions` computed, `v-if="isFdn && fdnInteractions.length"`),
  kept separate from the pre-existing `orderedInteractions`/
  `EnrichedInteractionGroup` panel just above it — that one is genuinely
  FIN-only plumbing (keyed off `factKey`/`Fact.annotations`, which FDN has
  none of), not something worth forcing FDN through. Display: category +
  count + plain matching-card-name chips (no images/links — a catalog
  category has no per-card thumbnail metadata), self-name bolded when the
  card matches its own category.

## Real verification (live, 2026-09-18)

`day-of-judgment` (fdn/140) shows "Graveyard fodder" (1 card, itself) once
the vite-node pool-loader fix landed — was `[]` (empty) under the naive
plain-import pool loader, a real bug caught only by live verification, not
by the unit tests (which import `dayOfJudgment` directly, bypassing the
route's own pool-assembly step entirely).

`ajani-s-pridemate` (fdn/135): **now DOES show "Lifegain"** — this
contradicts the "flagged, not forced, not a bug to chase" framing this same
session's own task brief (and `.claude/contracts/card-schema.md`, at the
time) stated. Root cause: a genuinely concurrent, uncommitted `engine`-side
change landed in `functional-model/card-interactions.ts`/`sink-model/
match-sink.ts`/`sink-model/catalog/*` DURING this task (a real "two
sessions editing the same files at once" case, confirmed via a flickering
`git diff`/re-read before it settled) adding `SinkCatalogEntry.
consumerTriggerNames` — an explicit, curated, per-catalog-entry opt-in that
lets `lifegain` also recognize a consumer-side `Trigger.name` signal. Not
this session's work, not reverted; the wiring in this topic is compatible
with it either way (the served shape/signature didn't change). If a future
task's own brief cites the old "Ajani never gets Lifegain" framing, treat
it as superseded — check `card-interactions.ts`'s own header for the
current, real designed behavior rather than trusting an older report.

## 2026-09-18, later still — real thumbnails, self-outline, catalog-only

Two follow-ups landed together, both live-verified:

1. **Real thumbnails/links, not plain name chips.** The "no per-card
   thumbnail metadata" framing above is now stale — `computeCardInteractions`
   itself stayed pure (`CardInteractionCategory.matchingCardNames: string[]`,
   no fs/db reads, unchanged), but `server/api/card/[set]/[number].ts` now
   enriches it server-side via a NEW `enrichCardInteractions` helper, reusing
   `resolveFunctionalModelCardMeta` AS-IS (same function
   `loadInteractionGroups`/the FIN panel already uses) — no second
   FDN-pool-query convention invented, since an FDN card is a real printed
   card already covered by that function's `dbLookupByName`/
   `resolveLiveCardMeta` legs against `data/cards.db` (synced across every
   set). Served shape is now `FunctionalModelData.cardInteractions:
   EnrichedCardInteractionCategory[]` (`{category, count, matches:
   {card, self?, set?, collectorNumber?, image}[]}`), not the raw
   `CardInteractionCategory[]` — `cardResponse.ts`'s hand-mirrored type
   updated to match (see `cardresponse-hand-mirror-gotcha` topic — checked
   this one specifically).
2. **Self-outline, both panels.** `EnrichedCardInteractionMatch.self` (plain
   name-equality against the viewed card) drives a `ring-2 ring-primary`
   class on the thumbnail `NuxtLink` in the FDN block. Same class was ALSO
   added to the pre-existing FIN `orderedInteractions` panel (keyed off its
   own `m.selfInteraction`, previously tooltip-only) for visual consistency
   across both panels — deliberate, not an accidental generalization; the
   two `self` signals still come from genuinely different plumbing
   (`selfInteraction`'s fact-pair provenance vs. this mechanism's plain name
   check), only the CSS treatment is shared.
3. **Catalog-only, no raw fallback (separate follow-up task, same session).**
   `computeCardInteractions` no longer emits a category for an occurrence
   with no matching `SINK_CATALOG` entry — the old `toSinkQuery`/`labelFor`
   raw-fallback machinery (the `describeFact`-labeled second loop) was
   deleted outright (confirmed nothing else in the repo imported either
   function). Ajani's Pridemate now shows ONLY "Lifegain" (its own baseline
   "enters the battlefield"/"counters" raw categories are gone); Day of
   Judgment shows ONLY "Graveyard fodder" (its "moves to graveyard" raw
   category is gone). A card matching no catalog entry at all now returns
   `[]` — the existing `v-if="fdnInteractions.length"` guard already handles
   that with no template change. `card-interactions.test.ts` updated to
   assert the raw labels' ABSENCE rather than deleting those tests outright.
   `.claude/contracts/card-schema.md`'s own `computeCardInteractions`/
   "CATALOG-FIRST CATEGORIZATION" sections were NOT updated by this agent
   (contracts are the orchestrator's to fix) — flagged back, still describes
   the old "raw fallback + catalog" two-tier design.
