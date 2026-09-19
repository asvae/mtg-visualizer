# Compiler-sourced `definition.ts` skips `justification.json` (2026-09-19)

**Mechanism chosen**: a real, closed-union schema field —
`CardDefinition.provenance?: 'forge-json-compiler'` (`card.ts`, right after
`missingSchemaFunctionality`) — set ONLY by `compileForgeCard`
(`functional-model/scripts/forge-json-compiler/compile-forge-card.ts`, the
one real place a `CardDefinition` is ever produced from Forge JSON), never
hand-authored. Chosen over a header-comment-parsed-by-the-gate or a
CASES-table-slug-allowlist because it's checkable directly off the
already-resolved `definition` object `validate-card-definition.mjs`
already has in hand (no extra file read, no coupling the gate to a
test-only case table) and mirrors an existing real precedent in this exact
codebase — `Fact.provenance?: {origin:'parser', rule}` — "absence IS the
signal" for authorship-path tracking.

**Where the exemption is enforced**: `validate-card-definition.mjs`'s Part
1.5 (`isCompilerSourced = definition.provenance === 'forge-json-compiler'`)
skips the `verifyCoverageJustificationForPath` call entirely for such a
card — every other check (vocabulary walk, name-only-trigger /
`missingSchemaFunctionality` capacity-gap checks, scoped `tsc`) still runs
unchanged. `coverage-justification.ts` itself is untouched in substance —
only got a header pointer note for discoverability.

**Deliberately NOT touched**: `pipeline-status.ts`'s fingerprint/
`re-review` mechanism (`computePipelineDefinitionFingerprint` hashes the
WHOLE raw file, provenance-agnostic) — verified live (ad hoc script, not
checked in) that marking a compiler-sourced card `green` then editing its
`definition.ts` content correctly flips `effectivePipelineStatus` to
`re-review`, identical to any hand-authored card.

**Result**: re-ran `author-fdn-definitions.ts --all-blue` (regenerates all
23 known-compiled FDN-1-50 cards wholesale, baking the new `provenance`
field into each) then `gate-and-write-status.mjs` for those same 23 slugs
— all 23 land `blue`. Skyship Buccaneer / Vanguard Seraph specifically
confirmed `blue` via the live `/api/card-status/fdn` API (they were the 2
gray-in-FDN-1-50 cards that were actually compiler-covered) — neither has
a `justification.json` file at all (that's WHY they were gray before this
task; the other 21 compiler-sourced cards each still have a real,
already-reconciled `justification.json` on disk from the earlier
2026-09-19 file-replacement pass, which the gate now simply never reads
for them — harmless/inert, not deleted, not required to be). The other 5
gray FDN-1-50 cards (crystal-barricade, herald-of-eternal-dawn,
squad-rallier, twinblade-blessing, valkyrie-s-call) are untouched — their
`pipeline-status.json` diffs are pre-existing `computedAt`-only bumps from
an earlier, unrelated pool-wide `--all` regate this session inherited, not
from anything in this task.

**Open follow-up, not done (flagging, not doing unprompted)**: the 21
compiler-sourced cards' now-inert `justification.json` files could be
deleted for cleanliness (the gate never reads them for a
`provenance:'forge-json-compiler'` card anymore) — left in place since
removing checked-in authored files wasn't asked for and isn't harmful.

**Note for whoever next touches `forge-json-compiler/`**: the whole
`functional-model/scripts/forge-json-compiler/` directory is still
UNTRACKED in git (`git status` shows `??`, never `git add`ed since its
promotion out of `scripts/experiments/`) — my edit to
`compile-forge-card.ts` (adding the `provenance` field to
`compileForgeCard`'s return) lives only in that untracked working file.
Not committed as part of this task (no commit was requested).

**Pre-existing, unrelated issues found while verifying (NOT caused by this
task, not fixed)**:
- `functional-model/card.ts:3896` — `synergyTags`'s exhaustive switch is
  missing a `case 'endTurn':` branch (real `Effect.kind` used elsewhere in
  the file, e.g. `applyEffect`'s own `case 'endTurn'` at line ~3744) — a
  real `tsc` diagnostic, already present in the dirty working tree before
  this task started, unrelated to anything here. Flagging for whoever owns
  that in-flight work (not attributed to an `ENGINE_GAPS.md` entry — this
  is a schema/synergyTags completeness gap, not an engine-runtime one).
- `functional-model/card-interactions.test.ts` — one pre-existing failing
  test ("Ajani's Pridemate gets a 'Lifegain' category... it DOES self-
  display AND self-match '+1/+1'") — `card-interactions.ts`/its test file
  were already dirty (uncommitted) before this task, part of a concurrent
  session's in-flight CountersSink/matcher work (matches recent commits
  "Fix CountersSink false positive...", "counters.test.ts: drop
  hand-authored mocks..."). Untouched by this task.
