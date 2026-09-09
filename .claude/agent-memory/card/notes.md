# card agent notes

Scoped working memory for the `card` specialist. Update before finishing
any task: decisions made, open questions, current state worth resuming
from. This is what makes a fresh respawn cheap — don't rely on transcript
resume alone (session transcripts are swept after ~30 days).

## Decisions

- 2026-09-07: Fixed prod 500 on POST /api/card/fin/1 (Netlify Function
  ENOENT scandir '/var/task/functional-model'). Root cause:
  `server/api/card/[set]/[number].ts`'s `loadFunctionalModel` (added in
  d9f749e, "compute functional-model traces live") does raw
  `fs.readdirSync`/`readFileSync` against `functional-model/` and spawns
  `node_modules/.bin/vite-node` as a child process to actually execute a
  card's `scenarios.ts`/engine core, at request time. None of that ships
  in a Netlify Function bundle (Nitro's Rollup bundler only ships files it
  can statically trace as imports; `functional-model/`'s raw .ts sources
  and the vite-node dev binary are read/spawned dynamically, never
  imported). Every OTHER functional-model/ fs access in this route family
  already tolerated a missing dir via try/catch (`loadFunctionalModelPool`
  → `[]`, `loadCardSynergy` → `null`, `review-status.ts`'s explicit
  `NODE_ENV==='production'` 403 guard) — `sharedEngineSignature`'s
  `readdirSync` was the one place that didn't, called BEFORE
  `loadFunctionalModel`'s own try/catch even started.
  Fix: `loadFunctionalModel` now returns `null` outright when
  `NODE_ENV==='production'`, same convention/comment style as
  `review-status.ts`. Also hardened `sharedEngineSignature` itself with a
  try/catch (defense in depth) in case it's ever called from a path that
  isn't NODE_ENV-guarded. Frontend already renders `functionalModel: null`
  as the normal "no functional-model entry for this card yet" state
  (`v-if="data?.functionalModel"` in
  `app/pages/app/card/[set]/[number].vue`) — this is the same common case
  corpus-wide (most cards don't have a functional-model entry), so no UI
  change needed.
  Validated: `npm run build` (nitro netlify preset) + directly invoking the
  built `.netlify/functions-internal/server/main.mjs` handler with
  `NODE_ENV=production` and a real `Request` — confirmed 200 (not 500),
  `functionalModel: null`, `interactions` still populated (that path was
  never broken, already try/catch-safe). Also confirmed via grep that
  `sharedEngineSignature`/`vite-node`/`computeTracesLive` are fully
  dead-code-eliminated out of the production bundle entirely (Vite/Rollup
  statically resolves `process.env.NODE_ENV === 'production'` to `true`
  at build time and DCEs the unreachable branch) — the crash source isn't
  just runtime-guarded, it's physically absent from what ships. Confirmed
  local dev (`npm run dev`, already-running port 3000) still returns full
  `functionalModel` data (traces/source/synergy) unchanged.

- Known, separate, NOT fixed here (flagged, not this hotfix's job):
  `server/utils/functionalModelPool.ts`'s own comment already admits this
  — even though it degrades gracefully (empty pool) rather than crashing,
  the whole Interactions cross-card panel and this card's own synergy
  overlay are effectively **disabled in production** once
  `functional-model/` genuinely isn't in the deployed bundle (confirmed:
  real Netlify deploy won't have the dir at all, unlike my local
  `npm run build` test above where the dir was still on disk from repo
  root — that only proved the DCE/guard works, not that the pool actually
  gets real cards on Netlify). Restoring real production coverage would
  need bundling the committed per-card `synergy.json`/`trace.json`/
  `progress.json` (e.g. Nitro `serverAssets`) and rewriting every reader
  (this route + `functionalModelPool.ts`) off raw `fs`/dynamic `import()`
  onto Nitro's storage API — `definition.ts`'s dynamic import in
  particular has no clean Lambda-compatible equivalent (raw TS source,
  not a bundle-traceable import). Real follow-up, own decision, not
  smuggled into this hotfix.

- 2026-09-07 (follow-up to the above): real fix — functional-model data now
  actually serves in prod, not just null. Root design: rather than trying to
  make `definition.ts`'s dynamic `import()` (raw TS, no Lambda-compatible
  equivalent — see the open question in the entry above) work at REQUEST
  time in prod, extract everything both prod readers need at AUTHORING time
  into one committed static JSON, then read it via a plain static import
  (same proven pattern `data/global_relations.json`/`data/fin/fin_relations.json`
  already use successfully in this exact route) — no Nitro `serverAssets`/
  `useStorage` needed after all, since a single aggregated JSON import is
  simpler and already known to survive Rollup's static trace.
  - New: `scripts/build-fm-bundle.mjs` (`npm run sync:fm-bundle`, runs via
    `vite-node` — same execution model `find-synergies.mjs`/`run-one-card.mjs`
    already use) walks every `functional-model/cards/<slug>/`, executes
    `definition.ts` once (confirmed safe: every `definition.ts` only ever
    has TYPE-ONLY imports plus at most one runtime import of `tokens.ts`,
    itself also pure data — audited via `grep '^import'` across all 320
    cards) to pull just `{name, manaCost, typeLine, cmc, pt}` (the only
    `CardDefinition` fields `functional-model/synergy.ts`'s matcher —
    `staticAttrsFor`/`resolveSubject` — ever reads off `PoolCard.card`,
    confirmed via grep of every `.card.` access in that file), plus reads
    `synergy.json`/`trace.json`/`progress.json` and concatenates
    `definition.ts`+`scenarios.ts` source text (same concat rule the route's
    dev path already used, for the Card Definition tab). Writes one file:
    `data/functional-model/fm-bundle.json` (1.3MB for all 320 cards).
  - New: `server/utils/fmBundle.ts` — statically imports that JSON
    (`import fmBundleJson from '../../data/functional-model/fm-bundle.json'`),
    exports it typed as `Record<string, FmBundleEntry>`.
  - `server/api/card/[set]/[number].ts`'s `loadFunctionalModel`: production
    branch now reads `fmBundle[slug]` and returns real
    `{source, synergy, traces, annotatedCard, review, scenariosReview,
    interactionsReview}` instead of `null`. `annotatedCard` build logic
    extracted into a shared `buildAnnotatedCard()` helper used by both the
    prod and dev branches (was duplicated inline before). Dev branch
    (live vite-node recompute, folder-mtime cache) is UNCHANGED — kept
    exactly as-is, still the freshest-on-every-edit path for local work.
  - `server/utils/functionalModelPool.ts`'s `loadFunctionalModelPool`:
    production branch builds `PoolCard[]` straight from
    `Object.values(fmBundle)` (`poolFacts` as `card`, `synergy.source/sink`)
    — no `readdirSync`, no dynamic import, no fs access at all in prod.
    Dev branch unchanged.
  - The prior NODE_ENV guard around the live-recompute/vite-node path in
    both files is UNTOUCHED — only what happens in the production branch
    changed (real data instead of `return null` / `[]`).
  - **Staleness contract**: `fm-bundle.json` is committed, NOT regenerated
    by `npm run build` — same manual "regenerate via script, then commit"
    cadence `synergy.json`/`trace.json`/`progress.json` already have via
    `functional-model/scripts/*.mjs`. Re-run `npm run sync:fm-bundle` and
    commit the diff whenever `functional-model/cards/` changes. **This file
    was generated locally but NOT git-committed by me** (only commit when
    asked) — it MUST be committed before this fix has any effect on a real
    Netlify deploy (a fresh clone won't have it otherwise, and it's not
    gitignored — checked).
  - Validated exactly like the prior hotfix, one step further: `NITRO_PRESET=node-server
    NODE_ENV=production npm run build`, confirmed `fm-bundle.json`'s content
    got Rollup-traced into a real chunk (`functionalModelPool.mjs`, 1.5MB,
    contains `a-realm-reborn` etc. as a literal string — grepped for it).
    Then, to genuinely simulate the Netlify Lambda sandbox (not just "ran
    from repo root where functional-model/ happens to still be on disk" —
    the gap the prior hotfix's own notes flagged as unverified), I
    TEMPORARILY RENAMED the real `functional-model/` directory out of the
    way, ran the built `.output/server/index.mjs` with `NODE_ENV=production`
    against that missing directory, and hit `/api/card/fin/1`,
    `/api/card/fin/2`, `/api/card/fin/5`, `/api/card/fin/50` for real —
    every one returned 200 with non-null `functionalModel` (real
    source/synergy/traces/review fields) AND non-empty `interactions`
    (real card names — e.g. fin/1 Summon: Bahamut's Interactions listed A
    Realm Reborn/Absolute Virtue/Adelbert Steiner/... as real cross-card
    matches), with zero ENOENT/errors in the server log. Restored
    `functional-model/` immediately after (confirmed via `git status`
    showing zero diff under it, 320 card folders intact). Also re-confirmed
    local dev (`npm run dev`, already-running) still returns full live
    `functionalModel` data unchanged (fin/1, 2 traces). `npm run typecheck`
    clean. `npx vitest run` — same 5 pre-existing failures as before my
    change (missing `tagging/` dir, unrelated historical-sets-project data,
    not present in this checkout at all — confirmed unrelated).
  - Not done / explicitly out of scope for this task: didn't touch
    `package.json`'s `build` script to auto-regenerate the bundle at build
    time (considered it — Netlify build environment does have devDependencies
    incl. `vite-node` available — but manual regenerate-then-commit matches
    this repo's existing convention for every other functional-model-derived
    artifact, and avoids adding a new can't-skip step to the build/CI
    pipeline, which leans toward `server` agent's remit anyway).

- Contract note for orchestrator: `.claude/contracts/state-event-format.md`'s
  `TraceResult.scenario` shape (`{setup, action, result}`) is under-described
  — real `trace.json` output (confirmed by reading a live file) also carries
  a `scenario.raw` field (the scenario's own structured input, verbatim —
  actually already documented in `harness.ts`'s own `TraceResult` interface
  comment, just not surfaced in the contract file's abbreviated copy). Not a
  mismatch/bug, just a doc gap — additive field, doesn't break anything
  ("render generically off `fn`" rule already covers this for `log`, but
  `scenario.raw` isn't `log`). Worth a one-line addition to the contract
  next time it's touched.

- 2026-09-09: Extracted the "Draft" badge + confirm-button review-status
  pattern (previously duplicated 3x in `app/pages/app/card/[set]/[number]
  .vue` — facts/scenarios/interactions) into `app/components/
  ReviewStatusBadge.vue`, so the keywords coverage page can reuse it for a
  parallel review workflow.
  - New shared type: `app/types.ts`'s `ReviewStatus = 'not_implemented' |
    'ai_reviewed' | 'human_reviewed'` — the vocabulary the `engine` agent
    is (in parallel, not yet landed as of this writing — confirmed via
    `git diff`/`git status`: `functional-model/keywords/registry.ts`'s
    `KeywordStatus` is still the old `'covered' | 'gap'`) expanding
    `KeywordEntry.status` to.
  - `ReviewStatusBadge.vue` props: `status: ReviewStatus` (required),
    `badge?: boolean` (default true — set false when the caller already
    shows the pill elsewhere, e.g. the card page's own UTabs `item.badge`),
    `reviewedNote?: string` (shown only when `status === 'human_reviewed'`),
    `pending?: boolean` (disables the button), `size?: 'sm' | 'xs'`
    (default 'sm' — 'xs' matches the Interactions panel's smaller inline
    look), `readonly?: boolean` (default false — hides the button+note
    while still showing the pill; needed because the Interactions panel's
    pill shows regardless of `isDev` but its button is dev-only). Emits
    `confirm` (no payload) — component never makes the API call itself,
    caller owns the fetch/payload/re-sync, same responsibility split
    `toggleReviewStatus` already had. `status === 'not_implemented'` renders
    nothing at all (no pill, no button).
  - Card page: unchanged stored semantics (`progress.json`'s `review`
    'ai'/'human', `scenariosReview`/`interactionsReview` 'draft'/'reviewed',
    `/api/card/review-status`'s request/response contract) — only a
    display-time mapping (`factsStatus`/`scenariosStatus`/
    `interactionsStatus` computeds) onto the shared 3-way prop. Verified
    identical classes/labels/dev-gating at all 3 call sites (diffed
    against the pre-refactor markup). `npm run typecheck` clean.
  - New `server/api/keywords/review-status.ts` (dev-only, 403 in prod,
    same guard style as `server/api/card/review-status.ts`): `POST
    /api/keywords/review-status`, body `{ key: string, reviewed: boolean }`
    -> `{ key: string, reviewStatus: 'ai_reviewed' | 'human_reviewed' }`.
    400 if `key`/`reviewed` missing/wrong type, 404 if `key` isn't a real
    registry entry, 400 if that entry's `status === 'gap'` (nothing
    implemented to review-confirm). Persists to new
    `functional-model/keywords/review-status.json` — a flat `Record<string,
    true>` holding ONLY the human-reviewed override (no on-disk value for
    "ai_reviewed" — that's just "key absent").
  - `server/api/keywords/index.get.ts`'s `KeywordPageEntry` gained a new
    `reviewStatus: ReviewStatus` field, SEPARATE from the pre-existing
    `status: 'covered' | 'gap'` (left untouched — `app/pages/app/keywords/
    index.vue` and `KeywordEntryCard.vue` both still read `status` directly
    for their dot-indicator/badge text, and changing that field's value
    space would have broken their template type-checking under
    `npm run typecheck` before `ui` gets a chance to migrate them).
    `reviewStatus` is computed fresh per request: `entry.status === 'gap'`
    → `'not_implemented'`; else `review-status.json` override present for
    that `key` → `'human_reviewed'`; else → `'ai_reviewed'`. Override always
    wins when present, by construction.
  - Left an explicit `TODO(engine handoff)` comment in both new/touched
    keyword server files: once `engine` lands `KeywordEntry.status`'s own
    3-way widening, `status`/`reviewStatus` likely collapse back into one
    field — flagged, not done here (would also mean the `ui` agent's
    keywords-page consumers need to move off `status === 'covered'`/`'gap'`
    onto the shared vocabulary at the same time).
  - Not done (deliberately, per task scope): did NOT wire `app/pages/app/
    keywords/index.vue` or `KeywordEntryCard.vue` to actually use
    `ReviewStatusBadge`/`reviewStatus`/the new endpoint — that's the `ui`
    agent's own next task, per the dispatch. Confirmed via `git status`
    that `ui`'s own in-flight uncommitted changes to those two files (plus
    `ScenarioReplay.vue`/`ScenarioReplayTrace.vue`) were untouched by this
    task — only read them, never edited them.

- 2026-09-09: Grouped-mana-source Facts table row, off engine's new
  `EventFact.color`/`event: 'addMana'` (12 cards regenerated this session:
  druid-of-the-cowl, elvish-archdruid, goobbue-gardener,
  ishgard-the-holy-see-faith-grief, jidoor-aristocratic-capital-overture,
  lindblum-industrial-regency-mage-siege, llanowar-elves,
  midgar-city-of-mako-reactor-raid, sidequest-catch-a-fish-cooking-campsite,
  white-auracite, willowrush-verge, zanarkand-ancient-metropolis-lasting-fayth
  — checked, none of the 12 carry more than one `addMana` fact today, all
  single-color; grouping code is still written generically for N facts, not
  hardcoded to one).
  - `app/pages/app/card/[set]/[number].vue`: new `factRows` computed
    (card-owned, per `.claude/contracts/card-schema.md`'s "grouping/labels
    belong to card, not engine's `describeFact`" note) partitions each
    role's fact list into ordinary `{kind:'fact'}` rows plus, if any
    `isEventFact(f) && f.event === 'addMana'` facts exist on that role, one
    trailing `{kind:'manaGroup', role, facts}` row. Rendered as a collapsed
    "Source: Mana" (or "Sink: Mana") summary row — click toggles
    `expandedManaGroups` (a `ref<Set<string>>`, replaced not mutated, for
    reactivity) to reveal one sub-row per underlying fact
    (`<ManaSymbol :code="f.color">` + `COLOR_LABEL[f.color]`, or "Any color"
    if `color` is unset) directly below, same table, same columns. Summary
    row's own `ValueBar` uses `manaGroupValue()` = MAX of the group's
    `value`s, not a sum — `Weight` is a 1-5 "how easy to trigger" dial per
    `synergy.ts`'s own doc comment, not a real magnitude, so summing across
    colors would misrepresent it.
  - Every sub-fact (and the ordinary non-mana rows) keeps its own
    `factKey()`-addressable `<tr>` with its own `@mouseenter`/`@mouseleave`
    — hover-link-to-trace (`FunctionalModelText.vue`'s annotated-oracle-text
    hover, bidirectional via `hoveredFactKey`) still works per individual
    fact once a group is expanded. Hovering the still-collapsed summary row
    itself sets `hoveredFactKey` to the FIRST fact's key (same "only the
    first fact behind a phrase drives the cross-panel highlight" convention
    `FunctionalModelText.vue` already documents for a segment backed by
    >1 fact) — reusing that existing precedent rather than inventing a new
    one for the multi-fact-hover case.
  - Verified live (dev server, Playwright against the already-running
    localhost:3000 — no chromium was pre-installed for the project's own
    `playwright` devDependency, but a cached one already existed at
    `~/.cache/ms-playwright`, so no install step was needed): fin/293
    (Zanarkand), fin/41 (White Auracite), fin/188 (Goobbue Gardener) — all
    render the collapsed "Source: Mana" row; clicking expands to the
    correct color (Green/White respectively) with a real `ManaSymbol`; a
    non-mana card (fin/1) renders unchanged (regression check). Hover
    round-trip confirmed via `elementHandle.dispatchEvent('mouseenter')`
    (Playwright's own synthetic `.hover()`/`mouse.move()` intermittently
    failed to fire a real `mouseenter` when the pointer was already resting
    somewhere inside the table from a prior test step — an artifact of the
    test tool, not the app; a real dispatched `mouseenter` event confirmed
    the row and the annotated `{G}` phrase highlight each other correctly
    both directions).
  - Not touched: `describeFact`/`constraintBits` in engine-owned
    `functional-model/synergy.ts` — per the task, no engine-side change
    needed; this is pure card-owned display grouping on top of the
    existing `Fact` shape.

- 2026-09-09 (follow-up): Two fixes to `ReviewStatusBadge.vue` requested —
  compact the confirm control to icon-only, and check the card page's tab
  headers hadn't regressed from the extraction.
  - **Tab headers**: verified NOT regressed. Screenshotted (Playwright,
    headless chromium) the card page's UTabs strip (Facts/Scenarios pill +
    label) both on a git worktree checked out at HEAD (`199f66c`, i.e. the
    pre-extraction baseline — `ReviewStatusBadge.vue` is untracked so HEAD
    is genuinely "before") on a second dev server (port 3011) and on the
    live dev server serving the current uncommitted tree (port 3000), for
    two cards (fin/1 — facts human_reviewed/scenarios draft; fin/212
    Absolute Virtue — both ai_reviewed/draft). Pixel-identical both times —
    the tab-strip `DRAFT_BADGE` object was never routed through
    `ReviewStatusBadge.vue` to begin with (UTabs' `item.badge` isn't a slot
    a component can render into, per the extraction's own comment), so nothing
    there could have regressed. No changes made to the card page for this
    part of the task.
  - **Icon-only confirm button**: `ReviewStatusBadge.vue`'s confirm control
    is now icon-only (`lucide:check` / `lucide:rotate-ccw`, no text label),
    with `title`/`aria-label` carrying what used to be the button's own
    visible text. When the pill renders locally (`badge && status ===
    'ai_reviewed'`) the button is embedded INSIDE the pill, at its trailing
    edge, sharing its rounded/orange styling — this is the "attached to the
    draft badge" case (card page's Interactions panel, keywords page's
    `KeywordEntryCard.vue`). When there's no local pill to attach to
    (`badge` false — card page's Facts/Scenarios, which show the pill via
    UTabs `item.badge` instead — or `status === 'human_reviewed'`, which
    never had a pill), it renders as a small standalone bordered icon
    button instead. Same `confirm` emit, same `pending`/`readonly`/`size`
    props, unchanged. Verified live (dev server screenshots) on: card page
    fin/1 (Facts human_reviewed → standalone green rotate-ccw + reviewed
    note; Interactions draft → pill+embedded check), fin/212 (Facts/
    Scenarios draft → standalone check since pill's in the tab strip;
    Interactions draft → pill+embedded check), and keywords page's Flying &
    Reach entry (pill+embedded check; clicked it live through the real
    `/api/keywords/review-status` endpoint to confirm the emit/toggle still
    round-trips, then re-toggled back via the same endpoint to restore
    `functional-model/keywords/review-status.json` to its original empty
    state — that file is untracked/not gitignored but was empty before and
    after, so no residue).
  - Did NOT touch `KeywordEntryCard.vue` or the card page at all — the
    compact button change is fully contained in `ReviewStatusBadge.vue`,
    no surrounding-layout adjustment was needed at either call site.
  - `npm run typecheck` clean.

- 2026-09-09 (follow-up, part 2): Fixed the actual split-button regression
  the user flagged — Facts/Scenarios tab headers were showing the Draft
  pill (UTabs `item.badge`, a plain string/object prop rendered through
  Nuxt UI's own `UBadge` fallback) and the confirm checkmark (rendered
  standalone by `ReviewStatusBadge.vue` in a separate `<div v-if="isDev">`
  below the tab strip, per the prior pass's own `badge=false` "no local
  pill to attach to" branch) as two disconnected pieces. Root cause: UTabs'
  `item.badge` isn't a slot a component can mount into, so the embedded-
  checkmark-in-pill design the Interactions panel/keywords page already
  use couldn't reach the tab strip at all under the old approach.
  - Fix: `app/pages/app/card/[set]/[number].vue`'s `<UTabs>` now uses its
    real `#trailing="{ item }"` scoped slot (confirmed in
    `node_modules/@nuxt/ui/dist/runtime/components/Tabs.vue` — falls back
    to a plain `UBadge` off `item.badge` when unslotted, but the slot lets
    a caller mount anything) to mount an actual `<ReviewStatusBadge
    :badge="true" />` per tab (`item.value === 'facts' | 'scenarios'`)
    instead. Pill + embedded checkmark are now one mounted component, one
    visual element, matching Interactions/keywords.
  - Removed: `functionalModelTabs`'s `badge: DRAFT_BADGE` field entirely
    (no longer a computed — nothing inside it was reactive anymore once
    the badge object was gone, so it's a plain array now) and the two
    separate `<div v-if="isDev">` `ReviewStatusBadge` blocks (Facts,
    Scenarios) that used to render the standalone confirm button below the
    tab strip — that content moved into the `#trailing` slot instead.
  - Dev-gating preserved via `ReviewStatusBadge`'s own `readonly` prop
    (`:readonly="!isDev"`) rather than the old `v-if="isDev"` wrapper:
    pill still shows in prod (readonly hides only the button, matching the
    old item.badge-always-shows behavior), button only interactive in dev
    — same effective behavior as before, verified by reasoning through all
    4 status×env combinations against the old code's branches.
  - Dropped `reviewedNote` on these two call sites (the old standalone-
    button blocks passed one each, e.g. "Reviewed — these facts have been
    checked...") — a full sentence doesn't fit inline in a tab-strip
    trailing slot; Interactions' own call site doesn't pass one either, so
    this aligns the pattern rather than inventing a new tab-header-specific
    treatment. The button's own `title`/`aria-label` ("Mark as reviewed"/
    "Mark as draft") still carry the equivalent info for a11y.
  - Verified live: Playwright screenshots (fin/212 Absolute Virtue, both
    fields at `ai_reviewed`) show ONE "DRAFT ✓" pill per tab (Facts,
    Scenarios), matching Interactions' own pill styling below. Clicked the
    Facts checkmark live through the real `/api/card/review-status`
    endpoint — flipped in place (pill → standalone green rotate-ccw icon,
    no page reload, Scenarios' own pill untouched) — confirmed the confirm
    control still round-trips correctly through the new slot. Restored
    `functional-model/cards/absolute-virtue/progress.json` back to its
    original `"review": "ai"` afterward (confirmed via `git status` —
    zero diff). `npm run typecheck` clean.

- 2026-09-09 (follow-up, part 3): Reverted part 2's `#trailing`-slot
  approach per explicit instruction — Facts/Scenarios' Draft badge moved
  OUT of the `UTabs` tab strip entirely and into the top of each tab's own
  content block instead, mirroring exactly how the Interactions section
  (not a `UTabs` tab) already renders its own `ReviewStatusBadge` just
  below its heading.
  - `app/pages/app/card/[set]/[number].vue`: `<UTabs>` is back to a plain
    self-closing tag with no `#trailing` slot/badge wiring.
    `functionalModelTabs` was already a plain `{ label, value }` array (the
    badge had never been folded into it — that lived only in the slot);
    nothing needed reverting there.
  - Added one `<div class="mb-2"><ReviewStatusBadge :badge="true" ... /></div>`
    at the top of the Facts `<template>` block (using `factsStatus`/
    `toggleReviewStatus('review')`) and an identical one at the top of the
    Scenarios block (`scenariosStatus`/`toggleReviewStatus('scenariosReview')`),
    same `size="xs"`, `:readonly="!isDev"`, `:pending`, `@confirm` props as
    before.
  - Verified live via Playwright against the already-running dev server
    (port 3000 — a second `npm run dev` on another port refused to start,
    Nuxt's own single-instance dev lock, so used the existing one
    directly) on fin/212 Absolute Virtue: tab strip (Facts | Scenarios |
    Json | Card Definition) shows no badge at all now; Facts tab shows its
    own "DRAFT ✓" pill at the top of its content, above the facts table;
    Scenarios tab shows its own "DRAFT ✓" pill at the top of its content,
    above the replay. Clicked the Facts pill's embedded confirm checkmark
    live through the real `/api/card/review-status` endpoint — flipped in
    place to the standalone reviewed icon with no page reload, tab strip
    and card header untouched — then clicked again to revert back to
    Draft. Confirmed via `git status`/`git diff --stat` on
    `functional-model/cards/absolute-virtue/` afterward: zero diff, so
    `progress.json` round-tripped back to its exact original state.
  - `npm run typecheck` clean (exit 0, no errors).
  - Scratch Playwright driver scripts were written to (and removed from)
    the repo root as `.tmp-shot.mjs`/`.tmp-shot2.mjs` — needed to be
    inside the project tree for Node's `node_modules` resolution to find
    `playwright`; both deleted before finishing, confirmed absent from
    `git status`.

- 2026-09-09 (follow-up, part 4): Fixed the grouped mana-fact expanded row
  in `app/pages/app/card/[set]/[number].vue` — it only read a fact's legacy
  singular `color: string` field, so `engine`'s new `EventFact.colors?:
  TypeConstraint` shape (a genuine choice-of-color ability, e.g. Vector,
  Imperial Capital's `{hasAny:['B','R']}`, added 2026-09-09 in
  `functional-model/synergy.ts` alongside `playLand`) rendered as the
  generic "Any color mana" fallback despite having real, known colors.
  Both shapes coexist in the corpus now (11 real cards still only carry
  legacy `color`; anything new uses `colors`).
  - Added `manaFactColorLabel(f: EventFact)` next to `manaGroupValue` —
    reads `colors.has` (join "and" — makes/needs ALL listed at once),
    `colors.hasAny` (join "or" — genuine one-of-these-per-activation
    choice), `colors.not` ("any color other than X or Y"), falling back to
    legacy `color` and only then to the literal string `'Any color'` (which
    per `synergy.ts`'s own `colorSetOf` doc should now be unreachable for a
    real addMana fact — flag to engine if one ever hits it). Returns both
    `codes` (for `ManaSymbol` icons, `has`/`hasAny` only — `not` has no
    fixed icon set) and a full-color-name `label` string.
  - Template row (previously `<ManaSymbol v-if="f.color" .../>{{ f.color ?
    ... : 'Any color' }} mana`) now iterates `manaFactColorLabel(f).codes`
    for icons and reads `.label` for text. Deliberately NOT reusing
    `describeFact`'s own terser space/slash-joined color-CODE wording (that
    function is engine-owned per the contract's own flagged violation note
    — full color names read better in this card-owned expandable row
    anyway, not just borrowing its output).
  - Verified live against the running dev server (no restart needed) via a
    throwaway Playwright script run from the project root (temp file,
    deleted after — `node_modules` resolution needs it inside the tree):
    fin/291 (Vector, Imperial Capital) expanded mana row now reads "{B}{R}
    Black or Red mana" (was "Any color mana" before the fix); fin/293
    (Zanarkand, legacy single-color `color: 'G'`) still reads "{G} Green
    mana" unaffected — confirmed no regression on the 11 legacy cards'
    rendering path.
  - `npm run typecheck` clean (exit 0).
  - Repo has substantial other uncommitted work in flight this session
    (engine's `colors` rollout across many cards' synergy.json/trace.json,
    a keywords-page/review-status-badge refactor) — none of that touched
    here; my diff on `[number].vue` is additive (one new function, one
    template line swapped), verified via `git diff` before finishing.

## Open questions

(none yet)
