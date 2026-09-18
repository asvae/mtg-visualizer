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
