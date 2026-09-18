# Forge Script tab (dev-only, live-read from local checkout)

2026-09-19. Card page's "Forge Script" tab — shows the REAL Forge card
script for the card being viewed, next to "Card Definition", for the same
kind of manual Forge-verification work `engine`/schema sessions were doing
by hand. Deliberately re-raises the `forge-model/`/`ForgeCardScript.vue`
GPL-3.0-exposure deletion (`topics/forge-model-deletion.md`) — flagged to
the orchestrator before building anything, per that file's own closing
note; user confirmed directly ("could live in gitignored tmp folder").

**Why this design doesn't repeat the GPL exposure**: the deleted
`forge-model/` copied verbatim Forge card scripts INTO this repo (committed
to git, shipped in the bundle/history regardless of environment — the
actual exposure). This tab never persists or bundles anything — it reads
live, on request, from the local gitignored `tmp/mtg-forge/` checkout
(~816M, dev-machine-only, per `.claude/ORCHESTRATOR_PRIMER.md`), and is
hard-gated to dev in two independent places: the server route itself
(`server/utils/forgeScript.ts`'s `loadForgeScript` refuses outright when
`process.env.NODE_ENV === 'production'`) and the client tab's own existence
(`CardDetailTabs.vue`'s `forgeScriptAvailable`, gated on `import.meta.dev`
AND the route reporting a checkout is present).

**Pieces**:
- `server/utils/forgeScript.ts` — `loadForgeScript(cardName)`, same
  dev-only posture/doc-comment convention as `fdnDefinitionPool.ts`. Slug
  algorithm confirmed against real checkout content (not just the docs'
  stated convention): lowercase, strip everything but `[a-z0-9 ]`, collapse
  whitespace, join with `_` — apostrophes/commas/`//` are DROPPED outright,
  not replaced (verified against `Kongming's Contraptions` ->
  `kongmings_contraptions.txt`, `Kefka, Court Mage // Kefka, Ruler of Ruin`
  -> `kefka_court_mage_kefka_ruler_of_ruin.txt`). A derived candidate is
  always verified against the file's own `Name:` line before being
  trusted; falls back to scanning the rest of that same first-letter
  directory for a real match. Discriminated `ForgeScriptResult` return
  (`available`/`found`/`content`/`path`, or an `unavailable` variant with a
  `reason`) — never throws for a genuine no-match, that's an expected,
  common outcome (not every FDN/FIN card is 1:1 in this local checkout).
- `server/api/forge-script/index.get.ts` — thin wrapper, `?name=` QUERY
  param (not a `[name].get.ts` dynamic segment — a real card name can
  contain `/`, e.g. an MDFC's combined name, which a path segment can't
  carry).
- `CardDetailTabs.vue` — new `'forgeScript'` value threaded through
  `FUNCTIONAL_MODEL_TABS` (`useGraphStore.ts`), `FunctionalModelTabItem`,
  `functionalModelTabs`, `functionalModelTabValue`'s fallback logic (both
  the FDN "force back to definition" guard and the stale-stored-value
  guard needed a `'forgeScript'` carve-out, same shape as the existing
  `'scenarios'` one). Fetched via a cached `$fetch` (not `useFetch`) keyed
  by `card.value.name`, watched with `{ immediate: true }`. Rendered as a
  plain `<pre>` (real Forge DSL, not TypeScript — deliberately NOT run
  through `FunctionalModelScript.vue`'s hljs-typescript highlighter).

**Live-checked, surprising finding**: the local `tmp/mtg-forge/` checkout on
this dev machine is unusually current — it already includes real Forge
scripts for FIN (`Summon: Bahamut`) and FDN (`Fishing Pole`, `Icewind
Elemental`, etc.) cards, not just older sets. Every real card name tried
during verification (`Exemplar of Light`, `Fleeting Flight`, several
others) resolved successfully; the not-found rendering path was verified by
intercepting the client fetch in a Playwright test harness (not a real
gap), not by finding a genuine missing card. If a genuinely-missing card
ever turns up, the existing "No Forge script found..." message is real and
already correct.

**Unrelated gotcha hit while verifying (not this task's bug)**: a
concurrent session's mid-save state of `functional-model/card.ts` briefly
broke the whole dev-server client bundle (`triggerActivationLimit` export
momentarily missing, causing Vue Router init to fail app-wide) — caught
via a stale Vite `@fs` transform pinned to an old `?t=` timestamp that
didn't get invalidated even after the file stabilized. Resolved by
restarting the dev server (not a fix to any project file). Worth knowing
if a future session hits an inexplicable "does not provide an export"
error against a file another concurrent agent is actively editing — try a
plain dev-server restart before assuming it's a real bug.
