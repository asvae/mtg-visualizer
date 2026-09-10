# card agent notes

Scoped working memory for the `card` specialist. Update before finishing
any task: decisions made, open questions, current state worth resuming
from. This is what makes a fresh respawn cheap — don't rely on transcript
resume alone (session transcripts are swept after ~30 days).

## Decisions

- 2026-09-09: Reverted the mana-producer grouping feature's two UI choices
  in `app/pages/app/card/[set]/[number].vue`'s Facts table, per direct user
  pushback ("Source: Source: Mana? Why the hell collapse?"). Removed
  entirely: the `manaGroup` FactRow variant, `expandedManaGroups` state,
  `toggleManaGroup`, `manaGroupValue`, and the "Source:"/"Sink:"-prefixed
  summary row + click-to-expand chevron. Checked the corpus first
  (`functional-model/cards/*/synergy.json`): NO card currently has more
  than one `addMana` fact per role, so the "group N facts under one
  collapsible row" structure was solving a case that doesn't exist yet —
  confirms the fresh-eyes call the task asked for. Replaced with: every
  `addMana` fact is just its own plain `FactRow`, identical row shape/
  hover/icon convention to every other fact (no prefix, no chevron, no
  click), fully visible immediately. Kept ONE piece of the original
  grouping work since it's independently useful even for a single fact:
  `manaFactColorLabel()`'s full-color-name label (reads both new `colors`
  {has/hasAny/not} and the 11 legacy single-`color` cards) + per-color
  `ManaSymbol` icons in that row's own description cell, instead of
  `describeFact`'s terser "(B/R)" text or (for legacy `color`-only facts)
  no color shown at all. Verified live via Playwright screenshot against
  fin/291 (Vector, Imperial Capital, `colors:{hasAny:['B','R']}` → renders
  "Black or Red mana" with both mana symbols, one plain row) and fin/293
  (Zanarkand, legacy `color:'G'` → "Green mana", one plain row) — no
  "Source: Source", no chevron, no click-to-expand on either.
  `npm run typecheck` clean. If a future card genuinely needs >1 addMana
  fact per role, re-evaluate row-count-blowout then rather than
  pre-building for it.

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

