# FDN / sink-model experiment: still-open items (as of 2026-09-18)

Full design/contract lives in `.claude/contracts/card-schema.md`'s "FDN
authoring-pipeline status" and "Sink CATALOG (shared, reviewed) +
per-card sink ATTACHMENT" sections — read those for the actual shape.
This is only the punch-list of what's genuinely still unbuilt/unresolved
as of the last touch, so a future session doesn't have to rediscover it:

- **Sink catalog has only 2 real entries** (`lifegain`,
  `graveyard-fodder`, both `blue`) — proving the mechanism, not a real
  catalog yet. Growing it for real FDN authoring is future work.
- **No route serves `computeSinkCatalogStatus`/`sink-attachment.ts`
  yet** — no `GET`/review `POST`, same "scaffolding only" starting point
  `pipeline-status.ts`/`sink-derivation-status.ts` both had before their
  own review routes landed.
- **`POST /api/fdn-cards/:slug/review` doesn't check sink-attachment
  completeness before allowing a `yellow`/`green` review outcome** — a
  card could be reviewed `green` without its sink attachment being
  complete. Currently inert (no real FDN card is `yellow`/`green` yet),
  but a real, named gap once one exists. (`pipeline-status.ts`'s own
  `effectivePipelineStatus` DOES fold `blue` down to effective `gray`
  when sink attachment is incomplete — that part is closed; it's
  specifically the review-write gate that doesn't yet also check it.)
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
