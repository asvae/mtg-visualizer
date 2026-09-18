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
- **Real, live-verified finding, not a gap to "fix" casually**:
  catalog-first matching in `card-interactions.ts` is PRODUCER-shaped
  (checks if a candidate itself structurally causes the category's
  event) — it does NOT recognize a consumer/want-side card (Ajani's
  Pridemate's own `onLifeGained` trigger) as "owning" a catalog sink.
  Confirmed: `matchSink(lifegainQuery, ajanisPridemate)` is `false`.
  Getting a genuine consumer card into a category needs either trusting
  the free-text `Trigger.name` (declined twice now, same reasoning both
  times) or a real `Trigger.on` vocabulary addition with real engine
  wiring — neither attempted. Don't silently "fix" this with a
  trigger-name lookup table without a fresh, explicit user ruling.
  Server-side consumers of `sink-attachment.ts` (`server/api/fdn-cards/
  [slug]/{review,sinks}.post.ts`, `server/api/card/[set]/[number].ts`,
  `app/lib/cardResponse.ts`, `app/components/CardDetailTabs.vue`) are now
  broken (missing-module typecheck errors) — expected fallout, `card`
  agent's own explicit follow-up, not fixed here.
- **Sink catalog has only 2 real entries** (`lifegain`,
  `graveyard-fodder`, both `blue`) — proving the mechanism, not a real
  catalog yet. Growing it for real FDN authoring is future work.
- **No route serves `computeSinkCatalogStatus` yet** — no `GET`/review
  `POST`, same "scaffolding only" starting point `pipeline-status.ts`/
  `sink-derivation-status.ts` both had before their own review routes
  landed.
- **Third sink-derivation mechanism (Stun counters, Finality counters)
  still has no real predicate module** — stays `gray`. Only `saga`/`crew`
  are real (`blue`).
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