- 2026-09-09 (follow-up, part 5): Per explicit instruction, un-did part 4's
  color-specific mana row in favor of the plain, generic label every other
  fact row already uses — labels stay short/generic, color/type specifics
  belong in the details/JSON column only.
  - `app/pages/app/card/[set]/[number].vue`: removed `manaFactColorLabel`
    entirely (function + its doc comment), the addMana-specific template
    branch (`ManaSymbol` ×N + color-name label), and the now-unused
    `isEventFact`/`EventFact`/`COLOR_LABEL` imports. The addMana row now
    goes through the same plain `{{ describeFact(row.fact) }}` every other
    row uses — no more per-row `v-if` branch at all.
  - Added `'colors'`, `'color'`, `'tapped'` to `CONDITION_KEYS` (~line 238)
    so the existing `factConditions()` details/JSON column picks them up
    automatically, same verbatim-JSON mechanism as `types`/`cmc`/etc. — no
    new column, no new formatting logic.
  - `describeFact`'s own `addMana` case (`functional-model/synergy.ts`,
    engine-owned file, small in-place tweak per the task's explicit
    allowance): dropped the `(B/R)`-style color-code suffix added earlier
    this session right after `colors` superseded legacy `color` — that
    made the label color-specific, contradicting the generic-label
    convention. Now just `"${describeSide(fact.controller)} mana
    production"` unconditionally, matching the terser pre-`colors`
    wording. Left a comment pointing at the card page's own
    `CONDITION_KEYS` as where the color detail now lives.
  - Root-caused the still-raw `"playLand"` text the user kept seeing live:
    NOT a source bug — `describeFact`'s `event === 'playLand'` case has
    correctly returned `'Play a land.'` on disk the whole time. It was a
    genuinely stale Vite dev-server module state: a raw `curl`/direct
    `page.request.get` fetch of `@fs/.../functional-model/synergy.ts`
    already reflected fresh disk content (including `playLand` and
    `entersBattlefield`'s `tapped` ternary), but the actual bundled JS
    module the browser executed at runtime stayed on an OLDER version
    (missing both `playLand` and the `tapped` ternary — i.e. frozen at a
    point before either was added this session, despite reflecting an
    even-more-recent edit of mine to the very same function's `addMana`
    branch moments earlier) — a corrupted/partial HMR module-graph state
    after many rapid successive edits to this shared file across the
    session's larger uncommitted diff, not a browser-cache or curl-cache
    artifact (confirmed via completely fresh `chromium.launch()` browser
    processes each time, no persistent profile). Killed the running dev
    server (PID from a peer session/earlier boot, port 3000) and started
    a fresh one — `playLand` and the `tapped` ternary immediately rendered
    correctly on the very next request, no further code change needed.
    Flag: if raw event-string text (`"someEvent"`) is ever reported live
    again despite `describeFact` clearly handling it in source, suspect
    this same stale-HMR-module-graph failure mode before re-reading
    source — a dev-server restart is the fix, not a code change.
  - Verified live against the restarted dev server via a throwaway
    Playwright script (temp file in repo root, deleted after — same
    `node_modules` resolution reason as part 4): fresh `chromium.launch()`
    navigations to fin/291 now show `Play a land.` / `battlefield
    presence` / `enters the battlefield tapped` (JSON column
    `{"tapped":true}`) / `your mana production` (JSON column
    `{"colors":{"hasAny":["B","R"]}}`) — all four rows now generic-labeled
    with color/tapped detail readable in the JSON column. fin/293 (legacy
    single-color) unaffected: `your mana production` with JSON column
    `{"color":"G"}`, other three rows unchanged, no regression.
  - `npm run typecheck` clean (exit 0) after the restart.
  - No contract mismatch found against `.claude/contracts/card-schema.md`
    this round — `colors`/`color`/`tapped` were already documented engine-
    side fields, this was purely a card-page display change.

- 2026-09-09 (follow-up, part 6): Reworked the review-status UI per explicit
  request — from three separate per-section `ReviewStatusBadge` call sites
  (top of Facts tab content, top of Scenarios tab content, beside the
  Interactions heading — the part 3 layout) into one small summary table,
  and made the confirm action optimistic.
  - `app/pages/app/card/[set]/[number].vue`: new table (`FACTS | DRAFT |
    CONFIRM` header, rows for Facts/Scenarios — gated on `data?.functionalModel`
    — and Interactions — gated on `data?.interactions?.length`, same
    conditions each row's old standalone badge used) placed once, right
    after `CardMedia` and before the functional-model `UTabs` block, so it
    covers all three sections regardless of which tab is active. Tab strip
    and per-tab content now carry NO draft/review indicator at all. Removed
    the three old inline `ReviewStatusBadge` blocks (Facts tab top,
    Scenarios tab top, Interactions header).
  - Table cells reuse `ReviewStatusBadge` TWICE per row rather than
    inventing new markup for the pill/button split the table's 3-column
    layout needs: Draft cell = `:badge="true" :readonly="true"` (renders
    only the pill, nothing at all once reviewed — matches the column's own
    "Draft" semantics: empty means not-draft); Confirm cell =
    `:badge="false"` with the existing `:readonly="!isDev"` /
    `:readonly="!(isDev && data.functionalModel)"` (interactions) gating
    (renders only the standalone confirm/revert icon button, same dev-only
    guard as before). Same `factsStatus`/`scenariosStatus`/
    `interactionsStatus` computeds and `toggleReviewStatus` function as
    before — no parallel status system, `progress.json`'s stored
    'ai'/'human'/'draft'/'reviewed' values and `/api/card/review-status`'s
    request/response contract are completely unchanged.
  - `toggleReviewStatus`: now flips the relevant local ref
    (`factsReviewStatus`/`scenariosReviewStatus`/`interactionsReviewStatus`)
    SYNCHRONOUSLY, before the `fetch` call even starts (optimistic), instead
    of only after `res.json()` resolved. Snapshots all three refs first;
    on `!res.ok` or a caught exception, rolls back to the snapshot. On a
    real 200, reconciles with the server's own returned value (expected to
    already match what was optimistically set — this just closes the
    loop, doesn't gate the visual update on it).
  - Review-reset-on-authored-content-change invariant (any authored-content
    change to a card must reset its review flag back to 'ai') is untouched
    by this task — that reset lives in the content-generation scripts that
    write `progress.json`'s `review` field when synergy/trace content
    changes, not in this toggle endpoint or this UI; this task only changed
    how the existing three fields are DISPLAYED and how the confirm click's
    OWN local-state timing works, never touched the reset logic itself.
  - Verified live (dev server already running on :3000, Playwright against
    fin/212 Absolute Virtue — has both `functionalModel` and
    `interactions`): tab strip shows "Facts / Scenarios / Json / Card
    Definition" with no "DRAFT" text anywhere (confirmed via `.innerText()`,
    not just visually). New table renders 3 rows (Facts/Scenarios/
    Interactions), each starting in `DRAFT` pill + checkbox-style confirm
    icon. Clicked the Facts row's confirm button and screenshotted
    IMMEDIATELY after `click()` returned (before any plausible network
    round-trip) — DRAFT pill already gone, button already flipped to the
    green revert icon, both in the raw `.innerText()` capture and the
    screenshot — confirms the optimistic flip, not a "waited and it just
    looked fast" false positive. Clicked revert afterward — reconciled back
    to `DRAFT`. Confirmed via `git status`/`git diff --stat` on
    `functional-model/cards/absolute-virtue/` that `progress.json`
    round-tripped to zero diff (real POST round-trips both ways, this
    wasn't just local-state theater). `npm run typecheck` clean (exit 0).
    Scratch Playwright driver (`.tmp-review-table-shot.mjs`, needed inside
    the tree for `node_modules` resolution, same pattern as prior sessions)
    deleted before finishing — confirmed absent from `git status`.
  - No contract mismatch found against `.claude/contracts/card-schema.md`
    this round — purely a card-owned display/interaction-timing change, no
    engine-owned shape involved.

- 2026-09-09 (follow-up, part 7): Two more revisions to the review-status
  table from part 6, both landed mid-task via orchestrator messages before
  the task was considered done.
  - **Revision A** — collapsed the two-cell Draft-pill + Confirm-icon
    layout down to ONE button per row, no separate pill: `ReviewStatusBadge`
    gained a new `variant?: 'pill' | 'button'` prop (default `'pill'` —
    fully additive, the original pill+icon markup is untouched behind that
    default, so `KeywordEntryCard.vue`'s existing usage is unaffected).
    `variant="button"` renders a single text button whose own label doubles
    as the status readout: `"Confirm"` when `status === 'ai_reviewed'`,
    `"Unconfirm"` when `'human_reviewed'`. `badge`/`reviewedNote`/`size`
    props are ignored in this variant. `readonly` disables the button in
    place (rather than hiding it, unlike the pill variant) since this
    button is now the row's ONLY content — a prod visitor should still see
    the label even though they can't click it.
  - **Revision B** (superseded revision A's initial "make it bigger" ask,
    per an explicit later correction) — three more changes landed together:
    (1) table moved to sit beside `CardMedia` (`flex flex-col md:flex-row
    items-start gap-4` wrapper around both), stacking below the card image
    under `md`'s breakpoint, side-by-side at `md` and up; (2) button size
    shrunk to compact (`rounded px-2 py-1 text-xs font-medium`, down from an
    intermediate bigger `px-4 py-2 text-sm` that revision A had first
    tried); (3) colors muted throughout — Confirm is `border-warn/40
    bg-warn/15 text-warn` (a faint amber tint, not the solid `bg-warn
    text-bg` revision A first used), Unconfirm is `border-border text-muted`
    (plain neutral) — Confirm reads only a shade more prominent than
    Unconfirm (enough to stay distinguishable), neither is a loud/
    attention-grabbing color.
  - `app/pages/app/card/[set]/[number].vue`: three `ReviewStatusBadge` call
    sites (Facts/Scenarios/Interactions rows) now pass `variant="button"`
    with no `badge`/`size` props (irrelevant to that variant); table markup
    unchanged otherwise (still `FACTS` header, still the same three
    conditionally-rendered rows, same `factsStatus`/`scenariosStatus`/
    `interactionsStatus`/`toggleReviewStatus` wiring, same optimistic-flip
    logic from part 6 — untouched by either revision, confirmed via diff).
  - Verified live at both revisions (Playwright, dev server already
    running, fin/212 Absolute Virtue): revision A — table rows read
    "Facts Confirm" / clicking flips to "Unconfirm" immediately (before any
    plausible network round-trip, same optimistic-timing check as part 6)
    and back on a second click, `git status` on
    `functional-model/cards/absolute-virtue/` clean afterward each time.
    Revision B — screenshotted at 1100px (table sits to the right of the
    card image, small amber-outlined "Confirm" buttons) and 420px (table
    stacks below the image, same small buttons) viewports; toggled Facts to
    confirm computed button class actually carries the muted/border classes
    (not just visual impression) — `border border-warn/40 bg-warn/15
    text-warn` (Confirm) vs `border border-border text-muted` (Unconfirm).
    `progress.json` round-tripped to zero diff again. `npm run typecheck`
    clean (exit 0) after every revision. Scratch Playwright drivers (3
    total across the two revisions, same in-tree-then-delete pattern as
    prior sessions) all removed before finishing — confirmed absent from
    final `git status`.
  - Net result differs from the ORIGINAL task brief's literal "Facts | Draft
    | Confirm, three columns" spec — that first build was completed, verified
    live, and then explicitly superseded by these two coordinator-sent
    revisions before the task finished; final shape is "Facts | [one muted
    button]", table positioned beside the card image. Flagging this in case
    the original three-column phrasing resurfaces elsewhere (e.g. if a
    future task references "the Draft/Confirm columns") — it no longer
    matches what's on screen.

- 2026-09-09 (follow-up, part 8): Added a small item count to the Facts/
  Scenarios tab labels, plus (per a mid-task coordinator message) made the
  review-status table's three rows always render regardless of whether
  that section has any content yet.
  - **Tab counts**: `functionalModelTabs` (was a plain array) is now a
    `computed()` returning `{ label, value, badge }` items — `badge` is
    Nuxt UI's real `UTabs` item field (confirmed in
    `node_modules/@nuxt/ui/dist/runtime/components/Tabs.vue`: `item.badge`
    renders a `UBadge` with `color="neutral" variant="outline"`, already
    exactly the "small, muted, doesn't overwhelm the label" look this
    needed — least-code option, no custom markup/label interpolation).
    `factsCount = synergy.value ? source.length + sink.length : 0`;
    `scenariosCount = data.value?.functionalModel?.traces?.length ?? 0`;
    each tab's `badge: count || undefined` — `UTabs`'s own template
    condition is `v-if="item.badge || item.badge === 0"`, so `undefined`
    (not `0`) suppresses the badge entirely for both the not-yet-migrated
    case (`synergy` null) and a genuine zero, consistently. Json/Card
    Definition get no `badge` field at all. This is a plain item COUNT,
    not a draft/review indicator — does not reintroduce the tab-strip
    status badge removed earlier this session (see part 6/7 above and the
    template's own comment); kept them conceptually separate on purpose.
  - **Review-status table always-render** (mid-task addition, not in the
    original brief): removed all three `v-if` guards
    (`data?.functionalModel` ×2, `data?.interactions?.length`) off the
    Facts/Scenarios/Interactions `<tr>`s, and removed the outer wrapper
    `<div v-if="data?.functionalModel || data?.interactions?.length">`
    entirely (safe unconditionally — this whole block only renders inside
    the page's own `<template v-else>`, already gated on `card` being
    loaded). All three rows now show even for a card with no
    functional-model entry at all or zero interaction groups, per explicit
    request ("show the true empty state, don't hide the section").
    Widened each row's `readonly` from `!isDev` to `!(isDev &&
    data?.functionalModel)` (Facts/Scenarios — previously only
    Interactions had this extra guard) since `toggleReviewStatus`'s POST
    target (`server/api/card/review-status.ts`) 404s outright when
    `functional-model/cards/<slug>/` doesn't exist — all three fields'
    `progress.json` lives in that same folder, so a not-yet-migrated
    card's rows now render with a genuinely disabled (not just
    silently-no-op) Confirm button.
  - Verified live (Playwright, dev server already running on :3000):
    fin/271 Adventurer's Inn (1 fact, 1 scenario — the task's own "zero
    scenarios" example is stale, this card was since given a real
    onEnter-lifegain scenario; used it anyway as a good small-nonzero-both
    case) — tab strip reads "Facts [1]" / "Scenarios [1]" / "Json" / "Card
    Definition", all three status rows present. fin/291 Vector, Imperial
    Capital (4 facts, 0 traces — corrected "zero scenarios" example, not
    271) — "Facts [4]" badge, Scenarios tab has NO badge, all three status
    rows present (Facts/Scenarios show "Unconfirm"/already-reviewed,
    Interactions shows "Confirm"). fin/294 Plains (`functionalModel: null`
    — genuinely unmigrated; along with Ether/Gogo/Quistis Trepe/Swallowed
    by Leviathan/Syncopate/Ragnarok and all 6 basics, checked via a script
    diffing `data/fin/fin_scryfall.json` names against
    `functional-model/cards/` folder slugs) — whole functional-model block
    (annotated text + tabs) correctly absent entirely (unchanged behavior,
    still gated on `data?.functionalModel`), but the review-status table
    now shows all three rows with visibly disabled/greyed "Confirm"
    buttons, confirming the widened readonly condition. `npm run
    typecheck` clean (exit 0, no errors) after these edits.
  - No contract mismatch found against `.claude/contracts/card-schema.md`
    or `state-event-format.md` this round — purely a card-owned tab-strip/
    review-table display change, no engine-owned shape touched.
  - Repo has substantial unrelated concurrent work in progress this
    session from other agents (`functional-model/cards/*` synergy/progress
    JSON regenerations, `app/components/ReviewStatusBadge.vue` edits) —
    confirmed via `git diff --stat` that my own diff is isolated to
    `app/pages/app/card/[set]/[number].vue`, didn't touch or revert any of
    that other in-flight work.

- 2026-09-09 (follow-up, part 9): Split the Facts tab table into "Main
  card"/"Other faces/functions" groups for multi-face cards, per explicit
  request against fin/293 (Zanarkand, Ancient Metropolis // Lasting
  Fayth).
  - `app/pages/app/card/[set]/[number].vue`: new `annotatedFaces`
    (`data.value?.functionalModel?.annotatedCard?.faces ?? []`),
    `isMultiFace` (`annotatedFaces.value.length > 1`), `annotatedFactRefKey()`
    (mirrors `factKey()`'s own `id ?? role::sourceText::description`
    fallback, applied to an `AnnotatedFactRef` instead of a raw `Fact` —
    same fields, same join key), `mainFaceFactKeys` (every fact-key linked
    anywhere in face 0's own `oracleLines` — reused straight off
    `annotateOracleText`'s existing per-face linking, no new server logic,
    no new heuristic invented from scratch), and `factRowGroups` (splits
    `factRows` into `[{label:'Main card',...}, {label:'Other
    faces/functions',...}]` when multi-face — a fact lands in "Main card"
    only if its key is in `mainFaceFactKeys`, everything else (including
    every fact `annotateOracleText` never linked to ANY face) defaults to
    "Other faces/functions"; a single-faced card gets exactly
    `[{label:null, rows: factRows}]`, i.e. today's flat table, byte-for-
    byte unchanged). Template: the Facts table's single `<tbody>` became
    `<tbody v-for="group in factRowGroups">`, with an extra `<tr><td
    colspan="4">{{ group.label }}</td></tr>` header row only when
    `group.label` is non-null (and the group has ≥1 row — an empty group
    is filtered out of `factRowGroups` entirely, so there's never a
    header with nothing under it). Row markup itself (`ValueBar`/role-
    icon/`describeFact`/conditions columns, hover-highlight wiring) is
    completely unchanged, just re-parented under the new per-group
    `<tbody>`.
  - **Flagged, not fixed here — real schema gap**: the "default unresolved
    facts to Other faces/functions" fallback is empirically correct for
    every Adventure-Town-land card checked (fin/293 Zanarkand, plus
    ishgard-the-holy-see, jidoor-aristocratic-capital, lindblum-industrial-
    regency, midgar-city-of-mako — all "front face is a plain mana land,
    back face is the Adventure spell" cards where every unresolved fact
    genuinely IS a back-face effect), but is NOT a reliable general
    signal — spot-checked a differently-shaped multi-face card
    (`sidequest-catch-a-fish-cooking-campsite`, a transforming
    Enchantment//Land, not Adventure) and found a real counterexample:
    its own front-face upkeep-trigger sink fact has no `sourceText` either
    and would misfile into "Other faces/functions" under this same
    fallback despite genuinely belonging to the front face. Recommending
    an explicit, author-set `Fact.face` field (alongside `subject`/`id`)
    as the durable fix — this is an engine-schema change, out of this
    page's own lane, so not implemented here. `(・_・?)` for the
    orchestrator: worth routing to `engine` if/when broader multi-face
    fact-grouping (beyond this one Adventure-land-cluster heuristic)
    becomes a real need.
  - Verified live (Playwright, dev server on :3000): fin/293 Zanarkand —
    "MAIN CARD" group shows only the mana fact, "OTHER FACES/FUNCTIONS"
    shows the wants-lands sink + battlefield-presence + +1/+1-counters
    facts, both group headers followed by their own rows, Facts/Scenarios
    tab-count badges (part 8's work) still correct alongside this.
    fin/283 Ishgard, the Holy See // Faith & Grief — same shape, "MAIN
    CARD" = mana fact, "OTHER FACES/FUNCTIONS" = the graveyard-return sink.
    fin/1 Summon: Bahamut (single-faced Saga, NOT a DFC/Adventure card,
    control case) — flat 8-row table, NO group headers at all, confirming
    `isMultiFace` correctly gates this off for the ordinary case.
  - `npm run typecheck` clean (exit 0) after these edits.
  - Repo still has substantial unrelated concurrent work in flight from
    other agents this session — confirmed via `git status`/`git diff
    --stat` that my own diff stayed isolated to
    `app/pages/app/card/[set]/[number].vue` (plus this notes file) both
    before and after this round.

- 2026-09-09 (follow-up, part 10): Added a small per-row annotation icon to
  the Facts table in `app/pages/app/card/[set]/[number].vue`, per explicit
  request — indicates whether a fact successfully linked to oracle text via
  `annotateOracleText`, independent of (and without touching) the part 9
  face-grouping heuristic.
  - New `factKeysInFaces(faces: AnnotatedFace[])` helper (factored out of
    the part 9 `mainFaceFactKeys` computed, which now just calls it with
    `annotatedFaces.value.slice(0, 1)` — behavior unchanged, confirmed by
    re-reading the diff) plus a new `annotatedFactKeys` computed that calls
    the same helper with ALL faces (not just face 0) — a fact linked on the
    back face only still counts as "has a real textual anchor somewhere",
    which is this icon's own narrower question (distinct from "which face
    does it belong to", the face-grouping question part 9 already answers).
    `isFactAnnotated(fact)` looks up `factKey(fact)` in that set.
  - Template: each Facts-table row's description `<td>` gets a small
    (`h-2.5 w-2.5`) `Icon` before the text — `lucide:link-2` (muted emerald)
    when annotated, `lucide:link-2-off` (muted gray) when not — reusing the
    same `Icon`/lucide convention the existing role icon (`log-in`/
    `log-out`) on the same row already uses, just smaller since this is a
    secondary/unobtrusive signal, not a new column.
  - **Bug hit and fixed along the way, worth flagging for future icon
    additions on this page**: my first attempt used Tailwind's `inline`
    display class on the icon's own `class` (alongside `h-2.5 w-2.5`) —
    rendered as a genuinely zero-width, invisible element (confirmed via
    `boundingBox()` in a throwaway Playwright check: `width: 0`). Root
    cause: CSS spec — `width`/`height` do not apply to non-replaced inline
    elements at all, and the Tailwind `inline` utility set `display: inline`
    with high enough cascade precedence to override the Nuxt Icon
    component's own default (implicitly `inline-block`-ish sizing). Fix:
    use `inline-block` instead of `inline` in that class list. The existing
    on-page icons (`log-in`/`log-out`, `ManaSymbol` icons) never hit this
    because none of them add an explicit `inline` class — worth remembering
    if a future task adds another small inline icon here: don't add `inline`
    to a sized `Icon`, only `inline-block` (or nothing, relying on the
    component's own default).
  - Verified live (dev server on :3000, Playwright — first via a scratch DOM
    dump script, in-tree-then-deleted, same pattern prior sessions used)
    against fin/293 (Zanarkand, multi-face) and fin/1 (Bahamut, single-face):
    both cards show a real mix of green-link and muted-broken-link icons
    across their own rows (e.g. Zanarkand's "Main card" mana fact is
    green-linked, all three "Other faces/functions" facts are
    broken-link/unannotated; Bahamut has 6 linked and 2 unannotated rows
    among its 8), confirmed both by raw DOM inspection (icon name class
    present) and a zoomed 3x-devicePixelRatio screenshot showing the two
    icon states are visually distinct at actual table size. `npm run
    typecheck` clean (exit 0) both before and after the `inline`→
    `inline-block` fix.
  - No contract mismatch found against `.claude/contracts/card-schema.md`
    this round — purely a card-owned display addition reading existing
    `annotatedCard.faces[].oracleLines[].facts[]` data the server already
    produces; no new engine-owned shape needed or touched.
  - Did not touch the part 9 face-grouping fallback logic itself, per the
    task's explicit instruction (a separate engine-side `Fact.face` field is
    coming to replace part of that heuristic later) — `mainFaceFactKeys`'s
    OWN behavior is unchanged, only its implementation was refactored to
    share code with the new `annotatedFactKeys`.

- 2026-09-09 (follow-up, part 11): Simplified part 10's per-row annotation
  icon per explicit request — drop the "unannotated" state entirely instead
  of showing a broken-link icon for it, and make the remaining icon more
  subtle.
  - `app/pages/app/card/[set]/[number].vue`: the `Icon` in each Facts row's
    description `<td>` is now `v-if="isFactAnnotated(row.fact)"` with a
    single fixed `name="lucide:link-2"` — removed the ternary entirely, so
    there's no `lucide:link-2-off` branch/markup left anywhere in the file.
    Also shrank it further per a mid-task coordinator message (already-small
    `h-2.5 w-2.5 text-emerald-500/70` → `h-2 w-2 text-emerald-500/40`) for a
    lower-key look. `isFactAnnotated`/`annotatedFactKeys`/`factKeysInFaces`
    (part 10's helpers) are unchanged — only the template's icon rendering
    changed.
  - Verified live (dev server on :3000, scratch Playwright DOM-dump script,
    in-tree-then-deleted, same pattern prior parts used) against fin/1
    (Bahamut): 6 of 8 rows show the small emerald `link-2` icon
    (`iconClass` confirms `h-2 w-2 ... text-emerald-500/40`), the other 2
    rows have `hasIcon: false` — no icon element present at all, not just an
    invisible/zero-opacity one.
  - `npm run typecheck`: 0 errors touching `[number].vue`. 7 pre-existing
    errors remain in `app/lib/factConditions.test.ts` (missing `id` field on
    hand-written `Fact`/`EventFact` test literals) — these are the `engine`
    agent's in-flight `id`/`EventFact` schema rollout already visible in
    `git status` at session start, not caused by or related to this edit;
    confirmed by grepping the typecheck output for `number.vue` (zero hits)
    and noting these test-literal shapes have nothing to do with the Facts
    table template.
  - No contract mismatch found this round.

- 2026-09-09 (follow-up, part 10): Facts tab's rightmost "conditions" column
  switched from a hand-maintained field allowlist to an exclusion list, plus
  extracted + unit-tested per explicit user feedback ("fact-display bugs
  keep slipping through manual/visual QA").
  - New `app/lib/factConditions.ts` — `factConditions(fact: Fact): string`,
    moved out of `app/pages/app/card/[set]/[number].vue` verbatim in spirit
    but inverted: `HIDDEN_FACT_KEYS = new Set(['value','role','sourceText'])`
    (the three fields already rendered elsewhere in the row —
    `ValueBar`/role-icon/`title` tooltip respectively); every OTHER field
    on the fact (`id`, `event`/`zone`, `controller`, `subject`, `tapped`,
    `types`, `colors`, `color`, `counterType`, `target`, `cmc`, `amount`,
    `name`, `oncePerTurn`, `highlight`, and the brand-new `face` field
    landing concurrently this session — see below) now shows automatically,
    with no lockstep update to this file required when the schema grows.
    Root cause this was fixing: the old `CONDITION_KEYS` allowlist had
    silently never included `subject` (e.g. the-gold-saucer's Treasure
    `entersBattlefield`/battlefield-presence facts, `subject:
    {token:"c_a_treasure_sac"}`, showed `—` despite real info existing) —
    an allowlist drops a field it wasn't updated for; an exclusion list
    can't.
  - `app/pages/app/card/[set]/[number].vue`: removed the old `CONDITION_KEYS`
    const + inline `factConditions` function entirely, replaced with a
    plain import off the new module. No other page logic touched.
  - New `app/lib/factConditions.test.ts` (precedent: `app/lib/scenarioReplay
    .ts` + its own `.test.ts` sibling — plain, Vue-free `.ts` module next to
    a same-named vitest file, same pattern followed here), 6 real cases:
    hidden-only fields → `'—'`; real constraint fields (`types`/`cmc`) show
    verbatim alongside `id`/`zone`; `subject` specifically included (the
    regression this whole task was about); a synthetic brand-new field
    (`face`) included automatically with ZERO changes to the function or
    its exclusion set (proving the exclusion-based approach actually
    generalizes, not just "we patched the one field that broke"); an
    explicit `undefined` hidden-field is omitted (not rendered as literal
    `"undefined"`); an explicit `undefined` SHOWN field is likewise omitted.
    All 6 pass. Note: a real, well-typed `Fact` always carries `id` plus
    `zone`/`event` (both now shown, neither hidden), so the true "nothing
    to show at all → '—'" branch can't actually be constructed from the
    real `Fact` union type — that one test uses an `as unknown as Fact`
    cast specifically to isolate the hidden-key logic itself, documented
    inline as such (not a claim this exact shape occurs on disk).
  - Ran the FULL `npx vitest run` (not just the new file) — 273 passed
    (including the new 6), the same pre-existing 5 failures as always
    (missing `tagging/` dir, historical-sets-project data not present in
    this checkout, confirmed unrelated to this change). `npm run typecheck`
    clean (exit 0).
  - Verified live (Playwright, dev server on :3000) against fin/279 The
    Gold Saucer (the user's own concrete example): the conditions column
    now shows real `subject` values (`"subject":"self"`,
    `"subject":{"token":"c_a_treasure_sac"}`) alongside `id`/`event`/`zone`/
    `controller`/`highlight`/`types` — previously-hidden info now visible,
    nothing regressed (row markup/hover/icons all unchanged).
  - **Concurrency note**: this file was being actively edited by a peer
    session (session-2) at the same time, extending my own part-9 face-
    splitting grouping work (added `factKeysInFaces`/`isFactAnnotated`/an
    annotation icon, and — per `functional-model/synergy.ts`'s own new
    `Fact.face?: 'front'|'back'` field, author-set, added concurrently —
    presumably wiring that real field into the grouping instead of the
    sourceText-based heuristic I'd flagged as unreliable in part 9). Diffed
    the file before starting and re-checked `git status`/`git diff --stat`
    before finishing — my own change stayed scoped to `CONDITION_KEYS`/
    `factConditions` (removed) + the new import line; did not touch
    `factRowGroups`/`mainFaceFactKeys`/`annotatedFactKeys`/`isFactAnnotated`
    or any of session-2's own in-flight additions there.
  - The new `Fact.face` field (see `functional-model/synergy.ts`'s own
    extensive doc comment on it, added this session) is exactly the
    engine-schema fix I flagged as an open question in part 9 — good to
    see it landed; not this task's own concern to verify its wiring into
    the grouping logic (that's session-2's/`engine`'s work), only that
    `factConditions` picks it up automatically in the conditions column,
    which it does (confirmed in the unit test, not yet spot-checked live
    against a card that actually sets it — none of Zanarkand/Ishgard's own
    facts had `face` set on disk as of this check).

- 2026-09-09 (follow-up, part 12): Swapped the part-9 multi-face Facts
  grouping over to prefer engine's new `Fact.face?: 'front'|'back'`
  (`functional-model/synergy.ts`, author-set, backfilled on all 33
  multi-face cards) instead of the oracle-text-linking heuristic, per
  explicit task — closes the exact gap part 9/part 10's own notes had
  already flagged and recommended `Fact.face` as the fix for.
  - `app/pages/app/card/[set]/[number].vue`: new `isMainFaceFact(row:
    FactRow): boolean` — `face === 'front'` → true, `face === 'back'` →
    false, `face` unset → falls back to the existing `mainFaceFactKeys`
    (oracleLines-linking heuristic, UNCHANGED itself, kept as a safety net
    per the task's explicit instruction rather than deleted). `factRowGroups`
    now calls `isMainFaceFact(row)` instead of directly consulting
    `mainFaceFactKeys.value.has(row.key)`. Rewrote the stale header comment
    above `annotatedFactRefKey` (previously described the heuristic as the
    primary/only mechanism) to describe `face`-first-with-heuristic-fallback
    and reference the Sidequest bug as the motivating example, trimmed the
    now-resolved "KNOWN GAP" essay down since it's fixed, not open, now.
  - Did NOT touch `mainFaceFactKeys`/`factKeysInFaces`/`annotatedFactKeys`/
    `isFactAnnotated` (part 10's per-row annotation icon, and the fallback
    heuristic itself) — those stay exactly as-is, still used either as the
    fallback path or for the independent "is this fact linked to oracle
    text anywhere" icon question.
  - Verified live (Playwright, dev server on :3000 — already running,
    scratch script `.tmp-verify-face-grouping.mjs` in repo root during the
    check, deleted after): fin/31 Sidequest: Catch a Fish // Cooking
    Campsite — "Main card" now correctly shows 3 rows including
    `wants-artifact-or-creature-on-top` ("(Creature/Artifact) cards in your
    library" — the specific fact the task was about, `face: "front"` in its
    synergy.json), "Other faces/functions" shows the 3 back-face facts
    (creature-count sink, +1/+1 counters, mana production) — confirmed by
    reading `functional-model/cards/sidequest-catch-a-fish-cooking-campsite/
    synergy.json` directly alongside the rendered table. fin/293 Zanarkand
    and fin/283 Ishgard — both unchanged from part 9's own outcome ("Main
    card" = mana fact only, "Other faces/functions" = the rest), now
    reached via `face` (both cards' facts already carry explicit
    `front`/`back` values per the engine backfill) rather than the
    heuristic — same visible result, different code path, as the task
    expected.
  - `npm run typecheck` clean (exit 0).
  - No contract mismatch found against `.claude/contracts/card-schema.md`
    this round — `Fact.face` was already the recommended/expected shape
    from part 9's own flag; nothing here surprised.

- 2026-09-09 (follow-up, part 11): Course-corrected part 10's own fix —
  a flat `{value,role,sourceText}`-only exclusion (part 10) was too blunt:
  user caught that `{"zone":"Battlefield","controller":"you","types":
  {"has":["Artifact"]}}` (Gold Saucer's artifact-sink) already fully
  encodes `zone`/`controller`/`types` in its own `describeFact` label
  ("artifact permanents you control on the battlefield") — showing that
  same JSON verbatim is pure noise. Real rule: hide a field only when THIS
  fact's own `describeFact` branch actually folds it into the label —
  genuinely branch-dependent, so I re-read `describeFact`
  (functional-model/synergy.ts) line by line rather than trusting the
  coordinator's own (explicitly caveated) recollection of it, and cross-
  checked every verdict against the real corpus before landing anything.
  - Found and corrected TWO real discrepancies against the coordinator's
    own per-field claims (flagged rather than silently forced to fit):
    1. **`types`**: `constraintBits` only ever folds `.has`/`.hasAny` —
       `.not` is NEVER rendered anywhere, contra "types always folded."
       `factConditions` now shows a `{not: [...]}` remainder when present.
    2. **`controller`**: NOT "every branch that reads it converts to a
       prefix." Only true for zone facts and `lifegain`/`addMana`/`dies` —
       `putCounter`/`drawCard(s)`/`entersBattlefield`/`playLand`/
       `activateAbility`/`coinFlip` NEVER reference `fact.controller` at
       all. Confirmed via 3 REAL corpus facts (ice-flan,
       omega-heartless-evolution, ultros-obnoxious-octopus) that put stun
       counters on an OPPONENT's creature (`controller:'opp'`) — a blanket
       "always hide controller" would have made that indistinguishable
       from targeting your own board. Landed a hybrid rule instead: zone
       facts and lifegain/addMana/dies always hide `controller` (both
       'you'/'opp' fully spelled out either way); every other named branch
       hides it ONLY when `'you'` (the same unstated-by-convention default
       `describeFact`'s own doc comment establishes), showing `'opp'` since
       that's real, otherwise-invisible information. Verified this hybrid
       against the coordinator's own 5 given example facts (all 5 still
       resolve exactly as they specified) AND against 74 real zone-fact-
       with-`controller:'opp'` corpus facts (e.g. bartz-and-boko) that a
       naive "hide only 'you', show 'opp'" rule applied everywhere would
       have broken (reintroducing the exact redundant-noise problem this
       task exists to fix, since a qualified Battlefield zone fact spells
       out "an opponent controls" just as explicitly as "you control").
  - Also verified (matched coordinator's claims exactly, no discrepancy):
    `subject:'self'` trivial/hidden, any other `subject` value real/shown;
    `cmc` whole-object-folded whenever present, but ONLY on a zone fact or
    an event fact whose `event` isn't one of `describeFact`'s 10 named
    branches (falls to the generic `` `${qualifier}${event}` `` fallback —
    confirmed real fallback-event names exist in the corpus, e.g.
    `lifeloss`/`landfall`/`damage`, where `types`/`cmc` genuinely DO fold);
    `counterType` folded only for `putCounter`; `event` always hidden
    (paraphrased either way); `target` always shown, no triviality
    special-case (unlike `subject`) since `describeFact`'s own `dies`
    branch genuinely branches its OUTPUT text on `target === 'self'`, not
    purely inert; `id`/`highlight` excluded as bookkeeping (my own
    addition from part 10, re-confirmed still right).
  - Also found (via a live corpus grep, not just the given examples): 2
    real `entersBattlefield` facts (loporrit-scout, woodland-weavemaster)
    carrying a real `types.has` filter that branch's own "enters the
    battlefield" label never states — confirms `types` must stay verbatim
    on named-but-non-folding branches, not just the zone/fallback case.
  - `app/lib/factConditions.ts`: full rewrite along these lines — explicit
    `EVENTS_WITH_HAND_WRITTEN_LABEL` (mirrors `describeFact`'s 10 named
    `if (event === ...)` branches) and `EVENTS_ALWAYS_CONSUMING_CONTROLLER`
    (`lifegain`/`addMana`/`dies`) sets, a `typesRemainder()` helper for the
    `.not`-only case, all documented with the SAME "known duplication
    risk, safe-direction-to-be-wrong" framing part 10 already established
    (a missed new branch shows a field too generously, never hides one
    forever — the original bug's failure mode, not this one's).
  - `app/lib/factConditions.test.ts`: rewritten, 16 cases — the
    coordinator's own 5 concrete example facts verbatim (all pass exactly
    as they specified once the hybrid controller rule replaced the naive
    blanket one), the real corpus-informed regressions above (putCounter+
    opp shown, putCounter+you hidden, zone+opp still hidden, `types.not`
    shown, `entersBattlefield`+`types.has` shown, fallback-event+types/cmc
    folded), plus the part-10 carryovers (`subject`, brand-new `face`
    field, undefined-value omission, `target` always shown including the
    literal `'self'` sentinel).
  - Full `npx vitest run`: 283 passed (up from 273 — 16 new tests here vs.
    6 in part 10, replacing them), same pre-existing 5 unrelated failures.
    `npm run typecheck` clean (exit 0).
  - Verified live (Playwright, dev server restarted per the coordinator's
    own stale-HMR note) against fin/279 The Gold Saucer (all facts read
    exactly right — the artifact-sink now genuinely shows `—`, mana shows
    `{"color":"C"}`, Treasure facts show `{"subject":{"token":
    "c_a_treasure_sac"}}`), fin/55 Ice Flan (stun-counter fact now shows
    `{"controller":"opp","target":{"types":{"has":["Creature"]}}}` — the
    real bug this round was actually about, now visible), and fin/175
    Bartz and Boko (opponent-creature-sink zone fact still correctly shows
    `—`, confirming the naive rule I explicitly avoided would have broken
    this one).
  - **Concurrency**: re-checked `git diff --stat`/`git status` before
    finishing — this round only touched the two new `app/lib/
    factConditions*` files (rewritten in place, not renamed) plus this
    notes file; `app/pages/app/card/[set]/[number].vue` itself untouched
    this round (only the part-10 import/removed-block edits already there
    from before), and session-2's own in-flight face-splitting/`Fact.face`
    work in that same page file remains untouched by me.

- 2026-09-09 (follow-up, part 12): Facts tab row ORDER switched from
  `[...sink, ...source]` concatenation to the card's own printed
  oracle-text order, per explicit user request against fin/279 The Gold
  Saucer (the lone artifact-sacrifice sink fact — logically tied to the
  card's LAST ability — was rendering as row 1). Landed alongside session-
  2's already-merged `Fact.face` grouping work (part 11's/`isMainFaceFact`
  code) without touching its own grouping logic.
  - New `app/lib/factOrder.ts` (worth extracting, per the `factConditions`
    precedent — this logic is complex enough to want real unit coverage,
    same "fact-display bugs keep slipping through" reasoning): exports
    `FactRow` (moved out of the page, now the shared/canonical definition —
    the page imports it instead of redeclaring), `annotatedFactRefKey`
    (also moved out, still used by the page's own `factKeysInFaces` too),
    and `orderByTextPosition(rows, faces)` — the actual reordering.
  - Mechanism (exactly per the task brief, reusing existing machinery, no
    raw string matching): walks `faces`' own `oracleLines` top-to-bottom/
    left-to-right, assigning each fact its first-occurrence TEXT POSITION.
    A fact with no textual anchor at all inherits the nearest PRECEDING
    fact's position in `rows`' own authored order (source-array-then-sink-
    array — `factRows` itself changed from `[...sink,...source]` to
    `[...source,...sink]` to serve as this authored/tiebreak base; this is
    now only an INTERNAL ordering, not the final displayed one). A fact
    with nothing positioned before it at all sorts to the very front, in
    plain authored order.
  - **Tiebreak** (landed via a SEPARATE coordinator follow-up mid-task,
    user's own words: "if there is a line, which is both a source and a
    sink (i.e. sacrifice) - sink should go first"): two facts sharing the
    exact same RESOLVED position sort sink-before-source, then authored
    order. Deliberately does NOT apply this reordering to a tie with NO
    resolved position at all (nothing anchored anywhere in that face
    group) — verified this distinction matters for real data: Zanarkand's
    3 wholly-unanchored "Other faces/functions" facts (token-creation
    source, putCounter source, wants-lands sink) would have had the sink
    jump to the front for no textual reason if the tiebreak applied
    unconditionally there too; instead they keep plain authored order
    (token-creation, putCounter, wants-lands) — a real, deliberate design
    choice I made and flagged in this file's own header comment, not
    something the coordinator explicitly spelled out for this exact case
    (they only asked me to verify Zanarkand doesn't regress, without
    asserting its own expected order) — if this reads wrong, it's a one-
    line change (drop the `pos === undefined` guard on the tiebreak
    branch) to make it unconditional instead.
  - Applied PER FACE GROUP independently in `factRowGroups` (front face
    alone for "Main card," every other face for "Other faces/functions") —
    never one global cross-face position, per the task's own explicit
    requirement.
  - `app/lib/factOrder.test.ts` — 6 cases: the exact fin/279 Gold Saucer
    scenario end-to-end (matches the user's own final expected order,
    post-tiebreak-correction, exactly); the Zanarkand wholly-unanchored
    no-sink-jump case; a trivial single-fact pass-through
    (Adventurer's-Inn-shaped); the sink-before-source tiebreak in
    isolation; inheriting a position across MULTIPLE consecutive
    unanchored facts; and a case where authored order and text order are
    flatly reversed, to prove text position actually wins.
  - Full `npx vitest run`: 331 passed (up from 283 — includes my 6 new
    factOrder tests plus additional tests session-2 landed concurrently in
    `functional-model/synergy.test.ts`, not mine), same 5 pre-existing
    unrelated failures. `npm run typecheck` clean (exit 0).
  - Verified live: killed and restarted the dev server fresh first (the
    session's own recurring stale-HMR gotcha — see NEXT_STEPS.md — plus
    the coordinator's own explicit reminder this round), then Playwright
    screenshots against fin/279 (exact expected order, sink-before-source
    tiebreak visibly correct — artifact-sink row before card-draw row),
    fin/293 Zanarkand (grouping AND the new ordering both work together;
    "Other faces/functions" now reads Battlefield presence / +1/+1
    counters / Land permanents..., i.e. plain authored order, not the old
    sink-first-by-accident-of-concatenation order), and fin/271
    Adventurer's Inn (single fact, unchanged, no regression).
  - **Concurrency**: re-confirmed via `git diff --stat`/`git status`
    before finishing — this round's page-component edit is additive/
    surgical (new imports, `factRows`'s own array-concat order flipped,
    `factRowGroups`'s two `orderByTextPosition` calls, the now-redundant
    local `FactRow` type/`annotatedFactRefKey` function removed in favor
    of the new imports) and does not touch `isMainFaceFact`/
    `mainFaceFactKeys`/`annotatedFactKeys`/`isFactAnnotated` or any of
    session-2's own grouping logic, which is already merged and untouched.
    `functional-model/synergy.test.ts` shows as modified in `git status`
    but that's session-2's own concurrent engine-side work, not mine.

## Open questions

(none yet)
