# FIN card-status dashboard: bucket system + live computation

Distinct from FDN's `pipeline-status` axis (`topics/fdn-vs-fin-card-model.md`)
— this is the fact-authoring-completeness dashboard for FIN cards
(`/app/status` grid, the small colored square next to the Facts tab label
in `CardDetailTabs.vue`). Full authoritative bucket list/semantics/color
values live in `.claude/contracts/card-schema.md`'s "Per-card dashboard
status" section — read that instead of re-deriving it; it has been kept
current through several bucket additions (`verified`, `uncertain`,
`re-review` were each added as narrowings of `green`, in that priority
order, most-recently as of this writing an 8-value union).

**Standing conventions worth knowing before touching any of this:**

- The `CardStatusBucket` union is **deliberately duplicated as a literal
  copy across 3 files** — `functional-model/card-status.ts` (engine,
  source of truth), `app/lib/cardStatus.ts`, and `app/pages/app/status/
  index.vue` — never imported across the engine/card boundary. Adding a
  new bucket means updating all 3 by hand (plus `CARD_STATUS_META`/
  `STATUS_META`/`STATUS_ORDER` in the two `app/` copies). `CardDetailTabs.
  vue`'s own badge indexes `CARD_STATUS_META[status]` generically and has
  needed zero changes across every bucket addition so far — don't assume a
  new bucket needs a code change there too, check first.
- A bucket-narrowing field (e.g. `reviewCaveat` for `uncertain`) does not
  necessarily become its own field on the served `CardStatusEntry` —
  `reviewCaveat` specifically is folded (truncated to 200 chars) straight
  into the existing `reasons` string, no sibling field at all. Check the
  real classifier output shape before assuming a new narrowing field is
  independently served.
- **Status is computed LIVE, per request, not read from a stale batch
  file** — both the single-card route (`server/api/card/[set]/[number].ts`
  → `computeCardStatusLive`) and the grid route
  (`server/api/card-status/[set].get.ts` → `computeAllCardStatusLive`)
  spawn the real classification scripts fresh in dev (see
  `topics/nitro-mjs-import-gotcha.md` for why that's a subprocess spawn,
  not a plain import). Production falls back to the committed
  `data/fin/fin_card_status.json` / `fmBundle` (see
  `topics/prod-functional-model-bundle.md`) — same staleness contract as
  everything else in that bundle. Measured cost: ~1.2-1.3s for the whole
  ~300-card FIN pool in one process — fine for a live per-request grid
  load; do NOT spawn one subprocess per card (that shape is far slower,
  already measured as clearly worse).
- A same-tab, no-persistence optimistic overlay (`app/composables/
  useReviewStatusBus.ts`, set+number keyed, not slug — the generated
  status entries have no slug field to match on) lets a Confirm/Unconfirm
  click update both the clicking component's own badge AND a
  concurrently-mounted status-grid square immediately, without a refetch.
  It only ever narrows within the green/verified/uncertain/re-review
  family — never invents a downgrade to yellow/orange/red/gray locally.
  Cross-tab sync and page-reload persistence are explicitly out of scope
  (falls back to the server's authoritative live/batch value on reload).
