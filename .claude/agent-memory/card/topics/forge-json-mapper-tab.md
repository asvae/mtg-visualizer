# Forge JSON tab (forge-json-mapper experiment output) — 2026-09-19

Added a "Forge JSON" tab to `CardDetailTabs.vue`, next to Card Definition/
Notes/Forge Script, showing a card's own pretty-printed JSON from the
separate, standalone `functional-model/scripts/experiments/forge-json-mapper/`
experiment (a fresh agent's Forge-`.txt`-to-JSON mapper, deliberately built
with zero knowledge of this repo's own `CardDefinition` schema — stays
structurally close to Forge's own file format). That experiment covers
exactly 20 real cards today (FDN collector numbers 1-20) and writes one
`<slug>.json` per card to its own `output/` directory — still UNTRACKED in
git as of this writing (an explicit call left to the user, not committed as
part of this task). This tab is a DIFFERENT view from the existing Forge
Script tab (raw Forge `.txt` DSL text) — this one shows that same script's
JSON transcription.

Not dev-gated, unlike Forge Script: this reads a small, self-contained
directory that's a normal (if today untracked) part of the repo tree, not
the huge gitignored `tmp/mtg-forge/` checkout Forge Script depends on — see
`forge-script-dev-tab.md` for why THAT one needs the dev-only posture; this
one structurally doesn't share the same GPL-exposure concern.

## Slug convention — reused, not re-derived

The mapper's own output filenames (`exemplar_of_light.json`, etc.) follow
the exact same documented Forge filename convention `server/utils/
forgeScript.ts`'s own `slugify` already implements and verifies (lowercase,
strip non `[a-z0-9 ]`, collapse whitespace, join with `_`) — confirmed by
hand against all 20 real output filenames before relying on this, not
assumed. `forgeScript.ts`'s `slugify` is now `export`ed so `server/utils/
forgeJsonMapper.ts` (new) can import it directly rather than risk a second,
drifting copy.

## Pieces (adding a tab value touches several places — see
`notes-tab-and-markdown-view.md` for the general list; same set again here)

- `server/utils/forgeJsonMapper.ts` (new) — `loadForgeJsonMapperOutput(name,
  root?)`: `slugify(name)` + `existsSync`/`readFileSync` against
  `functional-model/scripts/experiments/forge-json-mapper/output/<slug>.json`,
  trimmed raw file content (already `indent=2`-pretty from the Python
  mapper — no re-parse/re-stringify). `null` on no-match, same as every
  other optional per-card field on this route.
- `server/api/card/[set]/[number].ts` — `FunctionalModelData.forgeJsonMapper:
  string | null`. Called from all THREE real construction sites (`fin`
  production/`fmBundle` branch, `fin` dev branch, `loadFdnFunctionalModel`)
  — deliberately NOT `null`-hardcoded on the `fin` branches the way
  `notes`/`pipelineStatus` are, since the lookup itself is plain name-keyed,
  not structurally fdn-only (a future mapper run against `fin` cards would
  "just work" with no code change here).
- `app/lib/cardResponse.ts` — hand-mirrored `CardResponse` type needed
  `forgeJsonMapper` added (the `cardresponse-hand-mirror-gotcha.md` gotcha,
  hit again).
- `app/composables/useGraphStore.ts` — `FUNCTIONAL_MODEL_TABS` needed
  `'forgeJson'` added (the 3rd-place gotcha `notes-tab-and-markdown-view.md`
  already documents).
- `app/components/CardDetailTabs.vue` — `forgeJsonMapperAvailable` computed,
  `FunctionalModelTabItem['value']` union, both `functionalModelTabs`
  branches (fdn/non-fdn), `functionalModelTabValue`'s stored-value fallback
  guard, and the template's own `v-else-if` block (reuses `JsonHighlight`,
  same component the Facts Json/Card Json tabs already use — real syntax
  highlighting, not a plain `<pre>`, since this content genuinely is JSON).

## Verified live

`fdn/11` AND `fdn/733` (both real Exemplar of Light printings — resolution
is name-keyed, collector number doesn't matter) — tab renders, content
byte-identical to the on-disk `exemplar_of_light.json` (diffed directly).
`fin/1` and `fdn/21` (outside the 20-card scope) — no tab, no console/page
errors, confirmed via Playwright against a dev server. `vue-tsc --noEmit`
clean.

## Open item

The mapper's own `output/*.json` files are still untracked/uncommitted —
flagged to the user rather than committed unilaterally (this task's own
instruction). Until they're committed, this tab shows nothing in any
environment that only serves committed files (production, a fresh clone) —
harmless (same "absent = no tab" degrade as everywhere else), but worth
knowing if this feature is ever expected to actually render outside a
dev machine that has the experiment's own local output on disk.
