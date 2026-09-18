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
