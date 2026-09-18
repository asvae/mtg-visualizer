# FDN cards render a structurally different page than FIN cards

FDN (`functional-model/fdn-cards/<slug>/`) is a separate, newer card corpus
with no `synergy.json`/Facts data at all — structurally, not just
incompletely. `CardDetailTabs.vue` branches on `isFdn` (`props.set ===
'fdn'`) throughout:

- **No Facts tab, no Facts/Card Json tabs** (both are tied to
  `synergy`/`annotatedCard`, always null for `fdn`). Tab strip narrows to
  `Scenarios? / Sinks / Card Definition` (Scenarios only shown once a real
  `scenarios.ts`/trace exists for that card — omitted entirely, not shown
  empty, when trace count is 0, same rule now applied to FIN too).
- **Oracle text is plain, not annotated**: `FunctionalModelData.oracleText:
  string | null` (real for `fdn`, always `null` for `fin`) renders via a
  new, deliberately minimal `app/components/PlainOracleText.vue` (one prop,
  one `<p class="whitespace-pre-wrap">`, no spans/hover/click — NOT a
  retrofit of `FunctionalModelText.vue`, which hard-depends on
  `annotatedCard`/`Fact.annotations` that FDN structurally never has). The
  two are mutually exclusive and sit in the same template slot.
- **Review axis is `pipeline-status.json`, not Facts/Scenarios/
  Interactions `progress.json` fields**: a pipeline-status bucket
  (`gray`/`purple`/`blue`/`yellow`/`green`/`re-review` — see
  `functional-model/pipeline-status.ts`, `PIPELINE_STATUS_META` in
  `app/lib/pipelineStatus.ts`) with Confirm/"Reject…" buttons
  (`POST /api/fdn-cards/:slug/review`). **One-way only**: `applyPipelineReview`
  has no `verdict: null`/clear-review case, so there is no Unconfirm
  affordance on this axis (unlike every other review axis in the app) —
  don't add one without confirming the server route actually supports a
  reverse transition first.
- Confirm/Reject gates on effective status `=== 'blue'` **only**, not
  `blue`-or-`re-review` — a drifted `re-review` card must go back through
  the authoring pipeline to become fresh `blue` again before it can be
  directly re-confirmed; the server 400s a `re-review` confirm attempt too.
  Don't assume the "re-review always confirmable" pattern the FIN
  card-status buckets use (see `topics/card-status-bucket-system.md`)
  carries over here — it doesn't.
- **No per-card sink-attachment tab/persistence exists (2026-09-18,
  tried-then-reverted, see below).** Sinks are computed LIVE against real
  `CardDefinition`s now — `functional-model/card-interactions.ts`'s
  `computeCardInteractions` — never stored per-card. The FDN tab strip is
  back to `Scenarios?`/`Card Definition` only.
- Both `FunctionalModelData` (server) and its hand-mirrored client type
  `app/lib/cardResponse.ts` need every new FDN-only field added to both —
  see `topics/cardresponse-hand-mirror-gotcha.md`, this has been missed
  before (found again 2026-09-18: `reviewCaveat` was already being read off
  `props.data` in `CardDetailTabs.vue` but was never in the hand-mirrored
  type at all — fixed alongside the sink-attachment revert-fixup).

The full authoritative shape lives in `.claude/contracts/card-schema.md`'s
FDN sections ("FDN authoring-pipeline status", "Sink CATALOG...",
"computeCardInteractions") — read those instead of `functional-model/
pipeline-status.ts` source when only the shape is needed (`sink-attachment.ts`
itself no longer exists at all).

See `topics/fdn-interactions-wiring.md` for the real, wired-up
`computeCardInteractions` → server → `CardDetailTabs.vue` Interactions
section (2026-09-18, follow-up to the attachment revert).
