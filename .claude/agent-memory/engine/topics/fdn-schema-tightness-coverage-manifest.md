# FDN schema-tightness redesign: `missingSchemaFunctionality` + `coverageJustification` (2026-09-18)

Supersedes `fdn-static-abilities-gate-rule.md` in SUBSTANCE (kept, not
deleted — it's the historical record of the investigation that concluded a
general oracle-text-vs-definition coverage check isn't gate-feasible; THIS
task is the user's direct response: author writes the reasoning down
explicitly instead of the gate inferring it). FDN-pipeline-scoped only, same
as every prior rule here — FIN (`functional-model/cards/`) untouched,
`staticAbilities` stays in `card.ts` for FIN's 98 real uses.

**Two new, purely additive `CardDefinition` fields** (`card.ts`, right
before the closing brace, after `authoredFacts`):
- `missingSchemaFunctionality?: {clause: string; demand: string}[]` — the
  ONE sanctioned place to declare a real, printed clause the schema can't
  express (replaces the informal `staticAbilities`-as-gap-marker
  convention).
- `coverageJustification?: {clause: string; coveredBy: CoverageReference;
  reasoning: string}[]` — per-clause written "this text is covered by this
  code" reasoning. `CoverageReference` is a CLOSED union (`keyword`/
  `trigger`/`ability`/`effect`/`field`/`missingSchemaFunctionality`/
  `staticAbilities` kinds, each a structural lookup key, never a bare
  judgment string) — `CoverageFieldName` is a second closed union for
  fields whose mere presence conveys coverage. Both unions grow on demand.
  `reasoning` is free prose BY DESIGN (the user's explicit ask); the
  tightness constraint is on the pointer shape, not on banning prose.

**Redefined gate** (`functional-model/scripts/validate-card-definition.mjs`):
- `staticAbilities` presence in an FDN card is now `failureKind:'other'`
  (hard block, checked FIRST) — NOT a capacity gap anymore. Checked
  against the real pool: zero genuinely rules-irrelevant flavor-text uses
  existed among the 22 real pre-existing entries, so keeping the field
  usable would reopen the exact looseness this redesign closes.
- `missingSchemaFunctionality` presence is the direct structural successor
  to the retired `staticAbilities`-presence rule (same capacity-gap
  bucket).
- New `validateCoverageJustification` — mechanical-only (never semantic):
  manifest present/non-empty per face, every entry has real
  `clause`/`reasoning` text, every `coveredBy` pointer RESOLVES against the
  same `CardDefinition`, and every real `missingSchemaFunctionality` entry
  is referenced by at least one manifest entry. Declined the "entry count
  ≈ real oracle-clause count" heuristic — no `oracleText` field exists on
  `CardDefinition` and the ad hoc `.fdn-scratch/<slug>/scryfall.json` cache
  isn't guaranteed present pool-wide.
- New `failureKind: 'incomplete-authoring'` → `pipelineStatusFromGateResult`
  maps it to `status: 'gray'` (`pipeline-status.ts`) — a real, intentional
  widening (that function previously only ever wrote `blue`/`purple`).
  Reasoning: `gray`'s pre-existing meaning ("ready for agent work, hasn't
  been attempted") already fits "no manifest yet" exactly.
- Redefined bar: `purple` = structural/vocab valid + real manifest
  (regardless of `missingSchemaFunctionality`); `blue` = purple's bar +
  zero `missingSchemaFunctionality` entries.

**Migration**: all 22 real pre-existing `staticAbilities` entries (not
~40 — that was the task brief's own estimate; 22 confirmed via a live
sweep) across 20 FDN cards moved to `missingSchemaFunctionality`, same
content reshaped. 2 entries were NOT migrated as gaps (found already
covered while re-checking): Inspiring Paladin's own first ability
(genuinely covered by `continuousKeywordGrants`) and Twinblade Blessing's
"Enchant creature" (genuinely covered by its own attach effect's
`.filter(isCreature)`) — both removed outright instead.

**New Arahbo-class silent gap found, NOT fixed**: `skyknight-squire`'s own
`onEnter` trigger has the same under-scoped "fires for self ETB only, text
says another creature" problem as Arahbo — but it was only ever a CODE
COMMENT, never declared via `staticAbilities`, so this task's own
migration-only scope didn't touch it. Needs the same `missingSchemaFunctionality` treatment in a future pass.

**5-card POC** (hand-written real `coverageJustification` manifests):
`felidar-savior`/`claws-out` → `blue` (zero gaps); `sire-of-seven-deaths`/
`arahbo-the-first-fang`/`inspiring-paladin` → `purple` (real, reasoned-about
gaps). Full-pool retrofit explicitly out of scope. Verified pool-wide via
`gate-and-write-status.mjs --all`, exit 0: **2 blue / 3 purple / 95 gray /
0 other / 0 missing-file** — the honest "5 ready, ~95 not yet retrofitted"
state, not papered over.

Full writeup, including the exact migrated clause/demand text per card:
`.claude/contracts/card-schema.md`'s own "FDN foundational schema-tightness
redesign" section (bottom of file).

**Flagged, not fixed (UI/card-owned)**: `app/lib/pipelineStatus.ts`'s
`gray` label is `'Not started'` — still roughly accurate for the new
"incomplete-authoring" meaning but may deserve a wording refinement later;
`CardDetailTabs.vue` already renders `pipelineStatusEntry.reasons`
generically for any status, so the new non-empty-`gray`-reasons case
already displays correctly with zero code changes needed there.

## SUPERSEDED same day, later still: `coverageJustification` moved out to a real, span-verified `justification.json`

The inline `CardDefinition.coverageJustification` field described above
(checked only for presence + `coveredBy`-pointer resolution) is GONE —
retired outright, per the user's own direct follow-up ask ("provide
coverage justification as a separate file... run a script (no ai) against
original card description and ensure nothing is lost"). Replaced by:

- **`functional-model/coverage-justification.ts`** (new module) —
  `CoverageReference`/`CoverageFieldName` relocated here unchanged from
  `card.ts` (which now has NO coverage-justification type at all;
  `missingSchemaFunctionality` itself is UNCHANGED, still inline).
  `CoverageJustificationEntry` is a genuinely different shape now:
  `{type:'definition'|'rules'|'lore', textLocation:'oracle_text'|
  'type_line', face?, spans:[CoverageSpan,...], definitionKeys?, reasoning}`
  — `CoverageSpan = {from,to,text}`, a real half-open character range PLUS
  the exact substring there, hard-verified byte-for-byte against real text
  (no more free-text `clause`). `spans` is an ARRAY (multi-span entries are
  real and required — Arahbo's own "Whenever Arahbo [gap] enters, create a
  token" needs two disjoint spans under one entry, not one span spanning
  the uncovered middle). `type:'lore'` = reminder/flavor text, no
  `definitionKeys`, but still needs a real verified span (counts toward
  coverage, doesn't get a free pass). The real orchestrator,
  `validateCoverageJustification(definition, entries, texts)`, does a real
  interval-tiling pass proving every non-punctuation/non-whitespace
  character of the real `oracle_text` (per face) is claimed by EXACTLY one
  entry — genuinely stronger than the old presence-only check.
  `type_line` full-coverage is deliberately NOT required (mechanically
  trivial, no authoring effort possible to skip) — spans there are still
  exact-match/overlap-checked when authored, just optional.
- **Durable ground truth: new, checked-in `data/fdn/fdn_scryfall.json`**
  (mirrors `data/fin/fin_scryfall.json` exactly) — NOT the gitignored
  `.fdn-scratch/<slug>/scryfall.json` or the gitignored `data/cards.db`
  (both confirmed unsafe as a gate-time input by tracing where FDN's
  served oracle text actually comes from today,
  `server/api/card/[set]/[number].ts`'s `fdn` branch). New
  `functional-model/scripts/sync-fdn-oracle-text.mjs` populates it —
  ZERO live Scryfall calls, reads only the already-bulk-synced local
  `data/cards.db` (does NOT reopen `sync-card-db.mjs`'s own documented
  "why this project moved off ad hoc per-set live-fetched JSON snapshots"
  concern — this is a narrow, incremental, purely-local EXTRACT of the
  small FDN-pipeline subset, not a live-fetch reintroduction). Run for the
  whole current pool: 100/100 resolved, 0 missing.
- **New scripts**: `verify-coverage-justification.mjs` (reusable core,
  `verifyCoverageJustificationForPath`/`verifyCoverageJustificationForSlug`)
  + sibling `-cli.mjs` (same reusable/CLI split `validate-card-
  definition.mjs` already established, same vite-node-argv reason).
  `validate-card-definition.mjs`'s own Part 1.5 now calls
  `verifyCoverageJustificationForPath` instead of the retired inline-field
  function — same position/semantics (`incomplete-authoring` -> `gray` on
  failure), just a genuinely stronger real check underneath.
- **5 POC cards migrated to real `justification.json` files**, spans
  computed+verified against the real `data/fdn/fdn_scryfall.json` text
  (not hand-typed). **Same pool-wide outcome under the stricter bar**: 2
  blue / 3 purple / 95 gray / 0 other / 0 missing-file — identical to the
  presence-only bar. One real, honest correction found while authoring:
  `sire-of-seven-deaths`'s prior code comment wrongly claimed its printed
  keyword line was one comma-separated line; the real text is 4 separate
  lines — fixed while authoring the real manifest.
- **Real bug found+fixed mid-task** (caught by a unit test, not by luck):
  the first implementation only checked `(face, textLocation)` pairs with
  at least one entry — a real `backFace` with ZERO `justification.json`
  entries for its own oracle text was silently treated as "nothing to
  check" instead of "100% uncovered." Fixed to always check `oracle_text`
  per face regardless of entry count; `type_line` correctly keeps its
  "only checked when claimed" behavior (it's optional).

Full writeup: `.claude/contracts/card-schema.md`'s own "`justification.json`
redesign" section (bottom of file, dated 2026-09-18, later still).
