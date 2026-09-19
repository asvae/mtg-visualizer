# Forge Compiler tab (forge-json-compiler experiment, live-computed) — 2026-09-19

`CardDetailTabs.vue`'s "Forge Compiler" tab surfaces the separate
`functional-model/scripts/experiments/forge-json-compiler/` experiment (a
deterministic Forge-JSON -> real `CardDefinition` compiler, deliberately
narrow — recognizes ONLY the exact real Forge shapes each allowlisted card
needs, throws `UnsupportedForgeShape` on anything else, NOT wired into any
pipeline). **Current scope, final (2026-09-19, several corrections same
day): compiled-or-not only.** Earlier same-day passes of this tab also
diffed the compiled output against each card's real hand-authored
`fdn-cards/<slug>/definition.ts` and showed "EXACT STRUCTURAL MATCH"/a diff
— that comparison was explicitly DROPPED mid-task per direct user
correction ("don't care about diffing against the pipeline-authored
reference at all, just compiled-or-not"). Don't re-add it without a fresh
explicit ask; if a future session finds git history mentioning
`exactMatch`/`diffLines` on this tab, that's this now-reverted design, not
a bug.

## Allowlist: 23 cards (1 hand-added + 22 from a shared data module)

`server/utils/forgeJsonCompiler.ts`'s `SUPPORTED_CARDS` is a
`Record<lowercasedName, {forgeJsonFile}>`. Two sources folded together:
- `'exemplar of light'` — hand-added, the original single card this whole
  tab started from (FDN #11). Not part of the table below — that table's
  own `fdn_scryfall.json` subset selection skips FDN #11.
- Everything in `functional-model/scripts/experiments/forge-json-compiler/
  fdn-1-50-cases.ts`'s exported `CASES` array with `status !== 'gray'` (22
  cards) — a NEW, shared, non-test data module (`CASES`+`TOKEN_SCRIPT_IDS`)
  extracted OUT of that dir's own `fdn-1-50.test.ts` specifically so this
  tab's allowlist and that test's regression guard read the SAME data,
  never a second hand-copied list. `CompileStatus` there is `'gray' |
  'blue'` (schema agent simplified it from an original 4-state gray/blue/
  green/yellow scheme the same day, once the diff-comparison requirement
  was dropped — `'blue'` there means the same thing this tab's own `blue`
  badge state means: compiles clean). Own regression test:
  `fdn-1-50.test.ts`, 52 tests, all passing.

The definition module's own export symbol name is never consumed by this
tab anymore (dropped along with the diff) — no `Object.values(module)[0]`
lookup left in `forgeJsonCompiler.ts`.

**Real bug caught while widening to 22, not by inspection**: several of
the newly-added cards (Cat Collector, Guarded Heir, ...) have `Token`
effects whose Forge JSON `SVar` names a real `res/tokenscripts/<id>.txt`
id — `compileForgeCard`'s 2nd param (`tokenScripts`) must have that id
pre-resolved or it throws `UnsupportedForgeShape`, exactly like
`fdn-1-50.test.ts`'s own `loadTokenScripts(TOKEN_SCRIPT_IDS)` setup. First
pass here called `compileForgeCard(forgeJson)` with no 2nd arg (silently
defaults to `{}`) — broke every token-needing card with a real, correct
`error` result, easy to miss without spot-checking EVERY allowlisted card,
not just 1-2 "obviously simple" ones. Fixed: `forgeJsonCompiler.ts` now
lazily loads the same `TOKEN_SCRIPT_IDS` via `loadTokenScripts()` once
(module-level cache), wrapped in try/catch so a missing local
`tmp/mtg-forge/` checkout degrades every token-needing card to a reported
error rather than crashing the whole module at import time. **Lesson: when
reusing a compiler's own test corpus for a new consumer, check what
auxiliary inputs the test harness passes besides the raw JSON.**

## Why this doesn't follow the Forge JSON Mapper precedent

Forge JSON Mapper's tab (`topics/forge-json-mapper-tab.md`) reads a
precomputed on-disk `output/<slug>.json` file — no computation at request
time, baked into `FunctionalModelData`/`cardResponse.ts` like every other
plain per-card field. This experiment has NO precomputed output — the
server must actually RUN `compileForgeCard()` live, per request. Followed
the **Forge Script** tab's shape instead (`topics/
forge-script-dev-tab.md`): a separate dev-gated endpoint fetched client-side
via a cached `$fetch` (not baked into the main card route/`cardResponse.ts`
at all — avoids the hand-mirror gotcha entirely), watched on
`card.value.name` with `{ immediate: true }`.

## Availability split — general vs per-card, deliberately NOT hidden per-card

Unlike Notes/Forge JSON Mapper (tab hidden entirely when a card has no
data), this tab stays visible dev-wide (like Forge Script's own
`available`/`found` split) and shows its OWN inline "Not available for this
card" state for every unsupported card, rather than disappearing.
`forgeCompilerAvailable` (gates tab existence) reads only the GENERAL
dev-only signal (`result.available`), not the per-card `result.supported`
— mirrors `forgeScriptAvailable` reading `.available` not `.found`.

## "Compiler cross-check" badge — 2 states (gray/blue), NOT the same axis/colors as pipeline-status

A small dot+label row ("Compiler cross-check: <label>") renders inside the
tab content (not the page header), computed live from `forgeCompilerResult`:
- **gray** ("Does not compile") — unsupported card, a genuine compile
  error, still loading, or `forgeCompilerAvailable` is false. All collapse
  together; this badge does NOT distinguish "why."
- **blue** ("Compiles clean") — `supported && compiledJson` present. This
  is the ENTIRE success state now that the diff comparison is gone — no
  green/yellow split.

Deliberately NOT the same hex values `STATUS_OPTIONS_FDN`
(`app/pages/app/engine/cards/[set]/[[number]].vue`) uses for the real
pipeline-status badge, even though both use gray/blue naming — that badge
renders in this same page's header and stays on screen while this tab is
open, so an identical-hex second badge would read as the same signal at a
glance (explicit user correction). Used one Tailwind hue step off each
pipeline color instead: slate `#94a3b8` (not gray `#6b7280`), sky `#0ea5e9`
(not blue `#3b82f6`). **Generalize this "same family, different hue, never
identical hex" rule to any FUTURE second badge that reads on the same
page/screen as an existing one.**

## Pieces (current, post-simplification)

- `functional-model/scripts/experiments/forge-json-compiler/
  fdn-1-50-cases.ts` — shared `CASES`/`TOKEN_SCRIPT_IDS` data (schema-owned
  content, card-agent-owned as a second consumer).
- `server/utils/forgeJsonCompiler.ts` — `loadForgeJsonCompilerResult
  (cardName, root?)`. `SUPPORTED_CARDS` name-check BEFORE ever calling the
  compiler (unsupported card never reaches `compileForgeCard`/its
  `UnsupportedForgeShape` throw). `NODE_ENV === 'production'` refuses
  outright. **2026-09-19 update, same day**: no longer a plain in-process
  dynamic `import()` — a same-day schema-agent change gave
  `compile-forge-card.ts` a genuine runtime `import ... from
  '../../combinator'`, breaking the "types only" assumption this bullet
  used to describe. Now spawns a thin wrapper script,
  `functional-model/scripts/forge-json-compiler/compile-one-card.mjs`
  (modeled on `run-one-card.mjs`), under `vite-node` via `execFileAsync` —
  same fix `loadCardDefinitionDev`'s own `vite-node`-requiring case already
  used. See `topics/nitro-mjs-import-gotcha.md`'s 2026-09-19 update for the
  full incident writeup.
- `server/api/forge-json-compiler/index.get.ts` — thin `?name=` query
  wrapper, same shape as `server/api/forge-script/index.get.ts`.
- `app/composables/useGraphStore.ts` — `FUNCTIONAL_MODEL_TABS` has
  `'forgeCompiler'`.
- `app/components/CardDetailTabs.vue` — fetch/cache block mirroring
  `forgeScriptResult`'s shape, `forgeCompilerAvailable`/
  `forgeCompilerCrossCheckStatus` computeds, `FunctionalModelTabItem`
  union entry, template `v-else-if` (badge row + `JsonHighlight` for the
  compiled JSON only, no diff rendering).

## Verification note — could NOT confirm via a live route hit this pass

Found a pre-existing, environment-wide Nitro dev-bundler bug (`Cannot
access 'index_get$b' before initialization`, or `$7`/`$9` etc.) breaking
EVERY `server/api/**/index.get.ts` route on this dev machine (confirmed on
both the already-running shared dev server AND a fresh isolated `--port
3211` instance pointed at the same `.nuxt/` build) — `/api/forge-json-
compiler`, `/api/forge-script`, `/api/keywords` all 500 this exact way;
`/api/docs` (also `index.get.ts`) and dynamic-segment routes (`/api/card/
fdn/1`) are unaffected — specific to SOME subset of `index.get.ts` files
colliding in the Nitro chunk-naming scheme, not a `.ts`-vs-`.mjs` import
issue. NOT caused by this task's own files (none are named `index.get.ts`;
`/api/keywords`, untouched by this task, fails identically) — flagged to
the orchestrator as a `server`-domain build issue, not fixed here. If it's
still present on the NEXT card-tab task, re-flag rather than assuming it's
someone else's already-fixed issue.

Verified this task's actual logic correctness instead via direct
in-process calls to `loadForgeJsonCompilerResult()` (vite-node) across all
23 `SUPPORTED_CARDS` entries (Exemplar of Light + the 22-card table): all
23 report `compiledJson` present (blue), 0 errors; 2 known-unsupported
names correctly report `supported: false` (gray).

## Open item

This whole tab only ever shows real content in an environment with the
sibling forge-json-mapper experiment's own untracked `output/<slug>.json`
files on disk (a dev machine that has run that experiment) — degrades to
the module's own `error` state (not a crash) anywhere else, including a
fresh clone.
