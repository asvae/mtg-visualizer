<!-- Verbatim archive slice of the old card/notes.md (pre-2026-09-18 migration to the topics/ hub). Grep-only, not read on spawn. Durable facts already extracted into ../topics/*.md. -->

  `annotatedFaces[0]` vs `annotatedFaces[1]`'s own `.name` — falls back to
  `card.value.name` if a face is missing. This matters for a real
  multi-face card: `card.value.name` on a DFC is the COMBINED name (both
  faces joined by " // "), which would misleadingly show e.g.
  "(Zanarkand, Ancient Metropolis // Lasting Fayth)" on a fact that's only
  about the adventure-spell half — verified live this actually happens
  correctly on fin/221 (Garland, Knight of Cornelia // Chaos, the Endless):
  its two front-face self facts show "(Garland, Knight of Cornelia)", its
  one back-face self fact (found by scanning every `synergy.json` for a
  `face:'back'` fact with `subject`/`target: 'self'` — fin/293 Zanarkand
  turned out to have no self-referencing facts at all, so couldn't be used
  for this half of the check) correctly shows "(Chaos, the Endless)", not
  the combined name or the front face's name. Also verified live on fin/1
  exactly per the task's own worked example: "Cast a spell", "Battlefield
  presence" (self one), "Graveyard presence", "Dying" (self one) all show
  "(Summon: Bahamut)"; the OTHER "Dying"/"Battlefield presence" rows (real,
  non-self `controller`/`target` data) are unaffected ("either player's ·
  nonland permanent", "yours", "opponent's"). Updated
  `factConditions.test.ts`'s 3 self-referencing cases: one kept as
  no-`cardName`-given -> literal "self" (documents the fallback), the
  other two now pass a `cardName` and assert the parenthesized-name output.
  `npx vitest run app/lib/factConditions.test.ts app/lib/factOrder.test.ts`:
  26/26 pass. `npx vue-tsc --noEmit`: exit 0, no output.
  No contract mismatch found against `.claude/contracts/card-schema.md`
  this round — this stayed a pure app/-side (card-page + its own lib)
  change, no engine-side shape touched.

- 2026-09-10 (small follow-up to the `factConditions.ts` rewrite earlier
  today): self-referencing facts (`subject`/`target` literally `'self'`)
  now render the literal word `'self'` in the Facts tab's notes column
  instead of being hidden/blank. `factConditions()`'s
  `if (!isSelfReferencing(fact)) bits.push(controllerPhrase(...))` became an
  if/else that pushes `'self'` in the self-referencing branch — everything
  else (yours/opponent's/either player's for non-self facts, recipient/
  type-constraint phrases) untouched. Updated both doc comments that used
  to describe self-referencing as "omitted"/"nothing to add" (top-of-file
  block + `isSelfReferencing`'s own comment) to say it renders literal
  "self" instead. Updated the 3 affected `factConditions.test.ts` cases
  (self-battlefield/self-sacrifice/self-dies) from expecting `'—'` to
  expecting `'self'` — `npx vitest run app/lib/factConditions.test.ts`
  (19/19 passed) and `npx vue-tsc --noEmit` (exit 0) both clean.
  Verified live via a throwaway Playwright script (repo-root temp file,
  deleted after) against the already-running dev server (localhost:3000):
  fin/1 Summon: Bahamut's Facts tab now shows "self" for Cast a spell,
  Battlefield presence, Graveyard presence, and Dying (self-referencing
  facts) — confirms the parallel engine-agent self-cast fact had already
  landed and renders correctly through this change too — while non-self
  rows (Dying → "either player's · nonland permanent", Card draw →
  "yours", Damage → "yours · to the opponent", the two Battlefield
  presence sink rows → "yours"/"opponent's") are unaffected. No contract
  mismatch found against `.claude/contracts/card-schema.md`.

- 2026-09-10: Fixed Facts tab capitalization bug in
  `app/pages/app/card/[set]/[number].vue` — label cell relied on CSS
  `first-letter:uppercase`, which only affects the first TEXT NODE; rows
  whose label is preceded by the "linked to card text" icon (a sibling
  `<Icon>` element, not part of the text node) silently didn't get
  capitalized, while icon-less rows did. Confirmed live on fin/1: exactly
  the rows with the link icon (Graveyard presence, A creature dying, Card
  draw, Damage, 2nd Battlefield presence, Opponent's battlefield presence)
  were lowercase; icon-less rows (Battlefield presence, Dying) were fine —
  matches the bug report exactly. Root cause was flagged as a known risk in
  an earlier note; this confirms it as a real bug, not just theoretical.
  Fix: added `factLabel(fact)` helper (capitalizes `describeFact(fact)`'s
  string directly, `charAt(0).toUpperCase() + slice(1)`), used it in the
  template instead of raw `describeFact(fact)`, and dropped the
  `first-letter:uppercase` class entirely. Did NOT touch `describeFact()`
  itself (`functional-model/synergy.ts`, engine-owned — stays lowercase
  there per task instructions).
  Same task also fixed a related alignment bug (icon presence shifting
  label start position): wrapped icon + label in an `inline-flex` row with
  a fixed-width icon slot (`h-2 w-2` span, `v-if` only on the `<Icon>`
  inside it, not the slot) so every row's label starts at the same x
  regardless of whether that row has the link icon.
  Verified via a throwaway Playwright script (`playwright-core`, already a
  local devDependency) against the running dev server (localhost:3000,
  already up) — screenshotted fin/1 and extracted all 8 fact rows' label
  text + icon presence: every row capitalized correctly regardless of
  icon, and labels visually aligned in the screenshot. `npx vue-tsc
  --noEmit` clean. No contract mismatch found — this was a card-page-only
  rendering bug, `card-schema.md` wasn't implicated.

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

- 2026-09-10: Facts tab top-level grouping switched from face-only
  ("Main card"/"Other faces/functions", part 9-12 above) to a new
  role-first, two-level split, per explicit user request — "Source" and
  "Sink" (each fact's existing `role: 'source'|'sink'` field, already on
  every generated `synergy.json` fact per `.claude/contracts/card-schema.md`
  — no new data needed) are now the OUTERMOST groups; the pre-existing
  face-based grouping is now nested one level inside each role section
  instead of being the outermost split.
  - `app/pages/app/card/[set]/[number].vue`: renamed/refactored
    `factRowGroups` → `faceGroupsFor(rows)` (same face-split-then-
    `orderByTextPosition` logic as before, now a plain function taking an
    already-role-filtered row list instead of a computed over the full
    list; also now filters an empty `rows` input to `[]` up front, fixing a
    latent bug where a single-faced card with e.g. zero sink facts would
    have rendered one spurious empty-rows group). New `sourceRows`/
    `sinkRows` computeds (filter `factRows` by `row.fact.role`), and new
    `factRoleGroups` computed — `[{role:'source',label:'Source',groups:...},
    {role:'sink',label:'Sink',groups:...}]`, filtered to drop a role with
    zero groups (e.g. a card with no sink facts shows only a Source
    section, no empty Sink header).
  - Template: outer `<tbody v-for="roleGroup in factRoleGroups">` renders
    one role header row per section (reuses the existing per-row role
    icon/color convention — `lucide:log-out` blue for Source, `lucide:log-in`
    emerald for Sink — at slightly larger size, `text-[10px]` uppercase,
    matching the page's other section-header styling, e.g. "Interactions").
    Inside each role's `<tbody>`, a `<template v-for="group in
    roleGroup.groups">` renders the pre-existing face sub-header (unchanged
    "Main card"/"Other faces/functions" text, now visually subordinate —
    smaller `text-[9px]`, `pl-4` indent, `text-muted/70` — nested under its
    role) only when `group.label` is set, then that group's rows. Individual
    fact `<tr>` markup (ValueBar/role-icon/`describeFact`/conditions column,
    hover-highlight wiring) is byte-for-byte unchanged — only which
    `<tbody>`/group a row lands in changed, per the task's own constraint.
  - `app/lib/factOrder.ts`: doc-comment-only change — updated the stale
    `factRowGroups` reference to `faceGroupsFor`, and added a note that the
    sink-before-source same-position tiebreak (still present, unchanged
    code) is now effectively inert in practice since a single
    `orderByTextPosition` call only ever sees one role's rows post-refactor
    — harmless dead capability, not removed, in case a future caller merges
    roles back into one call.
  - Verified live (Playwright, already-running dev server on :3000):
    fin/1 Summon: Bahamut (single-faced, this task's own verification
    target) — Facts tab now shows a "SOURCE" header (blue log-out icon) with
    its 6 rows (Battlefield presence, graveyard presence, Dying, a creature
    dying, card draw, damage), then a "SINK" header (emerald log-in icon)
    with its 2 rows (battlefield presence, opponent's battlefield presence)
    below — confirmed via both a raw DOM structure dump (tbody/header/row
    breakdown) and a screenshot. fin/293 Zanarkand (multi-face, regression
    check for the nested nesting) — Source section shows its own "Main
    card" (1 mana row) then "Other faces/functions" (2 rows) sub-groups;
    Sink section shows only "Other faces/functions" (1 row, no empty "Main
    card" sub-header since Zanarkand's front face has no sink facts) —
    confirms both the two-level nesting and the new empty-group filtering
    work correctly together.
  - `npm run typecheck` clean (exit 0). `npx vitest run
    app/lib/factOrder.test.ts app/lib/factConditions.test.ts` — 22/22 pass
    (factOrder's own tests never exercised cross-role tiebreak-vs-grouping
    interaction with the page component, so no test file needed updating).
  - Repo has substantial unrelated concurrent work in flight this session
    (CLAUDE.md/.claude/agents/engine.md edits, and `engine` actively
    regenerating `functional-model/cards/summon-bahamut/scenarios.ts` +
    `trace.json` — the Scenarios tab's own data for the SAME card I used to
    verify this — while I was working). Confirmed via `git diff` that
    `summon-bahamut/synergy.json` itself (the file the Facts tab reads) was
    untouched by that concurrent work, and that my own diff stayed isolated
    to `app/pages/app/card/[set]/[number].vue` + `app/lib/factOrder.ts` (no
    edits to any `functional-model/` file, no reverting of the concurrent
    scenarios/trace changes).
  - No contract mismatch found against `.claude/contracts/card-schema.md`
    this round — `role` was already documented as present on every
    generated `Fact`; this was purely a card-owned display-grouping change.

- 2026-09-10 (later same day): Reverted the above role-first split
  entirely, per direct user correction — Facts must stay a single flat
  list ordered by card-text position (`orderByTextPosition`, unchanged
  logic) across ALL facts regardless of role, with the pre-existing
  face-based grouping ("Main card"/"Other faces/functions") as the only
  top-level split; `Fact.role` stays a per-row icon only (unchanged
  `lucide:log-out`/`lucide:log-in` convention), never promoted to a
  SOURCE/SINK section header.
  - Confirmed via `git diff` that the entire diff on both
    `app/pages/app/card/[set]/[number].vue` and `app/lib/factOrder.ts` was
    self-contained to this same-day role-split change (no interleaving
    with the session's other concurrent unrelated work — engine's
    `synergy.ts`/`synergy.test.ts`, `summon-bahamut/scenarios.ts`+
    `trace.json`, `CLAUDE.md`/`.claude/agents/engine.md`), so reverted both
    files wholesale with `git checkout --` rather than hand-editing —
    restores byte-for-byte the pre-role-split committed state (commit
    `21c670d`'s own `factRowGroups`/`isMainFaceFact` grouping, `FactRow`
    icon-per-row markup unchanged throughout both the add and the
    revert). Confirmed those other files' diffs untouched afterward.
  - Verified live: killed and restarted the dev server fresh (this
    session's own recurring stale-HMR gotcha), then a throwaway
    Playwright DOM dump (script written to repo root for `node_modules`
    resolution, deleted before finishing) against fin/1 Summon: Bahamut
    and fin/293 Zanarkand. fin/1: single `<tbody>` with facts rendered
    (no header row at all — single-faced, matches pre-split behavior),
    all 8 facts in one text-ordered list, 6 with the blue
    "Source — this card provides this" icon title then 2 with the emerald
    "Sink — this card wants this" icon title (mixed-by-text-position, not
    role-grouped) — confirms both (a) single flat list and (b) per-row
    icon intact. fin/293: exactly two header rows, "Main card" and "Other
    faces/functions" — the face-only top-level grouping — no SOURCE/SINK
    headers anywhere on either page.
  - `npm run typecheck`: exit 0. `npx vitest run app/lib/factOrder.test.ts
    app/lib/factConditions.test.ts`: 22/22 pass.
  - No contract mismatch found against `.claude/contracts/card-schema.md`
    this round.

- 2026-09-10: Interactions panel now follows the Facts tab's own rendered
  order instead of its independent sort. Root cause: `findInteractionsForCard`
  (engine-owned, `functional-model/synergy.ts`) ships interaction groups in
  plain sink-then-source AUTHORED order — that was also the Facts tab's own
  order once, but the Facts tab moved to `orderByTextPosition`
  (`app/lib/factOrder.ts`, printed-oracle-text order) a while back and
  Interactions was never updated to match, so the two silently diverged.
  Fixed entirely client-side in `app/pages/app/card/[set]/[number].vue`
  (not by touching the engine's matcher — display order is a card/UI
  concern per `.claude/contracts/card-schema.md`, not the matcher's):
  - `factOrderIndex`: a `Map<factKey, position>` built by flattening
    `factRowGroups` (the Facts tab's own FINAL per-group post-
    `orderByTextPosition` output) in display order.
  - `orderedInteractions`: `data.interactions` sorted by
    `factOrderIndex.get(factKey(group.fact))` (a fact with no match in the
    map — shouldn't happen, every interaction fact comes from this same
    card's own facts — sorts last rather than throwing).
  - Template's Interactions `v-if`/`v-for` now read `orderedInteractions`
    instead of `data.interactions` directly.
  - Chose "derive from Facts tab's own computed output" over reimplementing
    `orderByTextPosition`'s main/other-face split a second time for
    Interactions — single source of truth, can't drift from Facts again.
  - Verified live via a throwaway Playwright script (temp `data-debug-
    fact-id` attributes added to both the Facts `<tr>` and Interactions
    `<li>` for the check, reverted before finishing — confirmed via
    `git diff` the reverted lines are gone): fin/1 Summon: Bahamut —
    Interactions order `[self-battlefield, self-sacrifice, self-dies,
    destroy-nonland, mega-flare-you]` is an exact, order-preserving
    subsequence of the Facts order `[self-battlefield, self-sacrifice,
    self-dies, destroy-nonland, chapter-iii-draw, chapter-iv-damage,
    mega-flare-you, mega-flare-opp]` — and confirmed this WASN'T true
    before the fix (raw server-side order was `[mega-flare-you,
    self-battlefield, destroy-nonland, self-sacrifice, self-dies]`).
    fin/293 Zanarkand (the multi-face regression card): `/api/card/fin/293`
    genuinely returns zero interactions in the current pool (no other
    modeled card matches its facts) — Interactions panel doesn't render at
    all there (`v-if="orderedInteractions.length"` false), so there's
    nothing to visibly demonstrate reordering on; confirmed only that nothing
    crashes and the (unrelated, empty) Facts-tab multi-face grouping stays
    intact. `npm run typecheck`: exit 0 both before and after the revert of
    the debug attributes.
  - No contract mismatch found against `.claude/contracts/card-schema.md`
    this round — confirms the existing note there ("`card` must not assume
    `Effect`/matcher internals beyond generated output") already covers
    keeping this fix client-side rather than reaching into the engine.

- 2026-09-10 (later same day): Rewrote `app/lib/factConditions.ts`'s notes
  column entirely — trigger was the parallel `engine` task making
  `describeFact()` (`functional-model/synergy.ts`) render a fully BARE
  category label always ("Battlefield presence", "Dying", "Damage", ...),
  with zero controller/recipient/type-constraint folding into any branch
  (confirmed by reading the landed diff mid-task — the one deliberate,
  engine-flagged exception is a QUALIFIED zone fact, e.g. `types.has` on a
  Battlefield want, which still renders "artifact permanents you control on
  the battlefield" with both the type AND control phrase — engine's own doc
  comment flags this as a real, open, NOT-yet-resolved inconsistency, out of
  their pass's scope; my notes column doesn't special-case around it, so a
  fact of that shape will show some real duplication between label and
  notes today — flagged here, not fixed, matches this file's own documented
  risk tolerance: over-showing is the acceptable failure direction, never
  hiding).
  - Old design mirrored `describeFact`'s own per-branch folding rules by
    hand (`EVENTS_WITH_HAND_WRITTEN_LABEL`/`EVENTS_ALWAYS_CONSUMING_
    CONTROLLER`/`typesRemainder`) — necessary because different branches
    folded different fields. That's now moot: since NO branch folds
    controller/recipient/target-constraint data anymore, this file no
    longer needs to know anything about `describeFact`'s branches at all.
  - New design, uniform regardless of zone/event: `controller` always
    renders as `"yours"`/`"opponent's"`/`"either player's"` (you/opp/
    undefined) UNLESS the fact is self-referencing (`subject === 'self'` or,
    on an event fact, `target === 'self'` — tautologically "yours",
    matches `effectiveController()`'s own convention in synergy.ts).
    `recipient` (currently damage-only, written generically) renders
    distinctly ("to you"/"to the opponent"/"to either player") so a fact
    with BOTH (Bahamut's Mega Flare: `controller:'you', recipient:'opp'`)
    reads as two clear halves: "yours · to the opponent". `subject` shows
    as `token: <slug>` when it's a real token (unchanged: real info, was
    already shown before). The fact's own top-level `Constraints` fields
    (types/cmc/power/toughness/amount/name) AND an event fact's separate
    `target` (when a real `Constraints` object, not `'self'`) both render
    via a small local `constraintPhrases()` — `types.not:['Land']` on
    `target` → "nonland permanent" (noun picked by zone for a zone fact,
    generic "permanent" for an event's own top-level constraint or its
    `target`). `counterType` stays folded/hidden ONLY when
    `event === 'putCounter'` (matches engine's own kept exception — a
    counter's own kind IS its bare category, per engine's doc comment,
    confirmed by reading it, not just assumed). `color`/`colors`/`tapped`/
    `oncePerTurn` get their own short phrases ("G mana", "tapped", "once
    per turn"). A truly unknown future field still surfaces via a generic
    `key: value`/`key`-only fallback (never raw `{}`/`"` JSON) — kept the
    file's own "exclusion-based, not allowlist" principle alive (the
    original motivating bug, `subject` silently dropped by a hand-maintained
    allowlist, doesn't get reintroduced by this rewrite).
  - Deliberately did NOT import `constraintBits` from
    `functional-model/synergy.ts` despite the task explicitly asking me to
    consider it — `.claude/contracts/card-schema.md` already flags this
    file's existing `describeFact`/`isZoneFact` import as a standing
    engine/card boundary violation and explicitly says "don't add more
    engine-owned functions to that import going forward." Wrote a small
    local `typeBits()`/`ZONE_NOUN` mirror instead (documented inline as a
    deliberate duplicate, same trade already made elsewhere in this
    codebase). Flagging this choice explicitly since the task text read as
    open to either answer — if a future task wants the opposite call (grow
    the import instead of duplicating), that's a deliberate reversal of this
    decision, not an oversight.
  - `app/pages/app/card/[set]/[number].vue`: only change was dropping
    `font-mono` off the conditions `<td>` (was styled as code for raw JSON;
    now it's prose). Did NOT touch `factLabel`/`describeFact` call sites,
    label capitalization, or anything else on that file — confirmed via
    `git diff` that the rest of the file's large uncommitted diff (fact
    label capitalization, Interactions-panel reordering) predates this task
    entirely (verified against my own prior-session notes above), not
    something I added.
  - Rewrote `app/lib/factConditions.test.ts` from scratch (old tests
    asserted the old per-branch-hiding/raw-JSON behavior, now false) — new
    suite includes all 8 real `fin/1` facts verbatim off
    `functional-model/cards/summon-bahamut/synergy.json` (hand-computed
    against the new logic BEFORE running, then verified — all 19 passed on
    the first run with zero fixes needed, cross-checked against the two
    concrete examples in the task brief) plus coverage for cmc/power/
    toughness/amount/name, legacy `color` vs. new `colors`, `tapped`/
    `oncePerTurn`, the unknown-future-field fallback, and an explicit
    "never emits `{`/`}`/`"`" regression check.
  - Verified live: killed and restarted the dev server first (hit the
    documented stale-HMR-module-graph gotcha again — a first Playwright pass
    showed a stale "A creature dying"/"Opponent's battlefield presence"
    label that didn't match the current bare-label source at all; a fresh
    `npm run dev` restart fixed it immediately, no code change needed —
    matches the exact failure mode my own 2026-09-09 note already
    documented). Post-restart, fin/1's Facts tab showed all 8 rows with
    bare labels ("Battlefield presence" ×2, "Graveyard presence", "Dying"
    ×2, "Card draw", "Damage") and readable notes with zero JSON:
    `—` (self-battlefield/self-sacrifice/self-dies), `"either player's ·
    nonland permanent"` (destroy-nonland — exact match to the task's own
    worked example), `"yours"` (chapter-iii-draw), `"yours · to the
    opponent"` (chapter-iv-damage), `"yours"`/`"opponent's"` (mega-flare-
    you/mega-flare-opp — the second is the task's OTHER worked example,
    exact match). `npx vue-tsc --noEmit`: exit 0. `npx vitest run
    app/lib/factConditions.test.ts app/lib/factOrder.test.ts`: 25/25 pass.
  - Contract note: `.claude/contracts/card-schema.md`'s existing flagged
    violation note ("describeFact/constraintBits ... imported and called
    directly by the card page ... don't add more") is still accurate and,
    per this task, now actively load-bearing (it's the reason I duplicated
    `constraintBits` rather than exporting/importing it) — no change needed
    to the contract text itself, just confirming it's not stale.

## Open questions

- 2026-09-10: Investigated a report of a card on `/app/card/fin/N` rendering
  with no image plus stray "Al" text nearby. Could NOT reproduce or find a
  code-level bug despite exhaustive checking:
  - Data shape: wrote a throwaway check of `cardImages()`'s logic
    (`app/lib/buildGraph.ts:76-79` — `card.image_uris` first, else
    `card_faces[].image_uris`) against every entry in both
    `data/fin/fin_scryfall.json` (312 cards) AND `data/cards.db`'s own
    `set_code='fin'` rows (598 rows — more than 312 because the bulk DB also
    carries extra treatments/promos under the fin set code, not a bug, just
    a bigger pool) — zero missing/undefined images in either, across all 5
    FIN layouts (normal 262, transform 27, saga 15, adventure 5, meld 3).
    Manually confirmed each layout's real Scryfall shape: adventure/meld
    have top-level `image_uris` only (no per-face images — `cardImages()`'s
    first branch correctly returns that single image); transform has NO
    top-level `image_uris`, only per-face (`cardImages()`'s second branch
    correctly returns both faces' images).
  - Live rendering: ran a headless-Chromium (Playwright, already a
    devDependency) pass over all 50 non-normal-layout FIN cards' real
    `/app/card/fin/<num>` pages against the running dev server, reading
    every `<img>`'s `naturalWidth`/`complete` after load — zero broken
    images found (including meld's own back-half page, `fin/99b` Ragnarok,
    Divine Deliverance, and every transform/adventure/saga card's main
    image(s)).
  - Interactions-panel thumbnails (a separate image-resolution path —
    `resolveFunctionalModelCardMeta`/`resolveFinCardMeta`/`dbLookupByName`/
    `resolveLiveCardMeta` in `server/api/card/[set]/[number].ts`, not
    `cardImages()`): scanned the REAL `/api/card/fin/<num>` JSON response
    for all 312 FIN cards, looking for any `EnrichedInteractionMatch` with
    `image: null` — zero found across the whole corpus.
  - Tokens (`cardTokens()` in `buildGraph.ts`): a token missing its own
    image is silently DROPPED from the array (`t?.image` truthy check),
    never rendered as a broken `<img>` — by design, not a bug, but worth
    knowing this path can't produce a visibly-broken image either way.
  - No literal "Al" string exists anywhere in `app/` source
    (`grep -rn "\bAl\b"` came up empty) — it's not a hardcoded label/badge.
    The only FIN card whose name starts with "Al" is fin/88 "Al Bhed
    Salvagers" (normal layout, own image confirmed fine, never appears with
    a null-image interaction match anywhere in the corpus either) — flagged
    as the closest lead but unconfirmed; could easily be coincidence.
  - Working theory, unconfirmed: given every code path checked out clean
    end-to-end (data shape + live render + interactions thumbnails, all 312
    cards), the reported sighting is more likely a one-off transient
    Scryfall CDN hiccup or a caught-mid-load frame than a reproducible app
    bug. `(・_・?)` for the orchestrator: if this resurfaces, get the exact
    set/collector-number from the user directly — that's the one thing
    static/automated checking can't substitute for once every code path
    it depends on has already been verified clean.
  - No contract mismatch found against `.claude/contracts/card-schema.md`
    this round.
  - Cleanup: two scratch scripts (`.tmp-check-images.mjs`,
    `.tmp-check-interactions.mjs`) written to the repo root (needed
    `node_modules` resolution for `playwright`) were deleted before
    finishing — confirmed absent from `git status`. Made no edits to any
    source file this task (`app/pages/app/card/[set]/[number].vue` already
    had a substantial unrelated uncommitted diff from a concurrent
    session/agent when I started — confirmed via `git diff --stat` that I
    never touched it, only `Read` it).

- 2026-09-10: Facts tab fact-label casing task, net no-op after a mid-task
  correction. Original ask was "make every fact label render ALL CAPS via
  CSS `text-transform`, not by touching `describeFact()`'s lowercase
  string data" — did this first (swapped the fact-label `<td>`'s
  `first-letter:uppercase` Tailwind class for plain `uppercase`), verified
  live on fin/1 (Playwright screenshot: "YOUR BATTLEFIELD PRESENCE" etc.,
  no wrapping/overlap issues). Mid-task correction arrived: the user
  actually wanted only the first letter capitalized ("Your battlefield
  presence"), not full caps and not title-case — i.e. exactly the
  pre-existing `first-letter:uppercase` behavior. Reverted the edit;
  `git diff` on `app/pages/app/card/[set]/[number].vue` is empty, so this
  task landed as a no-op on that file (confirmed live again on fin/1 —
  top-level fact rows like "Your battlefield presence"/"Dying" read
  first-letter-capitalized as before).
  - Noted but NOT fixed (pre-existing, outside this task's scope): nested/
    grouped fact rows whose label is preceded by an inline icon (the "="-
    style link icon `isFactAnnotated` renders, e.g. "your graveyard
    presence" under a top-level "Your battlefield presence" row) do NOT
    get capitalized by `first-letter:uppercase` — CSS `::first-letter`
    only applies when the text is the actual first inline content of the
    block; a preceding icon element as an inline sibling defeats it. This
    predates my involvement (unrelated to either the uppercase attempt or
    the revert) and is cosmetically minor (indented rows already read as
    subordinate), so left alone — flag if a future task touches fact-row
    label casing again, since fixing it would need either restructuring
    the icon out of `::first-letter`'s way or switching to a JS-computed
    capitalized string instead of a CSS pseudo-element.
  - No contract mismatch found this round.

- 2026-09-10 (later same day): controller-phrase wording fix in
  `app/lib/factConditions.ts`. `controllerPhrase()`'s `'opp'` branch
  changed from `"opponent's"` to the bare word `'other'` per explicit user
  correction ("strictly yours and other — has nothing to do with
  opponent"). `'you'` (`'yours'`) and omitted (`"either player's"`)
  branches left untouched — task scoped the fix to the exact `'opp'`
  string only. Updated the two doc-comment lines in the same file that
  quoted the old `"yours"/"opponent's"/"either player's"` triad for
  accuracy; left the historical doc-comment block (lines ~8-16) describing
  `describeFact`'s OLD pre-rework label wording alone since it's genuinely
  historical context about a different function, not a live claim about
  this file's current output. Updated the two test expectations in
  `factConditions.test.ts` that asserted `"opponent's"` (`mega-flare-opp`,
  `stun`/putCounter case) to `'other'`; `npx vitest run
  app/lib/factConditions.test.ts` passes (19/19).
  - Deliberately did NOT touch `recipientPhrase()` (the `recipient` field
    — "to the opponent"/"to you"/"to either player", used for e.g.
    damage's own who-does-this-go-to) — scoped out per the task as a
    separate concept (who receives something vs. who controls something).
    Flag for a future task/orchestrator: if the same "no 'opponent'
    wording" principle is meant to extend there too, `recipientPhrase`'s
    `'opp'` branch (`'the opponent'`) would need the same treatment, but
    that wasn't asked for this round and the grammar is less trivial
    there (`to other`/`to the other player`?) — worth an explicit ask
    before changing it.
  - Verified live via a throwaway Playwright script (deleted before
    finishing, confirmed via `git status`): navigated to
    `/app/card/fin/70` (Sage's Nouliths — has a real, unconstrained
    `zone:'Battlefield', controller:'opp'` fact, the exact "Battlefield
    presence"/`controller:'opp'` case named in the task) and confirmed the
    Facts tab notes column renders `"other"`, and that the string
    `"opponent's"` appears nowhere on the rendered page.
  - No contract mismatch found this round (`.claude/contracts/card-schema.md`
    wasn't implicated — this is purely `factConditions.ts`'s own phrasing,
    not a `Fact` shape question).

- 2026-09-10 (later still): completed the reciprocal half of the
  self-referencing-fact header link (earlier this session's task only wired
  header -> tooltip; user correctly pointed out the Facts tab ROW itself
  still looked unlinked). In `app/pages/app/card/[set]/[number].vue`:
  - New `headerLinkedFactKeys`/`isHeaderLinkedFact(fact)` — the reciprocal
    of `headerFaceFacts` (every fact-key that ended up annotating the
    header name rather than a body span). Facts tab row's link-icon slot
    now renders the SAME `lucide:link-2`/`text-emerald-500/40`/`h-2 w-2`
    icon `isFactAnnotated` already used for body-annotated facts, just as an
    `v-else-if` branch for `isHeaderLinkedFact` — no new visual language,
    exactly the convention the task asked to reuse. Title text differs
    ("Linked to the card name above — click to jump to it" vs "Linked to
    card text") since the target differs, but everything else matches.
  - Bonus interactivity (not just cosmetic parity): new
    `headerHighlightIndex`/`headerNameEls`/`setHeaderNameEl`/
    `scrollToHeaderName` — hovering a header-linked row's icon flashes a
    `bg-blue-400/20` highlight on the matching header-name span (keyed by
    the existing `factFaceIndex`, so a back-face-only self fact on a
    multi-face card highlights the right half); clicking it
    `scrollIntoView`s that span and pops the exact same floating tooltip
    the header's own hover shows (auto-hidden after 1.6s via
    `showHeaderTooltip`/`hideHeaderTooltip`, reused as-is, fed a synthetic
    `{ currentTarget: el }` in place of a real MouseEvent).
  - Verified live via a throwaway Playwright script (written to repo root
    for node_modules resolution, deleted before finishing, confirmed absent
    via `git status`) against the already-running dev server on
    `/app/card/fin/1`: all 12 fact rows now carry SOME link icon (none bare
    "self" text anymore) — the self ones with no real oracle-text anchor
    ("Cast a spell", "Enters the battlefield", "Battlefield presence"
    (self), "Dying" (self), "LORE counters on itself") show the new
    header-pointing icon/title; two rows the task ALSO named as expected-
    self ("Sacrifice", "Graveyard presence") correctly kept the ORIGINAL
    "Linked to card text" icon instead — confirmed via the notes column
    they genuinely are self facts, but `headerFaceFacts`'s own pre-existing
    skip-if-`isFactAnnotated` guard (see that computed's doc comment) is
    right to exclude them: fin/1's "Sacrifice after IV" self-graveyard fact
    really does have a `highlight` match in the printed text, so it's
    already linked there, not unlinked — a fact never ends up double-linked.
    Confirmed hover (via proper Playwright `locator.hover()`, not raw
    `mouse.move` coordinates which kept missing the tiny 8px icon and
    produced a false negative first try) adds `bg-blue-400/20` to the
    header span, and click removes the tooltip's `pointer-events-none
    opacity-0` classes (i.e. shows it).
  - `npx vue-tsc --noEmit` clean on this file both before and after.
  - No contract mismatch found this round
    (`.claude/contracts/card-schema.md` not implicated — purely a card-page
    presentation change, no `Fact`/engine shape touched).

- 2026-09-11 (read-only investigation, licensing exposure check): confirmed
  `forge-model/` (verbatim GPL Forge scripts) is entirely DEAD — nothing
  under it reaches any live render path today, and its own `README.md` is
  stale/wrong about the current wiring (worth orchestrator flagging, not a
  `.claude/contracts/*.md` file so not touched here):
  - `server/api/card/[set]/[number].ts` (grepped in full): zero references
    to `forge-model`, `forgeScript`, `forgeTranslate`, `ForgeCardScript`, or
    `synergyInteractions` anywhere. `Interactions panel` data
    (`loadInteractionGroups`) comes entirely from
    `functional-model/synergy.ts`'s `findInteractionsForCard` — no
    forge-model involvement.
  - `app/lib/synergyInteractions.ts` (the file the README cites for the
    Interactions panel) no longer exists on disk at all — confirmed via
    `find`. `forge-model/pools/` (the data dir that same README section
    cites) also no longer exists — `forge-model/` now contains only
    `README.md` + `data/*.txt`.
  - `app/components/ForgeCardScript.vue` and `app/lib/forgeScript.ts`/
    `forgeTranslate.ts`: no `.vue` file imports/renders
    `<ForgeCardScript>` anywhere (grepped templates repo-wide) — only
    referenced in comments (a color-palette cross-reference in
    `FunctionalModelScript.vue`) and their own test files
    (`forgeTranslate.test.ts`/`.blb.test.ts`). Orphaned component, no live
    caller.
  - The card page itself (`app/pages/app/card/[set]/[number].vue`) has an
    explicit comment (line ~891): "synergy-model/forge-model are
    deprecated ... this is the current direction" — confirming the "Forge
    model" column / "Raw Forge script" spoiler UI the README describes was
    since removed from the template (grepped, zero hits for that markup).
  - **Verdict for all three README-claimed features: DEAD**, not dormant-
    but-reachable — (a) Synergy-column fallback: dead, column itself
    removed from the template; (b) Raw Forge script spoiler: dead, same
    removal; (c) Interactions panel: itself still LIVE and rendered
    (`orderedInteractions` in `[number].vue`), but it depends ENTIRELY on
    `functional-model/synergy.ts`, not `forge-model/` at all anymore — the
    README's claim that it reads `forge-model/pools/` is stale/false.
  - Flagged for orchestrator: `forge-model/README.md` itself needs a
    rewrite (not done here, read-only task) — it currently describes two
    live integration points that don't exist anymore, which is exactly
    backwards for a file whose whole purpose is documenting GPL-exposure
    surface accurately.

- 2026-09-11 (follow-up, actual deletion): acted on the above — deleted
  `forge-model/` in full (README.md + all `data/*.txt`), the orphaned
  `app/components/ForgeCardScript.vue`, `app/lib/forgeScript.ts` +
  `forgeTranslate.ts`, and their test files (`forgeTranslate.test.ts`,
  `.blb.test.ts`, plus the vitest snapshot
  `app/lib/__snapshots__/forgeTranslate.blb.test.ts.snap` which the earlier
  read-only pass didn't list but which only existed for the now-deleted
  `.blb.test.ts`). Repo-wide re-grep (excluding `tmp/mtg-forge` — a
  gitignored scratch clone of the real Forge repo, unrelated — and
  `archive/`, `functional-model/`, both out of this task's remit) found a
  few stray doc/comment pointers, fixed:
  - `app/types.ts`: `ForgeLineType`/`ForgeRow`/`ForgeFace`/`ForgeCard` were
    defined here for `forgeScript.ts`/`forgeTranslate.ts` alone (confirmed
    via grep — no other importer) — deleted the interfaces along with a
    trimmed removal-note comment in their place.
  - `app/components/FunctionalModelScript.vue` and `app/lib/manaSegments.ts`:
    both had comments cross-referencing `ForgeCardScript.vue`'s color
    palette/shared helper — reworded to note the file was removed rather
    than pointing at a component that no longer exists.
  - `app/pages/app/card/[set]/[number].vue`: two stale comments — one said
    "synergy-model/forge-model are deprecated" (forge-model is now actually
    gone, not just deprecated); the other described the Interactions panel
    as sourced from "hand-authored or Forge-translated" nodes, a Forge-
    translation path that no longer exists. Both reworded.
  - `.claude/agents/card.md` (this agent's own definition): dropped
    `ForgeCardScript.vue` from the Domain list and the description line,
    left a one-line pointer back to this note. Left `.claude/agents/ui.md`
    alone despite it also listing `ForgeCardScript` under its own "Not
    yours" — that's `ui`'s file, not mine to touch; flagged for
    orchestrator instead.
  - `functional-model/README.md` still has several stale mentions of
    `forge-model`/`forgeTranslate.ts`/`forgeScript.ts` (describes reusing
    `forgeTranslate.ts`'s helpers, cites `forge-model/pools/blb.json`,
    etc.) — left untouched per this task's explicit constraint not to
    touch `functional-model/`; flagging for orchestrator to route to
    `engine` (that file is their domain, and by their own conventions the
    forge-model integration it describes was already stale/dead before
    today's deletion, per the read-only pass above).
  - `archive/synergy-model/**` and `archive/card-shorthand/README.md` also
    turned up in the grep (script filenames like `make-exam-forge.mjs`,
    fixture content mentioning "real Forge") — these are frozen historical
    archives, not live docs; left alone.
  - Verified clean: `npx vue-tsc --noEmit` (no errors) and `npx vitest run`
    (only pre-existing unrelated failures — 5 tests in
    `scripts/relations.test.mjs` missing `tagging/sets/{leb,2ed,arn}/*`
    fixture files, part of the separate historical-sets sweep, not touched
    by this change; 299 passed, 0 forge-related failures).
  - Committed as a standalone commit, staged narrowly (the forge deletions/
    edits + this notes.md entry only) — left the large set of unrelated
    pre-existing `functional-model/*` and other agents' in-flight modified
    files untouched in the working tree.

- 2026-09-11 (later still): Two Facts-tab notes-column wording fixes spotted
  by the user live on fin/20 (From Father to Son,
  `functional-model/cards/from-father-to-son/`), both in
  `app/lib/factConditions.ts`.
  1. **Flashback cast now distinguished from a normal cast, in the notes
     column only (label stays bare, per this project's own standing
     single-dimensional-label rule)**: `movementOriginPhrase`'s early
     `!to` bailout meant a `from`-only fact (a `cast` event, whose real
     destination is the deliberately-invisible Stack) NEVER got its
     origin surfaced at all, even when `from` genuinely differed from the
     common case — the fact `{event:'cast', from:'Graveyard',
     target:'self'}` (real oracle-backed Flashback) rendered identically
     to `{event:'cast', from:'Hand', target:'self'}` (normal cast), both
     bare "self". Fixed by handling the `to === undefined` case explicitly
     instead of bailing: new `EVENT_DEFAULT_FROM: Record<string, string>`
     map (`{ cast: 'Hand' }`) — an event's own established default origin
     is suppressed (no note), any other real `from` on that event shows
     `from ${zone.toLowerCase()}`. Normal cast (`from:'Hand'`) still
     renders bare "self"; Flashback (`from:'Graveyard'`) now renders
     "self · from graveyard".
  2. **Fixed "artifact permanents" → "artifact cards" on a Library→
     Battlefield tutor/search fact** (From Father to Son's own Flashback
     mode: `{from:'Library', to:'Battlefield', types:{has:['Artifact']}}`,
     now actually authored as `Vehicle` on disk as of this check, same
     shape). Root cause: the noun lookup
     (`ZONE_NOUN[effectiveZone(fact) ?? '']`) was keyed off the
     DESTINATION zone (`to`/`zone`) always, even for a real `from`+`to`
     movement — happened to read right on every existing Library→Hand
     tutor variant only because Hand's own noun ALSO happens to be
     "cards", coincidence not correctness. New `constraintNounZone(fact)`
     helper (right next to `effectiveZone`): `fact.from ?? effectiveZone(fact)`
     — prefers the ORIGIN zone when a real movement `from` exists (the
     type constraint is checking the object as it sits in its origin zone
     at search/trigger time, not what it becomes at the destination),
     falls back to `effectiveZone` (still the destination) when there's no
     `from` at all — a plain `{to:'Battlefield', types:{...}}` sink with no
     origin genuinely IS describing something already on the battlefield,
     unaffected. Confirmed this generalizes sensibly beyond the one
     reported case too (e.g. a hypothetical typed `dies`
     `{from:'Battlefield', to:'Graveyard', types:{...}}` would now read
     "permanents," matching real oracle phrasing like "nonland permanent
     ... dies," not "cards" — previously would have been wrong the same
     way, just never surfaced since no currently-authored fact hits that
     combination).
  - Note the origin-first noun fix does NOT remove the separately-existing
    "from library" bit `movementOriginPhrase` already adds for this same
    fact (that `(from:'Library', to:'Battlefield')` pair has no
    `zoneMovementName` entry, so both the label — "Moves to battlefield
    (from library)" — and this column repeat the origin; pre-existing,
    harmless duplication, not something either fix touched or was asked
    to touch).
  - Added 4 new fixture tests to `app/lib/factConditions.test.ts` (normal
    vs. Flashback cast; from+to movement w/ type constraint picks origin
    noun; plain to-only sink w/ type constraint still says "permanents",
    unaffected) — 28/28 pass in that file, 64/64 across the full `app/lib`
    suite.
  - Verified live (Playwright, throwaway script at repo root, deleted
    after) against the already-running dev server, fin/20: Facts tab rows
    read exactly `Cast a spell | self` (normal), `Cast a spell | self ·
    from graveyard` (Flashback), `Moves to battlefield (from library) |
    yours · from library · vehicle cards` (tutor-to-battlefield, correct
    "cards" noun), `Library presence | yours · vehicle cards` and `Tutor |
    yours · vehicle cards` (unaffected Library-sourced facts, already
    correct before this fix, confirmed still correct after).
  - `npm run typecheck`: exit 0, clean (confirmed via the correct
    build-mode command per this file's own standing policy correction
    above — not the no-op `vue-tsc -p .`).
  - No `.claude/contracts/*.md` mismatch to flag — pure card-owned
    presentation logic over already-correctly-documented `Fact.from`/`.to`/
    `.event` fields; nothing served differently than the contract
    describes.

## 2026-09-12 (latest, "traces missing from Scenarios tab" — false alarm, stale dev-server HMR)

User report on fin/23 (Machinist's Arsenal), right after asking to trim it
to 1 scenario: "I don't see traces in scenarios, were these removed at
some point?" Investigated as a possible rendering regression given how
many concurrent sessions touched `ScenarioReplay.vue`/
`ScenarioReplayTrace.vue`/`[set]/[number].vue` today (copy-button rework,
keyword-badge per-face fix, `continuousKeywordGrants`, per-instance `id`
consumption, etc. — all logged above).

- **Root cause: the documented stale-Vite-HMR gotcha (`NEXT_STEPS.md`
  "Known issues"), not a code regression.** Before touching anything, a
  `curl /api/card/fin/23` showed `functionalModel.traces[0].log` at only
  length 3 — but the on-disk `functional-model/cards/machinist-s-arsenal/
  trace.json` (dirty in `git status` from a concurrent `engine` session's
  same-day edit, confirmed via the shared `git status` output at the top
  of this task) had clearly moved on from that. Killed the long-running
  `nuxt dev` process (up since 08:40 today, predating a large volume of
  same-day `functional-model/` edits from concurrent sessions) and
  restarted cleanly. Post-restart, the identical `curl` call returned
  `log.length === 6` — confirms the dev server really was serving a stale
  compiled snapshot, exactly the class of bug `NEXT_STEPS.md` already
  warns about ("after many rapid successive edits to a heavily-shared
  file in one dev-server lifetime... the browser can keep executing a
  stale bundled module even though the file on disk is current").
- **Verified live** (Playwright, throwaway scripts copied to repo root
  then deleted, per this project's established module-resolution
  workaround) against the freshly-restarted dev server: fin/23, fin/21,
  fin/16 (real-engine-playthrough scenario, the richer two-table
  ACTION+FN/FIELDS trace shape) all render their trace/log panel
  correctly — zero browser console errors on any. Stepped fin/23's replay
  forward through all 5 steps via the Play/step controls: board updated
  correctly (Grizzly Bears bystander enters, Equipment re-attaches to it),
  right-side FN/FIELDS trace table's currently-active row highlight
  advanced in lockstep (row 5 "equip" highlighted at step "5/5"),
  confirming the panel isn't just present but genuinely wired to replay
  state. fin/23 alone lacks the separate higher-level "ACTION" summary
  table fin/21/fin/16 show above their FN/FIELDS table — this is a
  pre-existing, correct distinction (fin/23's own `setup`/`action` line
  reads "onEnter trigger fires," a harness-log-only scenario, vs. fin/21
  /fin/16's "real engine playthrough" scenarios that populate the
  additional real-turn-engine action log), not something broken by
  today's changes.
- **No code fix needed** — did not touch `ScenarioReplayTrace.vue`,
  `ScenarioReplay.vue`, or the card page for this task; the restart alone
  resolved it. No `.claude/contracts/*.md` mismatch to flag.
- Flagging the broader pattern (not new, but worth restating): this repo's
  dev server is shared across concurrently-running sessions, and
  `functional-model/` is under very heavy same-day multi-session edit
  churn right now (`git status` at task start showed ~230 files dirty
  across `functional-model/cards/*`) — a "trace looks stale/wrong/missing"
  report is worth a dev-server restart + before/after `curl` diff check
  FIRST, before assuming a rendering regression in this domain's own
  `.vue` files.

## 2026-09-12 — Flag: `engine` agent touched `app/lib/scenarioReplay.ts`/`scenarioReplay.test.ts` directly (cross-lane, not hidden)

Fixing a live regression report (Dion, Bahamut's Dominant, fin/16 — Knight
token showing Flying permanently, even during the opponent's turn) required
a matching one-line change in `scenarioReplay.ts`'s `grantKeyword` case
(`entry.removed` → `keywords.delete` instead of `.add`) to consume a new,
additive `engine`-owned trace-log field (`grantKeyword`'s own `removed`/
`untilEndOfTurn` fields — see `.claude/contracts/state-event-format.md`'s
own new dated section for the full shape). Same precedent this exact
engine session already set for `continuousGrantedKeywords()` in
`ScenarioReplayTrace.vue` (gap #14, written directly by `engine` too).
Full root-cause writeup: `.claude/agent-memory/engine/notes.md`'s own
"latest+56" entry. Nothing else in `card`'s own lane changed; flagging in
case a `card`-agent session sees this diff and wants to review/restyle it.

## 2026-09-12 — Fix: self's own real `id` never registered into `idCards`/`claimedByOtherId` (magitek-infantry, fin/25)

Consumer-side half of a bug the `engine` agent found+partially fixed same
day (see `.claude/contracts/state-event-format.md`'s "Self's own `id` field
..." section for the producer-side writeup). `app/lib/scenarioReplay.ts`
had two disconnected per-object identity systems: `ensureSelf`/
`instanceCards` (keyed on harness.ts's scenario-domain `instanceId`, only
ever present on self's own `cast`/`activate`/`trigger`/`enters`/`move`
entries) and `resolveInstance`/`idCards`/`claimedByOtherId` (keyed on the
real `RealCard.id`, used by every generic per-instance action —
`moveTo`/`tap`/`pump`/etc). Self's own chip was never entered into the
second system at all, so once `harness.ts` started also emitting `id` on
self's own entries (additive, inert until consumed), a LATER entry naming
a genuinely different real object sharing self's exact name (magitek-
infantry's own "search library for a card named Magitek Infantry, put it
onto the battlefield tapped" tutor ability) resolved via `ensure`'s plain
`byName` lookup straight onto self's ALREADY-EXISTING chip — visibly
flipping the ORIGINAL, untouched permanent tapped instead of adding a
second, correctly-tapped one.

**Fix**: new `registerSelfId(card, entry)` helper (`app/lib/
scenarioReplay.ts`) — called from `ensureSelf` (covers `cast`/`activate`/
`trigger`/`enters`) and from the `move` case (lifecycleAfter's own self-
move, which resolves self via plain `ensure` rather than `ensureSelf` — a
pre-existing quirk, left as-is). Registers `entry.id` into `idCards`/
`claimedByOtherId` the same way `resolveInstance` does for every other
per-instance action, idempotently (skips if that id is already registered).
Once self's own id is registered (from its very first log entry, which
always precedes any effect it causes), a later `moveTo`/`tap` for a
different id correctly gets excluded from self's chip via `ensure`'s
`exclude` param and lands on a fresh one instead.

Verified two ways:
- `npx vitest run app/lib` — 69/69 still pass, no regression.
- Direct repro via `replayTrace()` against the real (engine-regenerated)
  `functional-model/cards/magitek-infantry/trace.json`: pre-fix (stashed
  the change) → 1 Magitek Infantry chip, `tapped: true` (the bug, exactly
  as reported). Post-fix → 2 chips: original `isSelf: true, tapped: false,
  id: 6` and the tutored copy `tapped: true, id: 3`. Did not have a live
  browser tool available this task; this reproduces the exact same
  `replayTrace` code path the Scenarios tab calls, so it's a faithful
  stand-in, but a follow-up eyeball-in-browser check on fin/25 wouldn't
  hurt if anyone's in a position to do it.

No `.claude/contracts/*.md` mismatch found — the contract's own dated
section already correctly described this as the needed consumer-side fix
before I started; nothing to correct there.

- 2026-09-12: fixed Interactions-panel duplicate-related-card bug (repro'd
  live on fin/15 Delivery Moogle — "enters the battlefield" group listed
  Clash of the Eikons, Dion Bahamut's Dominant, and 7 others each TWICE).
  Root cause: `functional-model/synergy.ts`'s `findInteractionsForCard`
  produces one `InteractionMatch` per SATISFIED FACT PAIR, not per related
  card — when the other card has multiple facts on its opposite side that
  each independently satisfy `mine` (Clash of the Eikons has both a
  Creature-gated Battlefield-presence sink fact AND a separate unconstrained
  one, both satisfied by Delivery Moogle's single ETB source fact), you get
  N `InteractionMatch`es with the same `card` string in one group. That
  per-fact granularity is real and load-bearing for a DIFFERENT consumer
  (`server/api/graph-links.ts`, keys off `theirFactId` for its own supply-
  side normalization) — so did NOT touch `synergy.ts`/`findInteractionsForCard`
  itself (stayed in-lane, no `engine`-domain edit needed). Fixed instead in
  `server/api/card/[set]/[number].ts`'s `loadInteractionGroups`: new
  `dedupMatchesByCard` helper collapses `group.matches` to one entry per
  `card` name (after the existing `filterNames` filter, before the async
  image-metadata resolution — so dupes don't even cost a redundant lookup),
  keeping the highest-`theirTotal` duplicate rather than an arbitrary one.
  No data loss: `selfInteraction` is derived from `mine`/`mineCard` alone
  (never `theirs`), so it's provably identical across duplicates of the same
  card in the same group — confirmed this live too (fin/1 Summon: Bahamut,
  fin/4 Aerith Gainsborough, etc. still show correct `selfInteraction` kinds
  post-fix). Verified via a full sweep of all 320 fin/1..320 API responses
  (live dev server) — 0 groups with duplicate card entries afterward (was 1
  group w/ 9 duplicated cards on fin/15 alone before); fin/15's "enters the
  battlefield" group matches count dropped 139→130 (the exact 9 collapsed),
  other two of its groups unaffected (had no dupes). `npx vue-tsc --noEmit`
  clean. Diff scoped to just the new `dedupMatchesByCard` function + its one
  call site in `loadInteractionGroups` — left alone the unrelated pre-
  existing dirty changes already in this same file from a concurrent session
  (`cardFaceKeywords`/`backKeywords` DFC front-face-keywords work), per this
  task's own explicit shared-working-tree constraint. Not committed, per
  task instructions — left for approval.

- 2026-09-12 (copy-fact-context: added source/sink role tag): follow-up to
  the same day's `copyFactContext`/`factContextText` rework (entry above,
  "Facts-tab copy button rework"). Added the fact's own `role` to the
  copied one-line string, per direct request to pick whatever reads
  clearest for an AI agent parsing pasted text. Chose a bracketed, full-word
  tag placed right after the `#<row number>` token (before the label):
  `<set>/<number> #<row-number> [source|sink] <label>[ · <conditions>]` —
  e.g. `fin/21 #3 [sink] Dying · yours · another (Creature/Artifact)
  permanent · once per turn`. Considered but rejected the on-page debug
  column's older abbreviated convention (`title="Copy SO"`/`"Copy SI"`, from
  the now-removed bare-role-marker button, see the "reverted hidden-text...
  real copy-icon button" entry) — full words in their own `[...]` delimiter
  read unambiguously as a role tag with no risk of being mistaken for label
  text, which matters more here than brevity since the whole point of this
  string is downstream AI parsing. `factContextText` in
  `app/pages/app/card/[set]/[number].vue` now derives `role` straight off
  `row.fact.role` (`'source'`/`'sink'`, same field the row's own role icon
  already reads at the same site — `log-out`/blue for source, `log-in`/
  green for sink). No unit test existed for this function anywhere (grepped
  for `factContextText`/`copyFactContext` project-wide — 0 hits outside this
  file) — the whole button predates any unit test and was verified live via
  Playwright both times, so did the same again here rather than inventing a
  first test in isolation: scripted a throwaway Playwright run (temp file
  copied into the project root so `node` could resolve the `playwright`
  package, deleted after) against fin/21 on the already-running dev server,
  clicked all 4 Facts-tab copy buttons in order, read
  `navigator.clipboard.readText()` after each — confirmed `[source]` on
  rows 1/2/4 and `[sink]` on row 3 (Dying), matching each row's own role
  icon. No contract mismatch to flag.

- 2026-09-12 (bug fix: sink/movement `tapped` constraint silently dropped
  in the notes column): fin/19 (Fate of the Sun-Cryst) fact #3's Facts-tab
  row showed label "Battlefield presence" (bare, correct) but notes
  "creature permanents" with no "tapped" anywhere — the sink's own real
  `{to:'Battlefield', types:{has:['Creature']}, tapped:true}` constraint
  (its "targets a tapped creature" cost-reduction condition) lost the
  `tapped` bit entirely. Root cause: SYSTEMIC, not one-off — `app/lib/
  factConditions.ts`'s `tapped` rendering (`if (fact.tapped !== undefined)
  bits.push(...)`) was nested inside an `if (isEventFact(fact))` block, but
  `isEventFact` checks for a literal `event` key (`functional-model/
  synergy.ts`), and a plain zone-shaped source/sink fact with a top-level
  `Constraints.tapped` (the "candidate must currently be tapped" meaning,
  distinct from `EventFact.tapped`'s "subject enters tapped" meaning — both
  share the field name, see that field's own doc comment in synergy.ts) has
  no `event` field at all — so the bit was unconditionally skipped, AND
  `tapped` already sat in `HANDLED_OR_LABEL_KEYS`, so the generic unknown-
  field fallback loop didn't catch it either. Silent, total drop, not a
  mislabel. `describeFact()` itself (engine-owned, `functional-model/
  synergy.ts`) was already correct/bare per the single-dimensional-label
  design — this was purely a card-owned `factConditions.ts` bug. Grepped
  every `synergy.json` pool-wide for non-`entersBattlefield`-event facts
  carrying top-level `tapped` — 2 other real cards affected the same way:
  `summon-primal-garuda` (sink) and `magitek-infantry` (source movement,
  Library→Battlefield). Every `entersBattlefield`-event `tapped` fact (the
  ~10 tapped-land cards, Phoenix Down) was unaffected (already had `event`
  set, `isEventFact` true). Fix: hoisted the `tapped` bit out of the
  `isEventFact` block to run unconditionally (placed just before that block
  so an EventFact's own `tapped`/`oncePerTurn` order is unchanged) — no
  `describeFact`/engine-side change needed or made. Added a regression test
  (`factConditions.test.ts`) for the plain-zone-fact case. Verified live via
  `npx tsx` against the real fin/19/summon-primal-garuda/magitek-infantry
  facts — all three now render the `tapped` bit in conditions; labels
  stayed bare throughout, confirming no re-fold into the label ever
  happened (the bug was a silent drop, not a label/notes split issue as
  initially suspected from the bug report's own wording). Scoped diff: only
  `app/lib/factConditions.ts` + its own test file touched (left the file's
  pre-existing, concurrent-session `excludeSelf`/`untilEndOfTurn` changes
  already on disk alone, per shared-working-tree convention). Not
  committed, per task instructions — left for approval. No contract
  mismatch — this was a card-owned rendering bug, not a `card-schema.md`
  shape issue.

- 2026-09-13 (bug fix: Card Definition tab leaking scenario content):
  reported on fin/1 — Card Definition tab (`FunctionalModelScript.vue`,
  fed by `data.functionalModel.source`) showed `definition.ts` followed by
  the ENTIRE raw text of `scenarios.ts` (setup/action/result prose,
  `runEngineScenarios` function body). Root cause: served-payload shaping,
  card-owned, NOT a Vue-component bug — both `server/api/card/[set]/
  [number].ts`'s dev-path `loadFunctionalModel` and `scripts/
  build-fm-bundle.mjs` (the prod bundle builder) had matching logic that
  detected the real-engine-piloted `scenarios.ts` shape (`/export\s+
  function\s+runEngineScenarios\b/` text match) and deliberately
  concatenated its raw source onto the SAME `source` string field the
  Definition tab reads — a prior, apparently intentional decision (own
  comment cited "otherwise invisible on disk," and explicitly chose
  concatenation over a new field "to keep the Card Definition tab's
  existing single-`source` shape unchanged"). fin/1 (summon-bahamut) uses
  exactly this `runEngineScenarios` shape, so it tripped the concat.
  Fix: removed the concatenation outright in both places (dev path +
  bundle builder) — `source` is now always just `definition.ts`'s raw
  content, full stop. Did not add any new "raw scenario source" viewer
  elsewhere (Scenarios tab already fully shows real scenario CONTENT via
  `ScenarioReplay.vue`/`traces` — setup/action/result prose + the full
  interactive replay board — just never the raw TS source text; that was
  only ever visible via this leak, nowhere else, so removing it doesn't
  regress any other feature). Did NOT touch `functional-model/cards/
  summon-bahamut/{definition,scenarios}.ts` content itself, per task
  constraint — pure server-shaping fix.
  Verified live (real dev server, Playwright, not just code reading):
  - `curl localhost:3000/api/card/fin/1` before fix: `functionalModel.source`
    9151 chars, contained `runEngineScenarios`/`scenarios.ts` marker; after
    fix: 1981 chars, neither string present (dev path re-reads on
    signature/cache miss, no restart needed).
  - Browser: Card Definition tab on fin/1 renders only `definition.ts`
    code, no scenario prose/marker. Scenarios tab (separately verified,
    same session) still fully renders the setup/action/result summary +
    interactive turn-by-turn replay board, completely unaffected.
  - `npx vue-tsc --noEmit` clean; `npx vitest run app/lib` 71/71 pass;
    full `npx vitest run` 479/5 (the 5 failures are pre-existing,
    unrelated `tagging/sets/*` ENOENT failures from the separate
    historical-sets sweep project's own missing data files, not caused by
    this change — confirmed these paths were never touched here).
  No contract mismatch to flag — `card-schema.md` doesn't describe
  `functionalModel.source` at all (it's a `card`-owned served-shape
  field, not part of the engine↔card boundary), so nothing there was
  stale; this was purely an internal card-side bug.

- 2026-09-13 (Facts tab wand-sparkles icon convention INVERTED, per task):
  the icon used to mark a fact WITH `Fact.provenance.origin === 'parser'`
  (recognizer-derived), with a hover `UPopover` showing "Parser-derived —
  rule: ..." + the recognizer's own source code
  (`ensureRecognizerSource`/`recognizerSource`/`recognizerSourceErrorFor`,
  `GET /api/recognizer-source/:rule`). Flipped so the icon now marks a
  fact WITHOUT `provenance` (agent/AI-authored — absence is still the only
  such signal, no `origin: 'agent'` marker exists) — `v-if="!row.fact.
  provenance"` — and a parser-derived row now gets NO icon at all, per
  the task's explicit "recognizer/scripted facts get nothing." Decided
  (task left it to judgment) that the old rule+source-code popover made
  no sense once attached to an agent-authored fact (no `rule`, nothing to
  show) — replaced with a plain `title` tooltip ("Agent-derived — no
  parser recognizer produced this fact"), no popover at all. Since the
  icon no longer appears on any parser-fact row, the popover's own
  hover-trigger/fetch machinery (`ensureRecognizerSource` + its two cache
  refs + `recognizerSource`/`recognizerSourceErrorFor`) had no remaining
  caller — deleted as dead code rather than left orphaned; left a comment
  pointing at this decision in case a later pass wants "how was this
  parser fact derived" back (would need a new affordance since the icon
  itself moved).
  Did NOT touch `showParserFacts`/`isParserFact`/`parserFactsCount`/
  `factRowGroups`/`orderedAllFactRows` — the show/hide toggle and its
  filtering behavior are unchanged, confirmed via diff (that whole
  toggle/ordering block was pre-existing uncommitted work from an earlier
  session, not something this task touched).
  Verified live (real dev server, Playwright) on `/app/card/fin/1`: with
  "Show parser-derived facts" off, the only 4 visible rows (entersBattlefield,
  dies, Battlefield presence, Damage — all lack `provenance` per the real
  `synergy.json`) all show the wand icon; with the toggle on, all 7
  parser-derived rows (cast, the other entersBattlefield, destroy,
  drawCard, putCounter, sacrifice, the other dies) show NO icon, and the
  same 4 non-parser rows still do. Hovered the icon: correct title text,
  no popover, no console/page errors. `npx vue-tsc --noEmit` clean.
  No contract mismatch found — `card-schema.md`'s "Parser-derived facts"
  section already documents `Fact.provenance` shape accurately; this was
  a pure card-side presentation-convention flip, nothing about the
  underlying data changed.

- **2026-09-13, multi-annotation tooltip gap fixed** (flagged by `engine`
  in `card-schema.md`'s "Fact-to-oracle-text pointers" section after its
  own dedup-retagging pass produced the first real fact with
  `annotations.length > 1`): `factSourceText` (`app/pages/app/card/[set]/
  [number].vue`, ~line 615) used to read only `fact.annotations?.[0]`, so
  qiqirn-merchant/fin-65's merged `drawCard` fact (unions its `cantrip`
  ability's span with its `bigDraw` ability's span into one fact) showed
  only the first clause on hover. Now iterates the FULL `annotations`
  array, resolves each entry's own line/typeLine slice, dedupes exact
  string repeats, and joins with `\n` (a native `title` attribute renders
  embedded newlines fine as a real multi-line OS tooltip). Deliberately
  did NOT touch `factKey` (~line 335) — it already only reads
  `annotations?.[0]` and the comment right above it says this mirrors
  engine's own `factIdentity()` in `functional-model/synergy.ts` (which
  also only used the first annotation pre-merge); since merging happens at
  the fact level (two real clauses collapse into ONE served fact, not two
  facts sharing a first annotation), there's no live case where two
  distinct facts share `role`+`describeFact`+`annotations[0]` but differ
  in a later entry — changing `factKey`'s formula unilaterally on the card
  side without engine also changing `factIdentity()` would just be a
  divergence from the mirror for no real benefit, so left it alone.
  `FunctionalModelText.vue`'s own inline highlighting was untouched (it
  already iterated the full array correctly, confirmed by engine before
  flagging this).
  Verified live (real dev server, Playwright) on `/app/card/fin/65` with
  "Show parser-derived facts" on: the "Card draw" row's tooltip now reads
  two lines — `{1}, {T}: Draw a card, then discard a card.` (the cantrip
  span) and `{7}, {T}, Sacrifice this creature: Draw three cards. This
  ability costs {1} less to activate for each Town you control.` (the
  bigDraw span) — both real, nothing invented. Every single-annotation row
  on the same page (Cast a spell, Enters the battlefield, Tap, Discard,
  Sacrifice) still shows exactly its own one line, no duplication. Also
  spot-checked `/app/card/fin/1` (summon-bahamut, all single-annotation
  facts, including a `typeLine`-targeted one) — no regression, one line
  each. `npm run typecheck` shows 2 pre-existing failures
  (`functional-model/mana.ts`, `server/api/tokens/by-key.ts`) unrelated to
  and unchanged by this edit; the edited file itself introduces no new
  errors. No contract mismatch found — `card-schema.md` already documents
  the multi-annotation case accurately (it's the same section that
  flagged this gap in the first place).

- **2026-09-14, Prev/Next boundary bug — mostly already fixed, one real
  gap closed**: bug report was "fin/1 Previous navigates to eoc/191"
  (cross-set wrap). Investigated the full path
  (`app/pages/app/card/[set]/[number].vue`'s `prevTarget`/`nextTarget`,
  `app/composables/useSetOrder.ts`, `server/api/cards/set-order/[set].ts`)
  and found this was already fixed by an earlier, already-committed
  change (`ae53829e` "Card page: unique-card Prev/Next + loader scoping")
  before I touched anything — `git status`/`git diff` showed zero pending
  changes on any of those three files at task start. The per-set
  `setOrder` fetch is correctly scoped to `route.params.set` throughout
  (never a global/cross-set list), and `neighborsInSetOrder` already
  returns `null` (not a wrapped value) past either edge. Confirmed live
  with Playwright against the running dev server: fin/1 renders Previous
  as a disabled `<span>`, no `<a>` element at all (genuinely unclickable,
  not just greyed out), no navigation happens. Could not reproduce the
  reported `eoc/191` target at all, and couldn't find `eoc` as a set code
  anywhere in this repo's data/DB — likely a stale repro from before
  `ae53829e` landed.
  - Real gap found and fixed while verifying the symmetric (last-card)
    case: the template had a disabled `v-else` span for Previous but NO
    matching one for Next — at the true last card in a set (`fin/A-248`,
    a bonus/Alchemy-numbered card that sorts last per the set-order
    route's own non-numeric-sorts-last rule) Next just vanished entirely
    (`<!--v-if-->`, no visible element) instead of greying out like
    Previous. Added the missing `<span v-else class="text-muted/40">Next
    &rarr;</span>` mirroring Previous's own markup — no other logic
    touched.
  - Adjacent cosmetic bug fixed same pass: the header's `#{{
    currentNumber }}` used the `parseInt`'d `currentNumber` computed
    (whose own comment says it's kept only for the old ±1 fallback
    arithmetic, not display) — on a non-numeric collector number this
    rendered literally `#NaN`. Changed the display to read
    `route.params.number` directly; `currentNumber` itself untouched,
    still backs the fallback arithmetic.
  - Verified live end-to-end after both fixes (Playwright, real dev
    server): fin/1 -> Previous disabled (no `<a>`), Next -> fin/2, label
    `#1`. fin/2 (mid-set) -> both directions work normally. fin/A-248
    (true last card) -> Previous works (fin/563), Next now correctly
    disabled (no `<a>`), label reads `#A-248` not `#NaN`. Clicking (not
    just checking href) at both boundary cards confirmed no navigation
    occurs either way.
  - No contract mismatch found — purely a card-page-local presentation
    gap.

- 2026-09-14 (card page: "Show type-derived facts" sibling checkbox, shared
  classification with recognizers page): added a second UCheckbox on the
  Facts tab right after "Show parser-derived facts", same style/props
  shape, default OFF, own per-card live count — hides facts whose entire
  match is structurally implied by the card's own type/supertype (today's
  real pool: only `saga-lore-and-sacrifice-structural`'s Saga lore-counter/
  sacrifice/dies facts). Reused the classification the `ui` agent had just
  built the same day for the separate `/app/recognizers` page
  (`server/api/recognizers/index.get.ts`'s `TYPE_DERIVED_RECOGNIZER_IDS` +
  `RecognizerEntryCard.vue`'s own checkbox) rather than re-deriving or
  duplicating it.
  Shared home chosen: hoisted `TYPE_DERIVED_RECOGNIZER_IDS` (as
  `ReadonlySet<string>`, matching `Fact.provenance.rule`'s own plain-string
  type, not the narrower `RecognizerId` union) into `functional-model/
  recognizers/types.ts` — NOT into `server/api/recognizer-source/
  [rule].get.ts` (where the sibling `RECOGNIZER_IDS` id list already lives)
  because that file pulls in `node:fs`/`node:path` at module scope; this
  app's `/app` pages are SPA-only, so a client-side Vue page importing
  anything that drags in Node built-ins would break. `types.ts` was already
  proven client-safe (only re-exports from `../synergy`, which the card page
  already imports directly for `describeFact`/`Fact`). `server/api/
  recognizers/index.get.ts` now imports the constant instead of
  hand-keeping its own copy; `RecognizerEntryCard.vue` unchanged (still
  reads the server-shaped per-match `typeDerived` boolean, unaffected).
  Card page changes (`app/pages/app/card/[set]/[number].vue`): imports
  `TYPE_DERIVED_RECOGNIZER_IDS` directly (client-side, no server round-trip
  needed — `Fact.provenance.rule` is already served per fact, same data the
  parser-derived toggle already reads); added `isTypeDerivedFact()`,
  `typeDerivedFactsCount` (mirrors `parserFactsCount`'s "always the total,
  not a live-hidden count" reasoning), and folded a second filter clause
  into `factRowGroups`'s existing `visible` filter (AND, not OR, between
  the two toggles — a fact that's both parser- and type-derived, true for
  every real Saga fact today, needs BOTH toggles on to show; either one
  alone keeps it hidden, confirmed correct behavior live, not a bug).
  `showParserFacts`/new `showTypeDerivedFacts` both moved to/added on
  `useGraphStore.ts` with the same survive-navigation + localStorage
  persistence treatment (own storage key
  `mtg-visualizer-show-type-derived-facts`), not a local page ref.
  Verified live (real dev server on :3000, already running from another
  session — did not restart it; Playwright headless, no MCP browser tool
  available in this session): fin/203 (Summon: Fenrir, a Saga) — checkbox
  present, count (3), both toggles independently confirmed via row-count
  diffing (both off: 2 base rows; either alone on: still 2 — AND semantics,
  correct; both on: 5 rows, the 3 saga facts appear). fin/1 (Summon:
  Bahamut — ALSO a Saga, not purely a Ultima-style vanilla card as the task
  brief assumed; has 8 parser facts total, 3 type-derived + 5 not) —
  parser-only-on revealed exactly the 5 non-Saga structural facts (destroy
  x2, drawCard, dealDamage x2), type-derived-only-on revealed 0 extra (all
  3 Saga facts are ALSO parser-derived, so need both), both-on revealed all
  8 — confirms independent-AND toggle logic is right, not a double-count/
  conflict bug. fin/2 (Ultima, Origin of Oblivion — genuinely non-Saga) —
  "Show parser-derived facts (5)" present but NO "Show type-derived facts"
  checkbox at all (count 0, `v-if` guard correctly suppresses it). No
  console/page errors on any of the three. `npx vue-tsc --noEmit` and
  `npm run typecheck` both show only the same 2 PRE-EXISTING unrelated
  failures already on record above (`functional-model/mana.ts`,
  `server/api/tokens/by-key.ts`); `npx vitest run` 644/649 (same 5
  pre-existing unrelated `tagging/sets/*`/`tagging/card-enrichment-status
  .json` ENOENT failures from the separate historical-sets sweep, confirmed
  untouched by this change).
  No contract mismatch to flag — `card-schema.md` already documents
  `Fact.provenance` accurately; `TYPE_DERIVED_RECOGNIZER_IDS` itself is
  presentation-layer classification metadata, not part of the engine↔card
  fact shape, so nothing there needed updating.

- 2026-09-15: `CardPeekPanel.vue` (graph-page-owned, PRD 02) was stale —
  still rendering `CardMedia`+`CardRelations` (dropped from the full card
  page a while back) instead of the Facts/Scenarios/Facts Json/Card Json/
  Card Definition tab strip the full page actually shows. Fixed by
  extracting the full page's own content block into a new shared component
  rather than reimplementing it in the panel:
  - **New `app/components/CardDetailTabs.vue`**: literally the content that
    used to live directly in `app/pages/app/card/[set]/[number].vue`'s own
    `v-else` template branch — CardMedia + the review-status
    confirm/Draft table + `FunctionalModelText` (annotated oracle text) +
    the UTabs strip (Facts/Scenarios/Facts Json/Card Json/Card Definition)
    + the cross-card Interactions panel + the "View on Scryfall" link +
    both debug modals (fact-JSON, recognizer-source). Took EVERY bit of
    script state that block depended on along with it (all the Facts-tab
    machinery: `factKey`/`factLabel`/`factRowGroups`/`factOrderIndex`/
    header-link tooltips/copy-context/debug-JSON modal/recognizer-source
    modal/the three provenance toggles, plus `orderedInteractions` and the
    optimistic `toggleReviewStatus`) — this was NOT a thin wrapper, it's the
    real bulk of that page's own former logic, verbatim, just reading off
    two props (`data: CardResponse`, `set`/`number: string`) instead of a
    page-owned `useFetch` ref + `route.params`. Injects its OWN `StoreKey`
    (for `store.functionalModelTab`/the three `showXFacts` toggles) rather
    than receiving the store from a caller — both callers already have it
    available via the same `provide`, so this doesn't add a new prop for it.
  - **New `app/lib/cardResponse.ts`**: the `CardResponse` interface itself,
    previously declared inline and separately in both the full page and
    (as a narrower `{card,edges,themes}`-only `PanelResponse`) the panel —
    now one shared type both import. This directly closes the gap called
    out in the task: the panel's OLD narrower fetch shape (needed only for
    `CardRelations`'s `edges`/`themes`) is gone now that `CardRelations` is
    gone from the panel; it fetches/caches the exact same full shape the
    full page's own `useFetch<CardResponse>` already does (plain `GET`, no
    body — confirmed the server route's `readBody(event).catch(() => null)`
    already tolerates a bodyless GET identically to today's unfiltered
    page load, so no server change was needed).
  - **`app/pages/app/card/[set]/[number].vue`** shrank from ~1446 lines to
