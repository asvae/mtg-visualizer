<!-- Verbatim archive slice of the old card/notes.md (pre-2026-09-18 migration to the topics/ hub). Grep-only, not read on spawn. Durable facts already extracted into ../topics/*.md. -->

    ~315 — now owns only page-chrome: the `useFetch`, Previous/Next
    (setOrder/filterOrder), the deck-qty badge, pending/error/loading
    states, and `useHead`. Its `v-else` branch is now one line:
    `<CardDetailTabs :data="data!" :set="..." :number="..." />`.
    Also deleted, while touching this file, a small pre-existing bit of
    DEAD code the task's own premise (CardRelations already gone from this
    page) left behind and I hadn't noticed until grepping for what actually
    still used `EdgeData`/`ThemeData`/`describeRelation`/`groupChipsByVerb`:
    a `themeLabelById`/`relationChips`/`chipColumns` computed chain,
    computed but never referenced by any remaining template — confirmed via
    grep before removing, zero behavior change. `data.edges`/`data.themes`
    themselves are STILL served by the API (server route computation
    untouched, out of scope for this task) but are now unused by every
    known client consumer of this route — flagging as a possible future
    trim, not acted on.
  - **`CardPeekPanel.vue`**: dropped its own `PanelResponse` type, the
    `describeRelation`/`groupChipsByVerb`/`themeLabelById`/`chipColumns`
    pipeline, and the `CardMedia`/`CardRelations` render — now imports
    `CardResponse` from the new shared file and renders
    `<CardDetailTabs :data="data" :set="parsedKey.set" :number="parsedKey.number" />`
    inside the same `v-else-if="data && parsedKey"` branch. Every other
    documented panel behavior (open/closed state on `store.panelCardKey`
    alone, drag-to-resize width persistence, Expand-to-full-page button,
    click-outside/Escape handling, NOT reusing `app/lib/cardCache.ts`)
    untouched.
  - **Width/tab-fit tradeoff (flagged, not hedged around)**: chose FULL
    parity over trimming tabs for the narrower panel — every tab (including
    Interactions' 220px card-image grid and the Facts table's
    `overflow-x-auto`) renders identically in the panel as on the full
    page, relying on the panel's own existing scroll/wrap behavior and its
    user-resizable width (up to 90vw) rather than hiding content. Chose this
    over a "Facts-tab-only" panel because the component was already going
    to be one indivisible unit (Facts/Scenarios/Interactions share
    `hoveredFactKey`/`factOrderIndex`/`factKey` internally — splitting
    Facts out alone would mean either duplicating those or leaving
    Interactions with no home in the panel). If a narrow default panel
    width reads as visually cramped in practice, that's a `ui`-side
    call (panel chrome/default width), not something I second-guessed here.
  - `CardRelations.vue` itself is now UNUSED app-wide (confirmed via grep —
    the peek panel was its only remaining caller) but deliberately left in
    place, not deleted — removing a whole component file outright wasn't
    asked for by this task and is a separate, easy follow-up call for
    whoever wants to make it.
  - Verified live against the already-running dev server (Playwright,
    scratch scripts under `/tmp/.../scratchpad`, deleted after use — not
    committed): full page fin/1 renders CardMedia + Facts table (3 visible
    rows) and its Scenarios tab switches cleanly; graph-page peek panel
    (`.node-card` click) shows the identical tab strip (Facts/Scenarios/
    Facts Json/Card Json/Card Definition all clickable, no errors), Facts
    rows render (11 for the specific card clicked), and grepping the
    panel's own innerHTML for old CardRelations chip verbs
    ("Produces"/"Consumes"/"Relates to"/"Grants"/"Magnifies") found zero —
    confirms no leftover CardRelations rendering path. Zero console/page
    errors throughout. Also found and CONFIRMED PRE-EXISTING (reproduces
    identically after temporarily `git stash`-ing just my two changed
    files back to HEAD, unrelated to this change): the peek panel's
    "Expand to full page" button does not actually navigate
    (`navigateTo(...)` inside `expand()`, untouched by this diff) — URL
    stays on `/app?card=...` after clicking it, confirmed via both a real
    Playwright `.click()` and a raw DOM `.click()` via `page.evaluate`.
    Flagging this for whoever owns PRD 02 next (this task's own instructions
    said don't touch the panel's other documented behaviors, and this bug
    predates my change) rather than fixing it inline.
  - `npm run typecheck`: same 2 pre-existing unrelated failures only
    (`functional-model/mana.ts`, `server/api/tokens/by-key.ts`).
    `npx vitest run`: 769 passed, same 5 pre-existing `tagging/sets/*`/
    `tagging/card-enrichment-status.json` ENOENT failures (sandbox-only,
    confirmed unrelated — those files simply don't exist in this
    checkout).
  - No contract mismatch found/flagged — this was a UI-composition drift
    inside `card`'s own lane, not a shape disagreement with `engine` or
    `server`.

- 2026-09-16 — Facts-tab copy-to-clipboard `factContextText()`
  (`app/components/CardDetailTabs.vue`) now appends a trailing
  `·`-separated provenance segment, reusing the file's existing
  `isParserFact(fact)` helper (no new derivation): `parser:<rule>` when
  `fact.provenance?.origin === 'parser'`, else the literal
  `hand-authored (not recognizer-verified)` — spelled out rather than
  omitted, since the whole point was making "no provenance field" visibly
  different from "the button forgot it" in pasted text. On-screen
  rendering/badges untouched — copy-only change. Verified against a real
  card's real data (moogles-valor/fin-305, `functional-model/cards/
  moogles-valor/synergy.json`): its `createToken`/enters-battlefield
  source fact has no `provenance` at all (hand-authored) while its two
  `grantKeyword`/battlefield-presence facts carry
  `provenance.rule: grantKeywordAll-effect-structural` — confirmed live
  via a throwaway tsx script importing the real `describeFact`/
  `factConditions` against that JSON (not the dev server; scratch script
  deleted after use, not committed). No contract mismatch found —
  `FactProvenance` shape (`origin: 'parser'`, `rule: string`) matches
  `functional-model/synergy.ts` as already documented.

- 2026-09-16 — Fact-authoring status square badge added next to the card
  name (`FunctionalModelText.vue`'s per-face name row, in the same flex row
  as the mana-cost symbols), reusing the exact 5-color scheme (`data/fin/
  fin_card_status.json` + `functional-model/card-status.ts`'s bucket
  classification) the `/app/status` dashboard already renders.
  - New shared module: `app/lib/cardStatus.ts` — `getCardStatusEntry(set,
    number)` (same `STATUS_FILES`-style static per-set import map as `/app/
    status/index.vue`'s own, FIN-only today, `undefined` for any other set
    or an unclassified card number — deliberately NOT an error path) plus
    `CARD_STATUS_META` (color+label only, duplicated from that page's own
    richer `STATUS_META` which also carries a `description` string this
    badge's simpler tooltip doesn't need). Did NOT refactor `/app/status/
    index.vue` itself to import from this new module — left its own
    duplicate `STATUS_FILES`/`STATUS_META` literals as-is, lower risk than
    touching a page not otherwise part of this task; the two color/label
    maps are small and worth keeping in sync by convention if either ever
    changes, noted in both files' own comments.
  - `CardDetailTabs.vue` (not in my agent file's own explicit domain list,
    but squarely the "card page" connective glue between the two callers —
    full page + peek panel — and `FunctionalModelText.vue`, which the task
    itself named as the render target) computes `cardStatus` from its own
    existing `props.set`/`props.number` and passes it straight through as a
    new `FunctionalModelText` prop; no new prop threading needed on either
    caller (`app/pages/app/card/[set]/[number].vue`,
    `CardPeekPanel.vue`) since both already pass `set`/`number` into
    `CardDetailTabs`.
  - **Status is per-CARD, not per-face** — confirmed directly against
    `functional-model/card-status.ts`'s `classifyCardStatus` (reads one
    card's whole `synergy.json` source+sink arrays and `definition.ts`,
    including a transforming DFC's `backFace`, as a single unit; the
    generated file itself has one entry per collector NUMBER, no
    per-face split at all). `cardStatus` is passed once into
    `FunctionalModelText` (not per-face), and its `v-for="face in
    card.faces"` template naturally renders the identical badge on both
    faces of a DFC as a result — verified live on fin/58 (Jill, Shiva's
    Dominant // Shiva, Warden of Ice): both faces show the same "Yellow"
    badge with the identical reasons string.
  - Tooltip is a bare native `title` attribute (the task's own stated
    minimum-acceptable option) — did NOT wire the dashboard's own
    floating-ui hover-card recipe onto this badge; that machinery is
    specific to the dashboard's own per-square hover state and would've
    been a nontrivial lift to bolt onto this heading row, which already has
    its own separate, `Segment`/fact-scoped floating tooltip for annotated
    name hover (a different, unrelated hover target).
  - Verified live against the already-running dev server (Playwright,
    scratch scripts, deleted after use — not committed): `fin/27` (Moogles'
    Valor) shows one orange square, `title="Orange: 1 of 3 fact(s) missing
    provenance..."`; `fin/34` (Stiltzkin) shows one green square; the SAME
    orange square renders inside the graph page's own peek panel
    (`/app?card=fin/27`); a nonexistent card number (`fin/9999`) shows zero
    badge squares (its own pre-existing 404 page-error is unrelated,
    confirmed by diffing console errors, not caused by this change).
    `npx vue-tsc --noEmit` clean.
  - No contract mismatch found/flagged — this whole feature lives entirely
    inside `card`'s own generated-status-consuming lane
    (`.claude/contracts/card-schema.md`'s existing "Per-card dashboard
    status" section already documents this artifact and explicitly invites
    a `card`-owned UI to read it directly), no engine/server shape touched.

- 2026-09-16, same day, follow-up relocation — the badge above was moved OUT
  of `FunctionalModelText.vue`'s face-name row into the Facts tab's own
  strip label in `CardDetailTabs.vue`'s `UTabs`, per explicit orchestrator
  follow-up (user wanted it there, not next to the card name).
  - `FunctionalModelText.vue`: badge markup, `cardStatus` prop, and the
    `CARD_STATUS_META`/`CardStatusEntry` imports are all fully reverted —
    confirmed via `git diff` showing zero changes to this file versus its
    pre-badge state (net a clean no-op once added-then-removed).
  - `CardDetailTabs.vue`: `:card-status="cardStatus"` binding to
    `FunctionalModelText` removed; `cardStatus` computed (still reads
    `props.set`/`props.number` via `getCardStatusEntry`, unchanged) is now
    consumed by a new `UTabs` `#leading` slot instead —
    `<template #leading="{ item }"><span v-if="item.value === 'facts' &&
    cardStatus" .../></template>` — scoped to the `'facts'` item only, so
    every other tab (Scenarios/Facts Json/Card Json/Card Definition) is
    unaffected (`UTabs`'s own default `#leading` slot content is just
    `item.icon`/`item.avatar`, neither of which any tab sets, so overriding
    the slot changes nothing for them). `CARD_STATUS_META` import added
    alongside the pre-existing `getCardStatusEntry` one.
  - Still per-CARD not per-face by construction — the badge now renders
    exactly ONCE per card page regardless of face count (previously it
    rendered once per face inside `FunctionalModelText.vue`'s own
    `v-for`) — confirmed live: `fin/58` (DFC) now shows exactly 1 yellow
    badge (was 2 before this relocation), same status/reasons either way.
  - Re-verified live, same 4 cases as before: `fin/27` (Moogles' Valor, full
    page + peek panel `/app?card=fin/27`) — 1 orange badge next to "Facts"
    in the tab strip, correct `title`; `fin/34` (Stiltzkin) — 1 green badge;
    `fin/58` (DFC) — 1 yellow badge (not 2, see above); `fin/9999`
    (nonexistent) — 0 status squares anywhere. `npx vue-tsc --noEmit`
    clean. Screenshots confirm visually: badge sits directly left of the
    "Facts" tab label, card name row is back to plain name + mana cost with
    nothing extra.

- 2026-09-16, same day, second follow-up — `app/components/CardPeekPanel.vue`
  is the ONLY place a real, visible chrome-level "card name" header exists
  (its own `<h2>` above the tab strip, set at panel-open time). Verified
  directly (not assumed) that the full page
  (`app/pages/app/card/[set]/[number].vue`) has NO equivalent — grepped for
  every `<h1>`/`<h2>`/`<h3>` in that file and found zero; it only sets the
  browser TAB title via `useHead()`, matching this file's own earlier-
  recorded note that the full page "has no name/title of its own, just nav
  chrome" (Back to graph / Previous / `#N` / Next, using the route's
  collector number, never the card name). So both requested additions
  (set/number next to the title, then click-to-copy on that same text) only
  ever touched `CardPeekPanel.vue` — nothing to add to the full page since
  it has no header to add it to.
  - Added a `${set}/${number}` span (`fin/27`) directly after the `<h2>`
    name, same formatting `CardDetailTabs.vue`'s own `factContextText()`
    already established this session, shown only once `data` has resolved
    (the `h2` itself already falls back to this same string while loading,
    so showing both at once during that window would've been a visible
    duplicate).
  - That span is ALSO the click-to-copy trigger (no separate button
    element, per an explicit simplification mid-task) — `copyHeaderRef()`
    writes `"<name> (<set>/<number>)"` to the clipboard and flips a new
    `copiedHeaderRef` ref briefly (~1s), which swaps a small adjacent
    `lucide:copy`/`lucide:check` icon and the span's own `title` — same
    icon-swap-plus-timeout convention as `CardDetailTabs.vue`'s existing
    Facts-tab row copy button (`copyFactContext`/`copiedFactKey`), just a
    separate, unrelated ref (this component has no `FactRow` to key off
    of).
  - **Verification detour, worth recording**: an early round of live
    verification against the pre-existing shared `:3000` dev server (the
    same long-running instance reused across this whole multi-round task)
    showed a real, reproducible-looking failure — `copiedHeaderRef.value =
    true` visibly ran (confirmed via temporary `console.log`), but the
    DOM's `title`/icon never appeared to update across several different
    polling delays (50ms-600ms). Before concluding this was a real
    reactivity bug, re-ran the identical test against a completely FRESH,
    independently-launched second dev server (`NUXT_IGNORE_LOCK=1 npm run
    dev -- --port 4173`, since Nuxt refuses a second instance by default —
    torn down again after) to rule out accumulated Vite/HMR staleness from
    three straight rounds of edits to these same files. Same inconclusive
    polling result there too — but a `MutationObserver`-based check (set up
    BEFORE the click, capturing every `title` attribute mutation as it
    happens, rather than polling snapshots after the fact) proved the
    feature works exactly as intended: `title` flips to `"Copied!"`
    immediately on click and reverts ~1s later, and a same-moment
    screenshot shows the checkmark icon rendered live. The earlier
    "unchanged after N ms" polling reads were themselves the unreliable
    artifact (root cause not fully pinned down — plausibly Playwright
    locator/CDP snapshot timing rather than anything Vue-side), not a real
    product bug — flagging this only so a future live-verification pass
    doesn't get misled by the same polling pattern; prefer a
    `MutationObserver` or an immediate post-click screenshot over a bare
    `waitForTimeout` + `outerHTML` check when verifying a brief, timed
    visual-feedback state like this one.
  - Re-verified clean on the throwaway `:4173` server (now torn down,
    confirmed port free again; the original shared `:3000` server confirmed
    untouched/still healthy afterward): full page `fin/27` has zero
    `h1`/`h2`/`h3` containing the card name; peek panel `fin/27` shows
    `<h2>Moogles' Valor</h2>` + a clickable `fin/27` span, clicking it
    writes `"Moogles' Valor (fin/27)"` to the clipboard; DFC peek panel
    (`fin/58`) shows exactly one such span (`fin/58`), same "chrome, not
    per-face" treatment the earlier status-badge relocation established.
    `npx vue-tsc --noEmit` clean throughout.
  - No contract mismatch — pure page/panel chrome, nothing engine- or
    server-owned touched.

- 2026-09-16 (AI-fact-elimination sweep, card-results-lane dispatch, fin/40,
  42, 44, 45, 46, 48 — 6 cards, "orange" status, 14 total unprovenanced
  facts): run 13:00-13:10 UTC. Re-examined every remaining hand-authored
  Fact card-by-card (not just re-running the pool script and reporting
  fallout), per the standing "try hard before declaring bespoke" instruction.
  Full detail lives in each card's own `progress.json` notes (dated
  2026-09-16 entries, prepended); summary here for cross-card pattern
  recall:
  - **weapons-vendor (fin/40)**: migrated its `onBeginCombat` effect off
    `kind:'custom'` onto the combinator DSL (`selectUpTo`/`applyToBound`/
    `equipTo`, mirroring `beatrix-loyal-general`'s/`gilgamesh-master-at-
    arms`'s own 2026-09-16 migrations) — real behavior confirmed unchanged
    via `run-scenarios.mjs` (Dragoon's Lance still attaches to Coeurl in the
    trace). Did NOT close the 2 remaining sink facts, though —
    `equipProgram-effect-structural.ts`'s own `expectedClausePattern` only
    has 2 confirmed templates (Beatrix's broadcast shape; Gilgamesh's
    anaphoric/subtype-narrowed shape), neither matching this card's own
    literal, independently-targeted, non-subtype-narrowed "attach target
    Equipment you control to target creature you control." **Escalation for
    the recognizer lane**: a 3rd template (`equipmentTargeted:true` + bare
    non-subtype-narrowed target pool + literal "target Equipment"/"target
    creature" wording) would close this card's own 2 sink facts + add a new
    source `equip` fact. Only 1 real in-pool card confirms it (same 1-card
    bar the file's own existing 2 templates were each built on) — Kor
    Outfitter/Noctis, Heir Apparent share the wording per Forge but are NOT
    in the FIN pool.
  - **white-mage-s-staff (fin/42)** and **astrologian-s-planisphere
    (fin/46)**: both cards' lone remaining fact (a granted `lifegain`/
    `putCounter` triggered ability on the EQUIPPED creature) re-confirmed as
    genuinely, permanently bespoke — this exact gap ("no mechanism grants a
    WHOLE NEW triggered ability, condition+effect pair, to another
    permanent") is already named in `ENGINE_GAPS.md`'s own "Genuinely
    unclosable" list (~line 314) for 4 real cards total (these two plus
    `black-mage-s-rod`/`summoner-s-grimoire`). No file changes made to
    either card.
  - **you-re-not-alone (fin/44)**: all 3 facts (source `pump` targeted; 2
    sinks) need a NEW recognizer, not just a rerun — `program-ast-
    walker.ts`'s own `actionOccurrence()` only builds occurrences for
    `'destroy'`/`'equip'` today; `'pump'`/`'dealDamage'` are explicitly
    named in its own header as "walked structurally but has no occurrence
    shape built for it yet." **Escalation for the recognizer lane**: extend
    the walker with `'pump'`/`'dealDamage'` occurrence support (a `Branch`/
    `compare`-derived magnitude sink, e.g. "wants 3+ creatures," is also
    needed) + a new consuming recognizer file. Real 2nd pool sibling
    confirmed: `slash-of-light` (not my slug, still fully unprovenanced,
    same base shape minus the `Branch`) — cite both together, don't build
    per-card.
  - **zack-fair (fin/45)**: richest case, 6/6 facts, 3 distinct outcomes:
    (1) ETB self-`putCounter` — genuinely bespoke, already a real,
    whole-pool-vetted decline in `putCounterSelf-effect-structural.ts`
    (real text has no "put" verb — CR 614.12 idiom). (2) self-sacrifice-as-
    cost `sacrifice` fact — **real, closable recognizer-lane escalation
    found this pass**: `sacrificeCostNamedType-structural.ts`'s own module
    doc comment ALREADY names this card (plus Blazing Bomb/Instant
    Ramen/Elven Passage) as a confirmed "Sacrifice <named self>/this <type>"
    shape it deliberately declines — a sibling recognizer
    (`sacrificeCostSelf-structural.ts`-shaped) reusing the established
    `selfSubjectAlternation` vocabulary would close it. (3) grantKeyword +
    counter-transfer + equip-reattach (4 facts) — considered migrating 2 of
    3 sub-effects to `program` but REJECTED it: would close zero facts today
    (walker lacks grantKeyword/putCounter occurrence support regardless) and
    would force splitting one atomic target-choice into two independently-
    resolving `Effect`s (a real correctness fragility) for no benefit;
    recommended deferring to one atomic migration once BOTH the walker gains
    that occurrence support AND a new engine-core Query source ("equipment
    attached to a given card") lands.
  - **combat-tutorial (fin/48)**: the 1 remaining fact ("target player draws
    two cards") re-confirmed genuinely bespoke — deeper than a recognizer
    gap, `card.ts`'s own `{kind:'drawCard'}` Effect type has no target-player
    field at all (unlike `loseLife`/`discard`'s own `EffectOwner`), so no
    recognizer could derive a `targeted` fact from it even with a widened
    regex. Confirmed the ONLY real pool card hitting this shape (per
    `drawCard-effect-structural.ts`'s own doc comment). Noted (not fixed,
    not my lane): this specific gap isn't yet centralized in
    `ENGINE_GAPS.md`'s own master list, only in the recognizer's/this card's
    own comments — a documentation-completeness nit for a future engine-core
    pass.
  - **Contract check**: no `card-schema.md`/`state-event-format.md` mismatch
    found — all 6 cards' `Fact`/`FactProvenance` shapes matched the
    contract as documented; no schema surprises this pass.
  - **Verification**: `verify-synergy.mjs` scoped to all 6 slugs together —
    0 hard failures (only pre-existing soft `note` lines, e.g. unrecognized
    `tapForMana`/`enters`/`equip` trace actions with no declared-produce
    counterpart — same widespread, already-accepted bucket dozens of other
    pool cards carry). `verify-annotation-coverage.mjs` (full pool, grepped
    for these 6 slugs): clean. `npx tsc --noEmit` (whole repo): clean, no
    errors from the one real code change (weapons-vendor/definition.ts).
    Scoped vitest (`equipProgram-effect-structural.test.ts` +
    `combinator.test.ts`): 41/41 pass.

- 2026-09-16 — AI-fact-elimination sweep, 5 cards (phoenix-down/fin-29,
  sidequest-catch-a-fish-cooking-campsite/fin-31, slash-of-light/fin-32,
  summon-primal-garuda/fin-37, venat-heart-of-hydaelyn-hydaelyn-the-
  mothercrystal/fin-39), dispatched per `scripts/AI_FACT_ELIMINATION_PROCESS
  .md`'s card-results lane, write-fenced off `recognizers/*`. Started
  2026-09-16 13:00 UTC, finished ~13:12 UTC (~12 min). Only 1 of 5 cards
  closed anything via a scoped `apply-recognizers.mjs` rerun this pass
  (summon-primal-garuda: 2 facts, `pumpTarget-effect-structural`/
  `grantKeywordTarget-effect-structural`'s own `owner`/`notSelf` extension
  landed 2026-09-15/16 but hadn't been rerun against this specific card;
  venat's front-trigger cast/sink pair had ALREADY closed via
  `castTypeSpell-trigger-structural`, built since this card's last triage —
  confirmed, not re-closed by me). The other 4 cards' remaining facts all
  needed genuine recognizer-lane/engine-core work, none turned out to be
  closable from this lane, and (per the "attempt hard" standing instruction)
  none were accepted as bespoke without independently re-deriving why —
  full findings/escalations are written into each card's own `progress.json`
  notes (dated 2026-09-16, "card-results AI-fact-elimination sweep"), not
  duplicated here in full. Real escalations found, all cited with exact
  recognizer file + template + affected-card list in each card's own
  progress.json:
  - **New recognizer candidate**: `exileSelfCost-structural.ts` (mirrors
    `tapSelfCost-structural.ts`/`discardSelfCost-structural.ts` exactly) —
    3 real pool cards (`ether`, `elixir`, `phoenix-down`) share the literal
    "Exile this artifact" activation-cost template; `ether` already carries
    the same fact unprovenanced today, confirming pool-wide reach, not a
    one-off.
  - **`move-effect-structural.ts` widening (2 items)**: (a) its own
    documented CR-108.4 gate (owner scopes WHICH ZONE is searched, not
    control, for a `from:'Graveyard'`/`'Library'` move) — pre-existing,
    named in that file's own module comment (phoenix-down among ~8 cited
    cards), re-verified still true via a live probe script, not stale. (b)
    `typeWordFor` reads only `validType`, never `subtype` — phoenix-down's
    own `subtype:['Skeleton','Spirit','Zombie']` array (a field `card.ts`'s
    own doc comment says was built specifically for this card) has no
    template at all; confirmed phoenix-down is the ONLY pool card with an
    array `subtype` on a `target:true` move effect (narrow, single-card, but
    real — same acceptable bar Aerith's own single-card
    `putCounterMagnitude-clause-structural.ts` already sets).
  - **New recognizer candidate**: `dealDamageEachMagnitude-effect-
    structural.ts` (or similar) for slash-of-light's own `kind:'program'`
    `selectUpTo`+`applyToBound(dealDamageEach(add(count,count)))` shape — no
    recognizer reads `EachAction` `'dealDamage'`/`AddValue` at all yet
    (checked); mirrors `ptFormula-scalingPump-structural.ts`'s own precedent
    (structural field -> 2 sinks, one per summed term) but over a `program`
    AST instead of the `ptFormula` field. Single real motivating card today,
    same accepted precedent as Aerith's own recognizer.
  - **Real, confirmed bug in `pumpTarget-effect-structural.ts`**: its own
    fact-construction code reads `effect.untilEndOfTurn` to build the
    required TEXT pattern but never includes it in the emitted `Fact`
    object at all (confirmed by direct code read, not inference) — found
    while comparing summon-primal-garuda's freshly-recognized `pump` fact
    (missing `untilEndOfTurn`) against `magic-damper`'s existing
    `synergy.json`, which still carries `untilEndOfTurn:true` under the
    SAME rule from what must be an earlier, since-regressed version of this
    recognizer (apply-recognizers.mjs never overwrites an already-written
    fact, so the stale-but-correct output silently survived). Sibling
    `grantKeywordTarget-effect-structural.ts` does NOT have this bug.
    Blocked me from dropping summon-primal-garuda's OLD unprovenanced `pump`
    fact as a stale duplicate (kept both — the new one is currently a real
    information LOSS, not a strict superset, until this is fixed); DID drop
    the old `grantKeyword` fact (a true superset once fixed there).
  - **engine-core-level, not recognizer-level**: sidequest-catch-a-fish-
    cooking-campsite's front-face onUpkeep effect needs BOTH a `dig`-
    validType hasAny/union widening AND (checked directly against
    `combinator.ts`) the combinator DSL has literally no library-zone
    `Query.source` at all (`creaturesInPlay`/`permanentsInPlay` are the only
    two) — can't even start a combinator migration for this shape today,
    let alone get a recognizer to read it. venat's Blessing-of-Light trio
    similarly needs a subtype-conditional `Branch` (`combinator.ts`'s own
    `Condition` is numeric-only, confirmed by reading the interface
    directly) before even a partial combinator migration would be safe/
    worthwhile.
  - Genuinely bespoke (re-derived independently, not trusted from a prior
    note): summon-primal-garuda's Aerial Blast tapped-creature damage
    (`dealDamageTarget` has `owner` but no `tapped` field at all —
    confirmed direct in `card.ts`); venat's self-transform exile+return pair
    (`sequenceExileReturn-effect-structural.ts`'s own required "Exile...,
    then return it to the battlefield" phrase genuinely absent from Venat's
    real "Transform Venat" text, re-confirmed against that recognizer's
    exact regex, not assumed).
  - One direct synergy.json hand-edit (summon-primal-garuda): dropped one
    stale, fully-superseded duplicate `grantKeyword` fact per the task's own
    explicit "drop a genuinely stale/wrong fact" allowance — never used to
    hand-restore/infer, only to remove a real duplicate a fresh recognizer
    run had already superseded.
  - `verify-synergy.mjs`/`verify-text-coverage.mjs` scoped to all 5 slugs
    together: 0 hard failures, only pre-existing soft notes. `review` was
    already `"ai"` on all 5 (no human-review flag to reset).
  - `data/fin/fin_card_status.json`: NOT regenerated by me —
    `compute-card-status.mjs` has no per-slug scoping (whole-pool dynamic
    import only, confirmed by reading its own header), and the task's own
    instruction was to leave a pool-wide-only regen for the orchestrator
    rather than run it from a single-batch lane.

- **2026-09-16, AI-fact-elimination re-triage, fin/67-70 (relm-s-sketching,
  retrieve-the-esper, rook-turret, sage-s-nouliths)** — card-results-lane
  dispatch, narrowed to 4 slugs, write-fenced off recognizers/combinator/
  card.ts. `apply-recognizers.mjs` scoped-per-card confirmed 0 new facts on
  all 4 (no rerun staleness anywhere) — every remaining unprovenanced fact
  genuinely re-examined, none closable by this lane. Full writeup of the
  "why" per fact is in each card's own `progress.json` notes (appended, not
  replacing prior history) — summary here for a future session that
  doesn't want to reread all 4:
  - **relm-s-sketching (all 3 facts)**: genuinely bespoke to a
    missing-engine-vocab class, not this lane's call to build. Whole effect
    is `kind:'custom'` ("create a token copy of target artifact/creature/
    land") — no declarative Effect kind can build a `TokenInfo` off a
    runtime-chosen target's own characteristics, so it's invisible to
    `token-creation-structural.ts` (which only ever reads `kind:'createToken'`
    with a fixed `TOKENS` registry entry). **Not a singleton**: found 2
    siblings with the identical underlying gap —
    `the-fire-crystal` (plain copy of target creature, no overrides) and
    `ardyn-the-usurper` (copy WITH P/T/color/type overrides, already tracked
    as `ENGINE_GAPS.md` gap #25 — that entry's own "Ardyn is the ONLY real
    card needing this" line is now stale/wrong, confirmed by direct
    definition.ts read of all 3). Escalation: engine-core needs a real
    "copy a permanent into a token" primitive (gap #25's own writeup already
    scopes the harder overrides case; relm/the-fire-crystal only need the
    PLAIN-copy subset, no overrides) + a recognizer to read it once it
    exists.
  - **retrieve-the-esper (2 of 4 facts)**: token-creation + conditional
    putCounter, one `kind:'custom'` closure ("create a token; IF cast from
    graveyard, put counters on THAT SAME token"). Confirmed via direct
    `combinator.ts` read: no `castFrom`-shaped `Condition` variant exists
    (only `CompareCondition`/`HasSubtypeCondition`), no `createToken`
    `EachAction`/`SequenceStep`, and no way to bind a just-created object's
    reference for a later program step. Genuine new-vocabulary gap (not a
    recognizer widening) — escalated to engine-core. Not found to be shared
    with any other real pool card (checked oracle text for "that token"
    pool-wide: only this card and one unrelated Equipment-copy card, which
    isn't the same shape).
  - **rook-turret (2 of 3 facts)**: BOTH are narrow, well-specified
    EXISTING-recognizer widenings, escalated to the recognizer lane, not
    "genuinely bespoke":
    1. drawCard fact ("you MAY draw a card") — `card.ts`'s `kind:'drawCard'`
       gained a real `optional?: boolean` field 2026-09-16 built specifically
       for this card, but `drawCard-effect-structural.ts` was never updated
       to consume it — still hard-declines any "may draw" text as
       `kind:'scope'` via its own module doc comment, never reads
       `effect.optional` at all. Clear, narrow fix.
    2. sink fact (`entersBattlefield`/`types:{has:['Artifact']}` off the
       `onArtifactEnters` trigger name) — no recognizer derives a sink from a
       named `onXEnters` trigger's own type filter at all. Confirmed NOT a
       rook-turret-only gap: `loporrit-scout`/`woodland-weavemaster` carry
       the byte-identical unprovenanced shape (Creature/Elf). Real
       new-recognizer candidate (trigger-name → paired sink), 3+ real cards
       benefit.
  - **sage-s-nouliths (2 of 7 facts)**: also an EXISTING-recognizer
    widening, not bespoke. `untapTarget-effect-structural.ts` exists but is
    scoped ONLY to `validType:'creature'` chained off a preceding
    `pumpTarget`/`grantKeywordTarget` (Magic Damper's "...Untap it" pronoun
    chain — its sole real motivator, per that recognizer's own doc comment
    citing only 2 real `kind:'untapTarget'` occurrences pool-wide before this
    card). This card's `validType:'attacking'` is a 3rd real occurrence, a
    simpler non-chained "untap target attacking creature" clause the
    recognizer's own `validType !== 'creature'` gate declines before even
    reaching the chaining check. Narrow, real widening + paired sink,
    escalated to the recognizer lane.
  - **General lesson reinforced**: every single unprovenanced fact
    encountered this pass traced to one of exactly 2 root causes —
    (a) the underlying effect is `kind:'custom'` (opaque to every structural
    recognizer by construction), or (b) an existing, narrowly-scoped
    recognizer's own gate declines a real, adjacent, un-covered case it
    was never widened for. Zero were "genuinely bespoke, no possible
    recognizer" in the strong sense (a claim no future recognizer could ever
    generalize to) — pushes back on settling for that label too early,
    matching the standing instruction.
  - `verify-synergy.mjs` scoped to all 4: 0 hard failures (only pre-existing
    accepted soft notes — `tapForMana`, one `enters`-with-no-declared-
    produce on rook-turret, one `equip`-with-no-declared-produce on
    sage-s-nouliths — none introduced by this pass). `apply-recognizers.mjs`
    wrote 0 files for all 4 (confirmed no accidental pool-wide run).
  - Touched only `progress.json` (4 files: `lastVerified` bumped to
    2026-09-16, appended notes recording the above) — no definition.ts/
    scenarios.ts/synergy.json edits were needed or made (nothing was
    closable, so nothing to author). `review` left untouched (`"ai"` on all
    4 already, no content change to reset from anyway).
  - **Pre-existing, NOT mine**: `rook-turret`/`sage-s-nouliths`'s own
    `definition.ts`/`scenarios.ts`/`trace.json` and `retrieve-the-esper`'s
    `synergy.json` showed as modified in `git status` from BEFORE this task
    started (a concurrent engine-lane session's own in-flight pilot-triage
    work, per those files' own 2026-09-16-dated comments) — confirmed via
    my own tool-call history that I only ever ran `Edit` against the 4
    `progress.json` files, nothing else in those directories.
  - **Contract check**: `.claude/contracts/card-schema.md` matches the real
    on-disk `Fact` shape observed across all 4 cards (annotations array,
    merged `to`/`from`/`event` fields, `provenance.origin==='parser'`
    convention) — no drift found, nothing to flag.

- **2026-09-16, AI-fact-elimination sweep, fin/51 edgar-king-of-figaro, fin/55
  ice-flan, fin/59 louisoix-s-sacrifice, fin/62 matoya-archon-elder, fin/63
  memories-returning** (card-results lane, per `scripts/
  AI_FACT_ELIMINATION_PROCESS.md`, write-fenced off `recognizers/*`). Started
  2026-09-16 15:48 UTC, finished ~16:02 UTC (~14 min). Per-card outcome:
  - **edgar-king-of-figaro (3 of 4 unprovenanced)**: `apply-recognizers.mjs`
    rerun: 0 new facts, confirming still-real gaps, not staleness. (1)
    `winCoinFlip` source — real recognizer-lane escalation: `card.ts`'s
    `TwoHeadedCoin` keyword + `state.flipCoin`'s own CR-614 replacement
    mechanism ARE now real (ENGINE_GAPS.md gap #15 closed since this card's
    own 2026-09-12 progress.json note was written, which is now STALE —
    fixed), but NO recognizer reads the `TwoHeadedCoin` keyword at all;
    `lifegainDoubleKeyword-structural.ts` is the exact right precedent to
    mirror (single-card, keyword-gated, one fixed literal clause). (2+3)
    `drawCard` source (ETB scaled by artifact count) + its paired sink — did
    NOT just defer to the pre-existing "parked CDA scaling gap" note;
    instead MIGRATED `definition.ts`'s own effect off an opaque
    `Computed<number>` closure onto the combinator DSL (`kind:'program'`,
    `drawCard(you.permanentsInPlay().filter('cardType','artifact').count())`
    — `combinator.ts` already has every primitive needed, `Aggregate`
    count over a `Query`/`Filter`, no new engine-core work required),
    confirmed byte-identical real behavior via `run-scenarios.mjs`. This
    does NOT itself flip provenance — `drawCardProgram-effect-structural.ts`
    only has a confirmed template for `amount===1` (Venat's shape) — but
    unblocks a much narrower, cleanly-scoped recognizer-lane escalation
    (an `Aggregate`-based `amount` branch + paired sink, mirroring
    `ptFormula-scalingPump-structural.ts`'s own source+sink pairing design).
    Corrected 2 stale `knownGaps` entries in the process (one claiming the
    coin-flip engine gap was still open, one claiming the scaling gap was
    still closure-blocked at the engine-vocabulary level).
  - **ice-flan (1 of 7 unprovenanced)**: the `putCounter`(stun) source fact
    is ALREADY explicitly named (by slug) in `putCounterTarget-effect-
    structural.ts`'s own module doc comment as a double-decline (validType
    `'creature-or-artifact'` has no template, AND it's pronoun-carryover
    from a preceding `tapTarget` — "put a stun counter on it"). Real,
    closeable recognizer-lane escalation, not bespoke: a pronoun-carryover
    template needs no typeWord at all (sidesteps decline #1 entirely),
    reading the target constraint off the PRECEDING `tapTarget` effect's own
    `validType` instead of matching oracle text for a type word. Confirmed
    2 more real pool siblings sharing this exact shape today
    (`summon-shiva`, `omega-heartless-evolution`, both still unprovenanced)
    — 3+ real cards would close via one new branch. Also fixed a stale
    `knownGaps` entry (claimed `definition.ts` still used `validType:
    'creature'` only; the real fix already landed 2026-09-15).
  - **louisoix-s-sacrifice (2 of 3 unprovenanced)**: `sacrifice-effect-
    structural.ts` already explicitly declines this card BY NAME (real text
    "sacrifice a LEGENDARY creature," no `validType` narrowing for
    Legendary exists on `sacrifice`'s own closed union — confirmed via
    direct `card.ts` read, no `subtype`-style field the way `move` has).
    Re-classified this from the card's own prior "permanently accepted
    trade-off" framing to a real, open, single-card-confirmed engine-core +
    recognizer escalation (a new `validType` member or `subtype` field on
    `kind:'sacrifice'`) — per the standing "attempt hard" instruction, did
    not just accept the older framing at face value.
  - **matoya-archon-elder (3 of 4 unprovenanced)**: closed 1 of 3 via direct
    investigation, not a rerun — directly invoked
    `recognizeDrawCardEffectStructural` against this card's real definition/
    oracle text and confirmed it already produces the SAME correctly-
    provenanced fact its sibling (the pre-existing 2nd hand-authored
    `drawCard` fact) duplicates, just anchored at the wrong span (this
    card's own REMINDER-TEXT parenthetical, a stale 2026-09-12-era
    workaround for an identity-collision problem that no longer exists
    under the current `coreKey`, which doesn't key on annotations at all).
    Dropped the stale duplicate directly from `synergy.json` (a genuine
    "drop stale/wrong fact," never a hand-restore) — confirmed 0
    hard-failure/coverage regression before vs. after. The remaining 2
    (`scry`/`surveil` sinks): no recognizer anywhere reads a trigger
    PRECONDITION clause like "Whenever you scry or surveil," at all —
    `lifegain-trigger-structural.ts` (pure text-based, no CardDefinition
    field read) is the right precedent; this card is the sole real
    motivator (only card with `onScry`/`onSurveil` triggers or a scry/
    surveil SINK anywhere in the pool).
  - **memories-returning (3 of 3 unprovenanced)**: 2 of 3 (Flashback
    cast-from-graveyard + exile pair) are a clean recognizer-lane
    escalation — `flashback-alternateCost-structural.ts` requires the full
    reminder-text parenthetical verbatim, but this card's own real printed
    text is a genuinely bare "Flashback {7}{U}{U}" with NO reminder text at
    all (independently confirmed via BOTH Forge's own cardsfolder script
    AND XMage's own Java source, so a real printed-card quirk, not a
    data-sync bug) — the sole one of 14 real pool Flashback cards missing
    it. Needs a fallback branch keyed off the bare heading alone (CR 702.32
    behavior is intrinsic to the keyword regardless of reminder text).
    The 3rd (Library->Hand dig-tutor fact): attempted hard, landed on
    genuinely bespoke — the card's own real Forge script is a 4-step
    alternating 2-player `DB$ Dig` chain with no clean single-clause
    English rendering (unlike Ashe's/Dark Confidant's simpler `take:1`
    shapes), and the recognizer's own cited theoretical second motivator
    (Dark Confidant) doesn't even carry a comparable fact today (checked
    directly) — no live second real card is blocked by this gap, only a
    hypothetical one.
  - **Pattern reinforced (same lesson the fin/67-70 batch above already
    drew)**: every unprovenanced fact this pass traced to a real, nameable
    cause — an existing recognizer already explicitly declining this exact
    card (3 of 5 cards had this), a stale duplicate/wrong annotation from
    an outdated authoring-era workaround (1 card), or a genuinely complex
    multi-step real mechanic with no adjacent recognizer template at all (1
    fact, 1 card). Zero facts were declared bespoke without first checking
    the actual recognizer source for an already-written, named decline
    reason.
  - Full verification, all 5 slugs together: `apply-recognizers.mjs` 0 new
    facts; `verify-synergy.mjs` 0 hard failures (only pre-existing accepted
    `tapForMana`/bare-`enters`/`discard`/`surveil` soft notes);
    `verify-text-coverage.mjs` — only edgar (45%, the Two-Headed Coin gap)
    and louisoix (69%, the sacrifice-clause prefix) below 85%, both already
    fully explained by the escalations above, not new; `verify-annotation-
    coverage.mjs` (whole pool) clean for all 5; `npx tsc --noEmit` clean.
    No test suite run (day-to-day card-results policy).
  - Files touched: `progress.json` for all 5 (notes + `knownGaps`
    corrections); `edgar-king-of-figaro/definition.ts` (combinator-DSL
    migration) + its `trace.json` (regenerated via `run-scenarios.mjs
    --slug=edgar-king-of-figaro` only); `matoya-archon-elder/synergy.json`
    (dropped 1 stale duplicate fact). No `recognizers/*` touched (per
    write-fence) — 5 escalations handed back for the recognizer lane
    (winCoinFlip keyword recognizer; drawCardProgram Aggregate-amount
    branch + paired sink; putCounterTarget pronoun-carryover branch;
    sacrifice legendary-subtype vocabulary, which is really an
    engine-core/card.ts change with a recognizer follow-up; flashback
    reminder-text-absent fallback branch).
  - Pre-existing, NOT mine (confirmed via git diff content, matches what I
    read at task start, not something I introduced): `ice-flan/
    definition.ts` (`on:'enter'` addition), `louisoix-s-sacrifice/
    definition.ts` (recognizer-exception comment) + its own `trace.json`
    (an `id` counter renumbering, 1476->3), `ice-flan/synergy.json`
    (tapTarget/moveSearchLibrary/entersBattlefield provenance) — all
    already present when each file was first read this session, from other
    concurrent sessions' in-flight work on the same shared pool.
  - **Contract check**: no `card-schema.md`/`state-event-format.md` mismatch
    found — every `Fact`/`FactProvenance`/`ProgramNode` shape encountered
    (including the new `kind:'program'`/`DrawCard`/`Aggregate`/`Query`/
    `Filter` combinator vocabulary used in edgar's migration) matched the
    contracts as documented.

- **2026-09-16, live "500" bug on `/app/status?card=fin/2`**, ~20:26-20:40
  local (+0400). Started 20:26, finished ~20:40 (~14 min). Reported as an
  HTTP 500 but both the page shell and `/api/card/fin/2` were already
  confirmed 200 — reproduced live via a scratch Playwright script (run from
  the repo root so local `playwright` resolves; deleted after use, nothing
  committed) against the ALREADY-RUNNING dev server on :3000 (never
  restarted/killed it, per instruction). Real browser console showed a Vue
  Router `NUXT_E1005`/`VUE_ROUTER_R0011` init failure caused by `TypeError:
  Failed to fetch dynamically imported module: .../pages/app/status/
  index.vue`, a 404 on that module from Vite's dev middleware. Found the
  actual root cause in the dev server's own stdout (redirected to a log
  file — `readlink /proc/<pid>/fd/1` finds it for any backgrounded dev
  server if a repeat needs this): Vite's `vite:import-analysis` plugin was
  throwing `Failed to resolve import "../../../../data/fin/fin_card_status.
  json" from "app/pages/app/status/index.vue". Does the file exist?" — a
  real file, real correct relative-path depth (confirmed via `path.resolve`
  + `fs.existsSync`, and cross-checked against `app/lib/cardStatus.ts`'s own
  successful `../../data/...` import of the SAME file from a shallower
  directory) — this was NOT a CardPeekPanel/CardDetailTabs/
  FunctionalModelText prop-mismatch bug at all (the orchestrator's own
  leading hypothesis, reasonably so given the day's two prior rounds of
  changes to those files — but the real cause was elsewhere). Root cause:
  `data/fin/fin_card_status.json` is a generated, gitignore-adjacent
  artifact (`npm run card-status`, per the dashboard's own on-page
  "Generated ..." caption) that was created/regenerated (birth time ~20:12)
  AFTER this long-running dev server (started previous day, per its own
  stdout redirect's mtime) had already attempted — and failed — to resolve
  `status/index.vue`'s import of it at least once while the file didn't yet
  exist on disk. Vite doesn't retry/invalidate a failed relative-import
  resolution once the previously-missing target file later appears — there
  was never a working dependency edge for its watcher to invalidate. Fixed
  by forcing Vite to re-transform the importing file (`touch app/pages/app/
  status/index.vue`, zero content change, confirmed via `git status`/`git
  diff --stat` showing only the pre-existing untracked-new-file state, no
  diff) — this is a genuine, if narrow, general lesson for this dev-server
  setup: a page that statically imports a *generated* data file (as
  opposed to fetching it at runtime via an API route, which every other
  served-JSON case in this app already does — `server/api/*` reading
  `data/fin/fin_relations.json` etc.) can go stale exactly like this if the
  generator runs after Vite's first resolve attempt on that page. Did NOT
  change either import to fetch-at-runtime instead of static-import (that
  would be a real, separate architecture change — flagging it, not making
  it unasked). Verified live, no code changes needed: `/app/status?card=
  fin/2` (peek panel) and `/app?card=fin/2` (graph page's own peek panel)
  both render fin/2's full Facts/Scenarios/Interactions content with zero
  console errors post-touch (Playwright `pageerror`/`console.error`
  listeners both empty on repeat runs).
  - **Contract check**: none — no contract-shaped data crossed this bug at
    all, it was a dev-tooling resolution-timing artifact, not a schema
    mismatch.

- **2026-09-16, add 6th `'verified'` status bucket (UI side)**, started
  and finished within one short session (~15 min, no long-running steps).
  Sibling `engine` task adds `'verified'` to the classifier
  (`functional-model/card-status.ts`, `compute-card-status.mjs`) using
  that literal string — this task only widened the two independent
  literal-copy `CardStatusBucket` unions on the UI side, per this file's
  own "duplicated rather than imported" convention (`app/lib/cardStatus.ts`
  header comment): both `app/lib/cardStatus.ts` (`CARD_STATUS_META`, incl.
  its own "same N colors" comment) and `app/pages/app/status/index.vue`
  (`STATUS_META` + `STATUS_ORDER`) now list `verified` FIRST (stricter-than-
  green ordering, `#84cc16`/"Verified"), both green and everything else
  unchanged. `CardDetailTabs.vue`'s own Facts-tab status square
  (`CARD_STATUS_META[cardStatus.status]`) needed NO change — it already
  indexes the shared record dynamically, not a hardcoded 5-value
  switch/Record literal of its own, so it picks up `verified` for free.
  Grepped the whole `app/` tree for any other `CardStatusBucket`/
  `STATUS_META`/`STATUS_ORDER`/bucket-literal handling — confirmed exactly
  these 3 files (`cardStatus.ts`, `status/index.vue`, `CardDetailTabs.vue`)
  are the only ones that know about this concept at all; no other stale
  5-value site found. `vue-tsc --noEmit` clean after the change.
  - **Live verification**: `data/fin/fin_card_status.json` (untracked,
    presumably a fresh regen from the sibling engine task already running
    concurrently) had 0 `verified` entries at check time (69 green/195
    orange/26 red/13 yellow/3 gray) — sibling task hadn't landed a real
    verified card yet, as the dispatch anticipated. Did a structural live
    check instead: started the dev server, confirmed `/app/status` and
    `/app/card/fin/1` both 200 over HTTP. Also did a throwaway in-place
    edit of the (untracked, so safely revertible) status JSON — flipped
    fin/1's own real `green` entry to `verified` — to sanity-check the
    data shape end-to-end, then restored the exact original file content
    immediately after (confirmed via `grep -c '"status": "verified"'` back
    to 0 and a diff showing no residual change). Could NOT do true visual/
    DOM confirmation (swatch color, badge tooltip) — no Playwright/browser
    tool was actually exposed to this subagent invocation despite the
    dispatch asking for it; only `Read`/`Edit`/`Write`/`Bash`/
    `SubagentHandback` were available. Flagging this tooling gap rather
    than silently skipping the ask. Dev server was stopped again before
    finishing (confirmed no stray `nuxt`/`vite` process left running).
  - **Contract flag**: `.claude/contracts/card-schema.md`'s "Per-card
    dashboard status" section (~line 896-912) still literally documents
    the bucket enum as `'green'|'yellow'|'orange'|'red'|'gray'` (5 values,
    no `verified`) — now stale as of this task + the sibling engine change;
    flagging for the orchestrator to update rather than editing a contract
    file myself.

## 2026-09-16 (later): Left/Right arrow-key nav on the status page grid

Task: ArrowLeft/ArrowRight should move the peek panel to the prev/next
card in `/app/status`'s own grid order while the panel is open. ~25min.

Where the logic lives, and why: entirely in
`app/pages/app/status/index.vue`, NOT in `CardPeekPanel.vue`. The panel
component is shared with the main graph page (a force-directed layout
with no "next card" notion at all), so it must stay ignorant of any
particular host's own ordering — it only exposes
`store.panelCardKey`/`store.openCardPanel` (useGraphStore.ts), which any
host can drive itself. The status page already owned both halves of what
arrow-key nav needs: the flat visual order (`sortedCards` — confirmed this
IS the grid's own row-major reading order, since `rows`/`clusters` are
built by slicing straight out of it, nothing reorders within a row) and
the open mechanism (`openCard()`, already wired to click). Arrow-key nav
is just: find current index in `sortedCards` via `store.panelCardKey`,
step ±1, call `openCard` on the neighbor if one exists.

Chose CLAMP over wrap at either edge (task left it my call) — matches the
full card-detail page's existing Previous/Next behavior
(`app/pages/app/card/[set]/[number].vue`), which also stops dead at
either end rather than cycling. That file was also useful prior art for
the "no text-input guard needed" pattern it uses on itself — except this
page genuinely does need one: `layouts/graph.vue` mounts `AppHeader.vue`
(and its `SearchBox.vue` text input) on every page under this layout,
`/app/status` included, so a bare `document.activeElement` tag-name
guard (`INPUT`/`TEXTAREA`/`isContentEditable`) was added, exactly as the
task suggested doing if no existing shared guard util existed (grepped —
none did, anywhere in `app/`).

Verified live via a throwaway Playwright script run from inside the repo
root (had to copy out of the scratchpad dir first — module resolution
needs project `node_modules`; deleted after): opened fin/1 (Summon:
Bahamut) by click, ArrowRight → fin/2 (Ultima, Origin of Oblivion),
ArrowRight → fin/3 (Adelbert Steiner), ArrowLeft → back to fin/2 — panel
title (real card name, not a placeholder) and `?card=fin/N` URL param
both updated correctly each step. Focused the SearchBox input, pressed
ArrowRight: panel did NOT change (guard confirmed working). Escape still
closes the panel correctly (unrelated existing behavior, unaffected).

`vue-tsc --noEmit` clean. No contract/schema changes — pure client-side
nav wiring, nothing engine- or API-shaped touched.

## 2026-09-16 (later still): shared-annotation-span hover only highlighted ONE of 2 rows

~21:04-21:35 local. Real bug, confirmed live first per the dispatch's own
instruction before touching anything: fin/4 (Aerith Gainsborough) has two
Facts (`[sink]` "Dying", `[source]` "Dies") whose `annotations` are BYTE-
IDENTICAL (`{target:'oracle', line:2, start:0, end:29}`, both
`provenance.rule: 'dies-trigger-structural'`) — `FunctionalModelText.vue`'s
own `buildSegments` already correctly unions both facts onto the one shared
`Segment` (confirmed via its own doc comment, already documented as
handling "an EXACT-duplicate pair... merges into one multi-fact segment"),
so the bug was never there. It was in `show()`, the segment mouseenter
handler: `emit('hover', seg.facts?.[0] ? factKey(seg.facts[0]) : ...)` —
literally hardcoded to the FIRST fact only, by explicit prior design (an
old comment even documented this as deliberate: "only the first fact...
drives the cross-panel highlight... the table/interactions side has no
notion of 'this row is one of several'"). That "only first" convention was
also mirrored in `CardDetailTabs.vue`'s own single `hoveredFactKey: string
| null` ref and `FunctionalModelText.vue`'s `highlightKey?: string | null`
prop/`isRowHighlighted` — a single-identity model throughout, not equipped
to broadcast/match more than one key at a time. Same shape confirmed (via
`GET /api/card/fin/<n>`) on all 6 other named real cards
(dwarven-castle-guard, undercity-dire-rat, ancient-adamantoise,
garland-knight-of-cornelia-chaos-the-endless, magic-pot,
vincent-valentine-galian-beast) — all a `[source]`/`[sink]` dies-trigger
pair sharing one identical span, same `dies-trigger-structural` rule.

**Fix** — widened the single-key model to an array everywhere it flows,
kept `null`/empty = "nothing hovered":
- `FunctionalModelText.vue`: prop renamed `highlightKey?: string | null` →
  `highlightKeys?: string[] | null`; emit `hover: [key: string | null]` →
  `hover: [keys: string[] | null]`; `isRowHighlighted` now checks
  `keys.includes(...)` against every fact/span on the segment (was a
  single `===`); `show()` now builds `keys` from EVERY fact then EVERY
  non-Fact span on the hovered segment (`seg.facts.map(factKey)` then
  `seg.spans.map(s => s.key)`) and emits the whole array (was
  `seg.facts?.[0]` only).
- `CardDetailTabs.vue`: `hoveredFactKey` ref renamed `hoveredFactKeys:
  string[] | null`; new `isKeyHovered(key)` helper
  (`hoveredFactKeys?.includes(key)`) replaces the 3 separate `===` checks
  (fact row, non-Fact-span row, Interactions-panel row); each row's own
  `@mouseenter` now sets a ONE-ELEMENT array (`[factKey(row.fact)]` /
  `[row.key]`) — deliberately did NOT widen row→row (hovering "Dying" does
  NOT also highlight the sibling "Dies" row): the dispatch's own "Done
  when" only required shared-SPAN hover → both rows, and row hover → the
  shared span (already true before this fix, since `isRowHighlighted`
  already used `.some()`); computing "which other rows share this exact
  span" client-side would need re-deriving `buildSegments`' own interval-
  partition logic a second time in this file just to find siblings, real
  scope creep beyond the reported bug — flagging as a possible follow-up,
  not doing it silently.
- A single-fact span/row (the overwhelmingly common case) is now just a
  one-element array everywhere — confirmed a pure widening, not a
  behavior change, both by code inspection (every comparison changed from
  `x === y` to a one-item `[y].includes(x)`-equivalent) and live below.

**Verified live** (Playwright, scratch script run from repo root then
deleted, against the already-running dev server on :3000 — never
restarted it): fin/4 and fin/172 (Ancient Adamantoise, second real card
from the named list) both confirmed, all in one pass each:
1. Hovering the shared "dies" oracle-text span → BOTH rows ("Dying" AND
   "Dies") get `bg-surface/60`.
2. Hovering either row alone → the shared span gets the highlight class
   (row→text, confirmed independently for both rows).
3. A same-card single-fact span elsewhere (fin/4's "gain life" lifegain
   trigger; fin/172's "create ten tapped Treasure tokens"
   entersBattlefield clause) still highlights ONLY its own one row, not
   the Dying/Dies pair — no regression to the common case.
4. Zero console/page errors either card.
Needed one extra discovery mid-task: the Facts table renders 0 rows by
default on cards like fin/4 whose facts are ALL parser-derived (the
default-OFF "other" toggle hides every row until checked) — not a bug,
just meant the verify script had to click that checkbox before any rows
existed to hover at all.

`vue-tsc --noEmit` clean.
- **Contract check**: none — `highlightKey`/`hoveredFactKey` were never
  contract-documented (pure internal UI wiring between two card-domain
  components, no engine/API-shaped data crossed), so no `.claude/
  contracts/*.md` file needed updating either.

## 2026-09-16 (later still): `Fact.triggeredBy` cause/effect row highlighting

Task: hovering a Fact row whose `triggeredBy` names a `Trigger` should
highlight every OTHER visible fact sharing that same value, in a second
shade distinct from the hovered row's own — Facts-tab table only, no
persistent color/legend. Built generically against the type/shape (only 1
recognizer sets it pool-wide, 0 real on-disk facts have it yet — same
thin-data situation `annotatedNonFactSpans` was in when it was built).

**API passthrough**: already generic, no server change needed — confirmed
by reading, not assumed. `server/api/card/[set]/[number].ts`'s
`loadCardSynergy(slug)` is a raw `JSON.parse` of `synergy.json` passed
straight through as `synergy: entry.synergy` (`{ source: Fact[]; sink:
Fact[] }`, `cardResponse.ts`'s own `CardResponse` type imports `Fact`
directly from `functional-model/synergy.ts`) — no field allowlist/shaping
strips anything. The moment a recognizer sets `triggeredBy` and
synergy.json regenerates, it's served for free. Confirmed live via `curl
.../api/card/fin/1` against a scratch-edited synergy.json (see below) —
the field round-tripped exactly as set.

**UI**: all in `CardDetailTabs.vue`, reusing (not duplicating) the
existing `hoveredFactKeys: string[] | null` ref built for the shared-span
hover fix earlier the same day. Added three new computeds right after
`factRowGroups`:
- `factsByTrigger: Map<string, string[]>` — `triggeredBy` value → every
  currently-VISIBLE (toggle-filtered, via `factRowGroups`, not the raw
  unfiltered `factRows`) fact row's own `key` sharing it. Built off
  `factRowGroups` deliberately — a fact hidden by one of the three
  provenance toggles has no row to highlight, so it must not act as a
  phantom sibling either.
- `triggerOfFactKey: Map<string, string>` — reverse lookup, a visible
  fact's own key back to its one `triggeredBy` value (a fact only ever
  names one trigger).
- `triggerSiblingKeys: Set<string>` (derived FROM `hoveredFactKeys`, not a
  parallel hover-tracking ref) — every other visible key sharing a
  currently-hovered key's own trigger value, unioned across every
  currently-hovered key (so a shared-span pair like Aerith's Dying/Dies,
  where one member also carries `triggeredBy`, correctly pulls in that
  trigger's siblings too, without a special case).
- `isTriggerSibling(key)` helper reads that set; wired into ONLY the Fact
  row's own `:class` (not the non-Fact-span row, which has no `role`/
  `triggeredBy` at all): `isKeyHovered(...) ? 'bg-surface/60' :
  isTriggerSibling(row.key) ? 'bg-fuchsia-400/15' : 'hover:bg-surface/25'`
  — `bg-surface/60` (shade 1, "this is what I'm pointing at" — same class
  the shared-span mechanism already uses) vs. `bg-fuchsia-400/15` (shade
  2, "this is what it's linked to" — fuchsia chosen since grep confirmed
  no existing row/segment background anywhere in either
  CardDetailTabs.vue or FunctionalModelText.vue uses that hue; blue/
  emerald were avoidable on purpose — those already carry real source/
  sink role meaning elsewhere in the same table).
- Deliberately did NOT touch `FunctionalModelText.vue` or the Interactions
  panel (`orderedInteractions`, further down this same file) — task scope
  was explicitly "Facts-tab-list styling only"; the oracle-text panel
  keeps its existing single-shade `isRowHighlighted` behavior unchanged.

**Verified live** (real dev server + Playwright, since 0 real cards carry
`triggeredBy` yet): scratch-edited `functional-model/cards/summon-bahamut/
synergy.json` (backed up first, restored byte-identical after — diffed
the restore against the pre-edit backup to confirm, `grep -c
SCRATCH_TEST` back to 0) to add two independent synthetic trigger groups
onto fin/1's own real Saga facts: group A (`drawCard` + `damage`, distinct
oracle-text spans, no shared-span overlap with each other) and group B
(`putCounter` + a sink `destroy→Battlefield` fact, also distinct spans
from each other, with `putCounter` additionally sharing its own span with
two OTHER untagged facts — `sacrifice`/chapter-III `dies` — to
specifically test that being in the same shared-span trio does NOT
wrongly pull an untagged sibling into the trigger-highlight). Confirmed
via a throwaway Playwright script (deleted after) with both provenance
toggles (`other`/`type-keywords`) enabled to surface every row:
1. Hovering "Card draw" (group A) → itself `bg-surface/60`, "Damage"
   (its one group-A partner) `bg-fuchsia-400/15`, every other row
   (including the group-B pair) plain `hover:bg-surface/25` — clean
   2-member group, clean isolation from group B.
2. Hovering the group-B "Battlefield presence" (sink `destroy` fact) →
   itself `bg-surface/60`, "Counters" (`putCounter`, its one group-B
   partner) `bg-fuchsia-400/15`; "Sacrifice"/chapter-III "Dies" (which
   share `putCounter`'s own annotation span but carry no `triggeredBy`
   themselves) stayed plain, unhighlighted — confirms sibling-highlighting
   keys off the HOVERED fact's own trigger membership, not off whatever
   the eventual sibling's span happens to also overlap.
3. Hovering the OTHER (untagged) "Battlefield presence" row (the plain
   `damage`-adjacent sink fact, no `triggeredBy`) → only itself
   highlighted, nothing else — a fact with no `triggeredBy` participates
   in none of this, confirmed.
4. Zero console/page errors throughout.
`FunctionalModelText.vue` confirmed untouched (`grep fuchsia` — no match)
— the oracle-text panel's own segment highlighting is unaffected by this
feature, as scoped.

Bonus, not something I built: `app/lib/factConditions.ts`'s existing
generic `formatUnknown` fallback (for any fact field this file doesn't
explicitly special-case) already renders a raw `triggeredBy: <value>`
string in the Facts table's own conditions column for free — confirmed
live in the same scratch test, unprompted. Left as-is; no ask to give
`triggeredBy` a dedicated, prettier conditions-column rendering, so didn't
add one.

`vue-tsc --noEmit` clean. Dev server stopped before finishing (confirmed
port 3000 unreachable).

- **Contract gap flagged for orchestrator**: `.claude/contracts/
  card-schema.md` has no `Fact.triggeredBy` entry at all (grepped, zero
  hits) even though the field has existed in `functional-model/synergy.ts`
  since 2026-09-16 and is already engine-emitted by one real recognizer
  (`entersBattlefield-self-trigger-structural.ts`) — flagging rather than
  editing the contract myself (engine-owned field, engine/orchestrator's
  call on wording), but the card-side consumption contract (this UI
  feature) is now real and should be reflected there too.

## Verified-snapshot regression guard (2026-09-16)

Built a hard, physical (deep-equality, never AI/semantic) diff guard so a
later recognizer/definition/annotation change can never silently corrupt
a card a human already confirmed reviewed. Full mechanism written up in
`.claude/contracts/card-schema.md`'s own "Verified-snapshot regression
guard" section — summary here for quick recall:

- Checked the real on-disk shape first rather than assuming: `synergy.json`
  is `{ source: Fact[], sink: Fact[] }`, NOT a flat `facts` array
  (`functional-model/cards/aerith-rescue-mission/synergy.json` is the one
  I read to confirm). `annotatedNonFactSpans` lives on `progress.json`,
  not `synergy.json` — none of the 5 target `review:'human'` cards had one
  populated yet, but the snapshot/diff code handles it either way (absent
  on both sides = no mismatch).
- `server/api/card/review-status.ts` now snapshots
  `cards/<slug>/verified-snapshot.json` (`{capturedAt, facts:{source,sink},
  annotatedNonFactSpans?}`) synchronously, only on a REAL `'ai'`->`'human'`
  transition (read the previous on-disk value before overwriting it — a
  no-op re-POST of an already-`'human'` value does not re-snapshot).
- New `functional-model/scripts/check-verified-regressions.mjs` — plain
  `node`, no TS import, always whole-pool, no slug filter. Exports pure
  `deepEqual`/`diffFactList`/`diffSnapshot` (unit-tested in
  `functional-model/check-verified-regressions.test.ts`, 13 cases) plus an
  fs-orchestrating `checkAllVerifiedSnapshots()`. Index-aligned,
  order-sensitive diff on `source`/`sink`/`annotatedNonFactSpans` arrays
  (a reorder IS a regression per "Facts stay text-ordered," never
  absorbed as a no-op). A mismatch on a card whose `progress.json.review`
  is STILL `'human'` gets flagged `*** SEVERE ***` in the output AND is
  auto-reset back to `'ai'` right there by the script itself — the
  physical backstop for the pre-existing "review resets on change" rule.
  Exit code 1 on any mismatch anywhere in the pool.
- Wired as the last step of `apply-recognizers.mjs`'s own `main()` (`await
  main()` — was fire-and-forget `main();` before, changed to sequence the
  check after it reliably), full pool regardless of what slugs that run
  itself was scoped to.
- Backfilled snapshots for the 5 existing `review:'human'` cards
  (`aerith-rescue-mission`, `dwarven-castle-guard`, `moogles-valor`,
  `the-crystal-s-chosen`, `summon-bahamut`) from their current on-disk
  `synergy.json`/`progress.json` (their current state IS the confirmed
  baseline — none had a snapshot before this).
- Verified end-to-end: pool-wide run is 0 mismatches (as expected — these
  5 cards' content hasn't changed since being reviewed); demonstrated the
  guard actually works by temporarily mutating one real annotation offset
  in `aerith-rescue-mission/synergy.json` (69 -> 68), running the checker
  (correctly printed the SEVERE report with old-vs-new JSON and
  auto-reset that card's `progress.json.review` to `'ai'`, exit code 1),
  then restored both files via `git checkout --` (confirmed byte-identical
  to before, re-ran the checker clean afterward — no real content left
  mutated).
- Documented as a standalone command in
  `functional-model/CARD_RESULTS_QUICKSTART.md` (new "Verified-snapshot
  regression guard" section) alongside the existing 4 verify scripts.
- `npx tsc --noEmit` clean; full `npx vitest run` is 1065 passed / 5
  failed — the 5 failures are pre-existing, unrelated
  `scripts/relations.test.mjs` ENOENTs against missing `tagging/` fixture
  files (historical-sets sweep territory, confirmed unrelated to this
  change, not touched).
- Files touched: `server/api/card/review-status.ts`,
  `functional-model/scripts/check-verified-regressions.mjs` (new),
  `functional-model/check-verified-regressions.test.ts` (new),
  `functional-model/scripts/apply-recognizers.mjs` (one new import + the
  `main();`->`await main();` sequencing change + the new step),
  `functional-model/cards/{aerith-rescue-mission,dwarven-castle-guard,
  moogles-valor,the-crystal-s-chosen,summon-bahamut}/verified-snapshot.json`
  (new), `functional-model/CARD_RESULTS_QUICKSTART.md`,
  `.claude/contracts/card-schema.md`. Nothing under
  `functional-model/recognizers/` touched, per the concurrent
  annotation-span audit sweep's own no-go list.

## Surface verified-snapshot's `capturedAt` next to the Facts confirm button (2026-09-16)

Plumbed `verified-snapshot.json`'s own `capturedAt` (the regression-guard
mechanism above) through to a small display label next to the Facts row's
Confirm/Unconfirm button in `CardDetailTabs.vue` (used by both the full
card page and `CardPeekPanel.vue` — same shared component, confirmed no
separate edit needed there).

- **Server**: `server/api/card/[set]/[number].ts`'s `FunctionalModelData`
  gained `reviewSnapshotAt: string | null` — dev branch reads
  `cards/<slug>/verified-snapshot.json`'s `capturedAt` off disk (`null` on
  ENOENT/malformed, same pattern every other optional-file field here
  uses), production branch reads it off `fmBundle[slug].reviewSnapshotAt`.
  Wired the production side for real (not left as a TODO): added
  `reviewSnapshotAt` to `server/utils/fmBundle.ts`'s `FmBundleEntry` type
  and to `scripts/build-fm-bundle.mjs`'s own per-card object (reads the
  same file, same `null`-on-missing convention). Did NOT re-run `npm run
  sync:fm-bundle` to regenerate the committed `data/functional-model/
  fm-bundle.json` — a concurrent recognizer/annotation sweep has most of
  `functional-model/cards/` mid-flight uncommitted right now, so a full
  regen would sweep all of that into the bundle diff too; left it on the
  existing "stale until manually re-synced + committed" contract that file
  already documents, since prod-bundle staleness isn't this task's concern
  and dev (what I verified against) never reads it anyway.
- **Client type mirror**: `app/lib/cardResponse.ts`'s `CardResponse`
  imports `FunctionalModelData` fields straight off the server file
  already (no separate redeclaration to update) — confirmed via read,
  `reviewSnapshotAt` just flowed through.
- **UI**: `app/components/CardDetailTabs.vue`, inside the existing
  review-status table's Facts row only (the one field tied to
  `field:'review'`, the only one review-status.ts snapshots) — added a
  `<span>` right after the `ReviewStatusBadge` button, same `<td>`. New
  computeds: `factsSnapshotAt` (raw ISO string off `props.data`, no local
  ref — read-only, never touched by `toggleReviewStatus`'s own optimistic
  flip), `factsSnapshotDate` (parsed `Date`, `null` on parse failure),
  `factsSnapshotLabel` (RELATIVE — "2 hours ago"/"3 days ago"/"just now" —
  own small `formatRelativeTime()` helper via `Intl.RelativeTimeFormat`,
  largest-unit-first walk over year/month/day/hour/minute; grepped first,
  confirmed zero existing relative- or absolute-date-formatting
  convention anywhere in `app/`, so this is a new small local helper, not
  a mismatch against something already established), `factsSnapshotAbsoluteLabel`
  (full `Intl.DateTimeFormat` medium-date + short-time, e.g. "Sep 16,
  2026, 10:05 PM" — shown only in the `title` hover attribute, not the
  always-visible label — this direction came from an explicit
  orchestrator-relayed user correction partway through the task; first
  pass had shipped an absolute-only label and was corrected before
  reporting done), `factsSnapshotRegressed` (`true` when a snapshot exists
  AND current `factsReviewStatus !== 'human'` — i.e.
  check-verified-regressions.mjs's own auto-reset already fired since this
  card was last confirmed), `factsSnapshotTitle` (absolute label, plus a
  "— facts changed since this snapshot" suffix when regressed).
  Regressed case renders in `text-warn` (same hue the Draft
  pill/Confirm-button warn tint elsewhere in this file already uses —
  deliberately not a new color) vs. plain `text-muted` otherwise; absent
  entirely (`v-if="factsSnapshotLabel"`) when there's no snapshot at all.
- **Verified live**, twice (once absolute-only per the original task
  wording, again after the relative-time correction) against the real dev
  server + Playwright: `curl /api/card/fin/5` (Aerith Rescue Mission,
  `review:'human'`) returned `reviewSnapshotAt` non-null; rendered DOM
  showed "Snapshotted 15 minutes ago" in muted gray, `title` = "Sep 16,
  2026, 10:05 PM". `fin/2` (Ultima, Origin of Oblivion) turned out to be a
  REAL, already-on-disk instance of the regressed case (not a synthetic
  test I built) — its `progress.json.review` is currently `'ai'` after a
  genuine 2026-09-16 annotation-span fix reset it, but
  `verified-snapshot.json` still exists from before that reset — rendered
  as "Snapshotted 7 minutes ago" in `text-warn`, `title` ending in "—
  facts changed since this snapshot". `fin/4` (Aerith Gainsborough, never
  reviewed, no snapshot file) rendered nothing next to its Confirm button.
  Zero console errors. `npx tsc --noEmit` clean.
- Noted in passing: as of this task, 7 cards now have a
  `verified-snapshot.json` (the original 5 plus `adelbert-steiner` and
  `ultima-origin-of-oblivion`, both from concurrent work elsewhere this
  same day) — not something I created, just what I found live when
  picking real cards to verify against.
- Files touched: `server/api/card/[set]/[number].ts`,
  `server/utils/fmBundle.ts`, `scripts/build-fm-bundle.mjs`,
  `app/components/CardDetailTabs.vue`. `app/lib/cardResponse.ts` read but
  not edited (passthrough already generic). No contract file gap found
  this time — `reviewSnapshotAt` is a small additive field on an
  already-documented mechanism, didn't seem worth a dedicated
  card-schema.md edit for; flag if the orchestrator disagrees.

## Cheap cross-component review-status live update (status grid square + confirm button) (2026-09-16)

Task: when a human confirms/un-confirms a card's FACTS review (the Confirm/
Unconfirm button in `CardDetailTabs.vue`, `POST /api/card/review-status`
with `field:'review'`), two things should update immediately without a
store rework or re-fetch — the button itself (already true, verified) and
the card's own colored square on `app/pages/app/status/index.vue`'s status
grid, if that page happens to be mounted concurrently in the same tab
(e.g. its own `CardPeekPanel` open on that same card).

- **New composable**: `app/composables/useReviewStatusBus.ts` — a plain
  module-scoped `Set<Listener>` (no `mitt` dependency added; grepped
  `app/composables/` first per convention-check, only `useGraphStore.ts`/
  `useSetOrder.ts` existed, neither an event-bus pattern, so this is a new
  tiny one). `emitReviewStatusChanged({set, number, review})` /
  `onReviewStatusChanged(listener) -> unsubscribe`. Deliberately keyed by
  **set+number**, not slug — the generated `CardStatusEntry` shape
  (`fin_card_status.json`, mirrored in both `app/lib/cardStatus.ts` and
  this page's own duplicate type) has no slug field to match against, only
  `number` (within one set's own file) — set+number is the natural shared
  key both sides already have (`props.set`/`props.number` in
  `CardDetailTabs.vue`; `SET` constant + `entry.number` in the status
  page), so I deviated from the task's suggested `slug`-keyed signature for
  this reason rather than inventing a slug-matching step neither side
  actually needs.
- **Emit point**: `CardDetailTabs.vue`'s `toggleReviewStatus`, only for
  `field === 'review'` (the only field that feeds the status grid's
  green/verified narrowing — `scenariosReview`/`interactionsReview` don't
  affect any square's color), right after the existing optimistic-flip +
  POST-reconcile block, using the POST response's own `body.review` (the
  endpoint's response shape is `{ review: 'ai' | 'human' }` — confirmed by
  reading `server/api/card/review-status.ts`, no `reviewSnapshotAt` echoed
  back by this endpoint, but the status grid doesn't need that field at
  all so this was moot here).
- **Status grid**: `app/pages/app/status/index.vue` subscribes
  `onMounted`/unsubscribes `onUnmounted` (new pair, alongside its existing
  keydown-nav mount hooks). New `statusOverrides` ref
  (`Record<number, CardStatusEntry>`), merged into `sortedCards` ahead of
  the sort (`statusFile.value.cards.map((e) => overrides[e.number] ?? e)`).
  `applyReviewStatusChange` applies ONLY the green<->verified narrowing
  (per the task's own explicit safety rule: never invent a downgrade to
  yellow/orange/red/gray locally) — `review:'human'` + current effective
  status `'green'` -> `'verified'`; `review:'ai'` + current effective
  status `'verified'` -> `'green'`; anything else is a no-op (status isn't
  green/verified, or the direction doesn't match). Also mirrors
  `functional-model/card-status.ts`'s own exact `reasons` text convention
  for the narrowing (`${reason}; human-reviewed` appended/stripped) so the
  hover tooltip stays consistent with the square's new color, not just the
  color itself — this is a direct, deterministic mirror of a fixed suffix
  the real classifier already uses (read its source first), not a guess.
- **Verified live** via a throwaway Playwright script (deleted after) run
  against `functional-model/cards/aerith-gainsborough/progress.json`
  (`review:'ai'`, status `green` in the real generated
  `data/fin/fin_card_status.json` at the time): loaded `/app/status`,
  clicked its square to open the peek panel (same page instance stays
  mounted — `store.openCardPanel` is a query-param change, not a route
  nav), clicked Confirm — POST returned `{review:'human'}`, button flipped
  to "Unconfirm" immediately, and in the SAME tab (no reload) the square's
  computed background color changed `rgb(34,197,94)` (green) ->
  `rgb(132,204,22)` (verified) with the aria-label gaining the
  `; human-reviewed` suffix. Clicked Unconfirm next — POST returned
  `{review:'ai'}`, square reverted to green, suffix removed. Ran the full
  round-trip twice (once split across two separate script runs to confirm
  a fresh page load reverts to the server's real static-file truth with no
  stale override leaking across reloads, once as a single continuous
  green->verified->green pass in one tab) — both matched expectations
  exactly. Cross-tab sync was NOT tested and is explicitly out of scope —
  this bus is same-tab/same-JS-realm only, by design (no persistence, no
  BroadcastChannel); a second browser tab or a real page reload always
  falls back to the server's authoritative generated file, same "purely a
  visual nicety" framing the task itself specified. Cleaned up all test
  side effects afterward: reverted `progress.json`'s
  `reviewedAt`-bump-only diffs via `git checkout --`, deleted the stray
  `verified-snapshot.json` the regression-guard mechanism wrote during
  testing (not part of this change, would've been confusing test noise
  left in a real card's directory).
- `npx tsc --noEmit` clean.
- Files touched: `app/composables/useReviewStatusBus.ts` (new),
  `app/components/CardDetailTabs.vue`, `app/pages/app/status/index.vue`.
  No contract file gap found — this is a pure UI-layer mechanism, doesn't
  touch the card-schema/state-event-format/api-contract boundaries at all.

## Card page: live per-request `cardStatus`, not the stale batch file (2026-09-16)

Confirmed real bug: the card page's status badge read `data/fin/
fin_card_status.json` (`app/lib/cardStatus.ts`'s `getCardStatusEntry`) —
only refreshed by manually running `npm run card-status`, so a
just-confirmed review didn't show "Verified" until that script was rerun.
Ported `functional-model/scripts/compute-card-status.mjs`'s own per-card
recipe (dynamic-import `definition.ts`, read `synergy.json`, resolve real
oracle text, `computeTextCoverage`, read `progress.json`'s `review` +
`annotatedNonFactSpans`, `classifyCardStatus`) into a LIVE per-request path.

- **First attempt failed at runtime, not at typecheck**: statically
  `import`ing `computeTextCoverage` from `functional-model/scripts/
  text-coverage.mjs` straight into the server route (a plain, pure, fs-free
  function) passed `npx tsc --noEmit` clean but broke Nitro's actual dev
  server: `Cannot find module '/functional-model/scripts/text-coverage.mjs'
  imported from .../.nuxt/dev/index.mjs` — a `.mjs` sibling of an
  already-dynamically-imported `.ts` file isn't traced/rewritten by Nitro's
  dev bundler the same way this route's other `.ts` imports are. This is
  the SAME class of problem `computeTracesLive`'s own doc comment already
  documents for why it spawns `run-one-card.mjs` under vite-node instead of
  a plain in-process dynamic import — I didn't connect that precedent until
  hitting the failure live. **Lesson for next time in this file: don't
  trust `tsc --noEmit` alone to validate a new import path here — always
  hit the real dev server too**, this route in particular has known,
  confirmed-the-hard-way gaps between what typechecks and what Nitro can
  actually bundle/resolve at request time.
- Fixed by adding a new sibling script, `functional-model/scripts/
  compute-one-card-status.mjs` (modeled directly on `run-one-card.mjs`),
  spawned via the same `execFileAsync(vite-node, [...])` pattern as
  `computeTracesLive` — new `computeCardStatusLive(slug, number)`. Runs the
  exact compute-card-status.mjs recipe for one slug, prints the resulting
  `CardStatusEntry` JSON to stdout, `null`/gray-bucket-friendly on any
  missing piece.
- `FunctionalModelData` (`server/api/card/[set]/[number].ts`) gained
  `cardStatus: CardStatusEntry | null`. **Dev branch**: spawns the new
  script (live, every request, no caching beyond the route's own existing
  per-slug signature cache). **Production branch**: reads
  `entry.cardStatus ?? null` off `fmBundle` — added to `FmBundleEntry`
  (`server/utils/fmBundle.ts`) and computed at BUILD time by
  `scripts/build-fm-bundle.mjs` (added a one-time `loadOracleTextByName`
  scan + per-card `computeTextCoverage`/`classifyCardStatus`, reusing the
  same already-imported full `CardDefinition` `poolFacts` is built from —
  needs the REAL `effects`/`triggers`/`abilities`, not the stripped-down
  `poolFacts` subset this bundle otherwise ships, for the `red`-bucket
  `collectEffects` walk). Did NOT rerun `npm run sync:fm-bundle` (same call
  as the `reviewSnapshotAt` task before this one — a large concurrent
  recognizer/annotation sweep has ~980 files mid-flight uncommitted right
  now; a full bundle regen would sweep all of that into one unrelated
  diff). Prod therefore serves `cardStatus: null` until that's manually
  re-run + committed — same staleness contract every other optional bundle
  field already carries; dev (what the user is actually working against)
  is unaffected, always live.
- Refactored `loadContinuousKeywordGrantsDev` into `loadCardDefinitionDev`
  (returns the full `CardDefinition`) + a separate
  `continuousKeywordGrantsFromDefinition` — one dynamic import per request
  reused for both continuousKeywordGrants (pre-existing) and the new
  `cardStatus` computation's `number`/`name`/`review` inputs
  (`compute-one-card-status.mjs` does its OWN separate dynamic import
  inside its own vite-node subprocess, since that recipe needs to run
  isolated from Nitro anyway — the reuse is at the "one code path, one
  concept" level, not literally one shared JS object across process
  boundaries).
- `app/lib/cardResponse.ts` gained `cardStatus` (typed off the real
  `functional-model/card-status.ts`'s `CardStatusEntry`, not a duplicate —
  this file already imports `Fact`/`TraceResult`/`Scenario` types the same
  way, so this doesn't cross any card-agent/engine-agent boundary that file
  didn't already cross). Also fixed a found-in-passing pre-existing gap in
  the same interface: `reviewSnapshotAt` was already being read off
  `props.data.functionalModel` by `CardDetailTabs.vue` but was never
  declared on this hand-mirrored type at all (silently not caught by
  `tsc --noEmit` — see this file's own note above about that check's real
  limits on this codebase's `.vue` files).
- `app/components/CardDetailTabs.vue`: `cardStatus` computed now reads
  `props.data.functionalModel?.cardStatus ?? null` instead of
  `getCardStatusEntry(props.set, props.number)`; removed that import.
  `CARD_STATUS_META` import kept (still the shared color/label table).
  `getCardStatusEntry` itself (`app/lib/cardStatus.ts`) is now unreferenced
  anywhere in the app (confirmed via grep — `/app/status`'s own grid page
  has its own separate inline `STATUS_FILES`/static import, never called
  through that function) — left it in place rather than deleting, since
  removing it wasn't asked for and it's a small, harmless, still-correct
  export; flagging here in case the orchestrator wants it cleaned up later.
- **Verified live** against the real dev server (not just curl-shaped
  trust in the code): `curl /api/card/fin/3` (Adelbert Steiner,
  `progress.json.review:'human'`) returned `cardStatus.status:'verified'`
  with NO `npm run card-status` rerun. Regression-proved this is genuinely
  live, not coincidentally matching the batch file (which already happened
  to say `verified` too, from earlier unrelated testing that same day):
  temporarily flipped this card's own `progress.json.review` to `'ai'`
  in-place, re-curled — got `status:'green'` back instantly, while
  `data/fin/fin_card_status.json` still said `verified` throughout —
  proves the live path is real and independent of the batch file. Restored
  the file byte-for-byte after (diffed against a pre-test backup to
  confirm, not just visual inspection). Sanity-checked a non-verified card
  too: fin/4 (Aerith Gainsborough, `review:'ai'`) — live and batch both
  agree on `green`, same reasons string, same %.
- `npx tsc --noEmit` clean; `npx vitest run functional-model/
  text-coverage.test.ts functional-model/synergy.test.ts` both pass
  (83 passed, 5 pre-existing skips, unrelated).
- Files touched: `server/api/card/[set]/[number].ts`,
  `server/utils/fmBundle.ts`, `scripts/build-fm-bundle.mjs`,
  `app/lib/cardResponse.ts`, `app/components/CardDetailTabs.vue`,
  `functional-model/scripts/compute-one-card-status.mjs` (new). No
  contract-file gap found/flagged this time — `cardStatus` is a small
  additive field on an already-documented mechanism (mirrors the
  `reviewSnapshotAt` precedent), and the `.mjs`-import-vs-Nitro-bundler
  gotcha above is route-internal plumbing, not a card-schema/
  state-event-format/api-contract boundary question.

## `/app/status` grid: live per-request status for ALL cards, not the stale batch file (2026-09-16)

Same-day follow-up to the single-card `cardStatus` fix directly above —
the GRID page (`app/pages/app/status/index.vue`) had the identical bug:
it statically `import`ed the generated `data/fin/fin_card_status.json`
straight into the client bundle, so 3 real user-reported cases (fin/1,
fin/2, fin/3 review confirmations) didn't show as "Verified" until someone
manually reran `npm run card-status`.

- **Measured first, decided second, per the task's own instruction**:
  `time npx vite-node functional-model/scripts/compute-card-status.mjs`
  (the existing whole-pool batch script, unmodified at measurement time) —
  ~1.2-1.3s wall-clock for the full 306-card FIN pool, repeatable across
  runs. That's the SAME cost shape a live per-request recompute would have
  (one process, one dynamic-import loop over every card dir) — comfortably
  inside the task's own "sub-1-2s is fine" bar. Decided: **live every
  load, no on-disk caching layer** — same "no manual regen ever needed"
  story as the single-card path, no `?refresh=1` fallback needed. Did NOT
  test the "spawn one subprocess per card" shape (~300 separate vite-node
  cold starts) — that would obviously be far slower (vite-node's own
  startup dominates at that granularity) and was never the right design
  once `compute-card-status.mjs` already proved one-process-for-the-whole-
  pool is fast; going in circles to re-confirm the obviously-bad shape
  didn't seem worth the extra wall-clock.
- **Refactor** (per the task's explicit ask to share logic instead of
  triplicating the recipe): extracted `compute-card-status.mjs`'s own
  pool-wide loop (dynamic-import every `definition.ts`, build the real
  name->slug map, read each `synergy.json`/`progress.json`, resolve oracle
  text, `computeTextCoverage`, `classifyCardStatus`) into a new shared
  module, `functional-model/scripts/card-status-batch.mjs`, exporting
  `computeAllCardStatuses(setSlug)`. Two thin callers now import it:
  `compute-card-status.mjs` (unchanged CLI behavior — writes `data/fin/
  fin_card_status.json`, still `npm run card-status`) and a new
  `functional-model/scripts/compute-all-card-status.mjs` (prints the same
  `{generatedAt, set, cards}` payload as JSON to stdout instead of writing
  a file — this is what the new server route spawns). **Deliberately did
  NOT** also fold `compute-one-card-status.mjs` (the single-card variant
  from the earlier fix) into this same shared core — its own per-card body
  looks similar but is a genuinely different, smaller shape (no pool-wide
  name->slug scan/dynamic-import of every OTHER card's definition.ts, no
  tally) and forcing it through `computeAllCardStatuses` would mean paying
  the full pool-scan cost just to serve one card — explained in that file's
  own header comment as an intentional, judged non-unification rather than
  something left inconsistent by oversight.
- **New route**: `server/api/card-status/[set].get.ts` (GET, `.get.ts`
  suffix per the `docs`/`keywords`/`recognizers` route-family convention —
  first genuinely GET-only route this task touched, unlike `card/[set]/
  [number].ts`'s own GET-or-POST). **Dev**: spawns `compute-all-card-
  status.mjs` under vite-node once per request (same `execFileAsync`
  pattern `computeTracesLive`/`computeCardStatusLive` already use in the
  single-card route, same reason — a `.mjs` sibling import breaks Nitro's
  dev bundler in-process, confirmed the hard way on the earlier task, not
  re-tested here since the earlier finding already generalizes). **Prod**:
  a plain static `import` of `data/fin/fin_card_status.json` (NOT
  `readFileSync` — that fails in a Netlify Function, the raw repo tree
  isn't shipped, only what's statically imported/bundled — same distinction
  `loadJsonFresh`'s own comment in `card/[set]/[number].ts` already makes),
  keyed by `:set` the same "static import per known set" way the page's
  own retired `STATUS_FILES` map used to be keyed.
- **Page** (`app/pages/app/status/index.vue`): dropped the static
  `cardStatusFin` import + `STATUS_FILES` map entirely; now `useFetch<CardStatusFile>('/api/card-status/fin')`
  (same convention the card detail page already uses for its own
  server-backed load, not the plain `fetch()` the review-status POST call
  uses — this is a GET-on-mount load, matches that precedent instead).
  `statusFile` is nullable now everywhere it's read (`sortedCards`,
  `applyReviewStatusChange`, the header's set/generatedAt display) — a
  brief loading state renders before the first response lands, plus an
  error message on failure; the one-time same-tab optimistic overlay
  mechanism (`useReviewStatusBus.ts`) is unchanged, still layers on top of
  whatever `statusFile` says. Copy also corrected in passing: previously the
  header always said "Generated ...; regenerate via npm run card-status"
  even when the content came from a live recompute — now conditionally
  reflects "recomputed live in dev / last-committed snapshot in prod."
- **Verified live**, both via curl and a real Playwright load (dev server
  already running on :3000 from a concurrent session, reused rather than
  fighting Nuxt's own dev-lock): `curl /api/card-status/fin` took ~1.17s,
  returned fin/1/2/3 all `verified` (matching their real `progress.json`
  `review:'human'`) with NO `npm run card-status` rerun since a prior,
  unrelated edit to that file. Regression-proved genuinely live (not
  coincidentally matching a stale batch file) the same way the single-card
  fix did: flipped `adelbert-steiner/progress.json`'s `review` to `'ai'`
  in-place, re-curled — #3 flipped to `green` instantly; restored the file
  byte-for-byte after (diffed to confirm — this file was ALREADY mid-edit
  by a concurrent session before this task started, per the git-status
  snapshot at conversation start, so "restore" here means back to that
  pre-existing dirty state, not to a clean HEAD checkout; confirmed via
  `git diff` that the only remaining diff matches what was already there).
  Playwright load of `/app/status` (no `npm run card-status` run at any
  point during this task): page ready (grid rendered, panel fetch settled)
  in ~3.4s including full Nuxt SPA boot + navigation; card #3's square
  showed `aria-label` ending "Verified: ...; human-reviewed", zero console
  errors. Did not additionally verify fin/1 or fin/2's own regression case
  by hand (both share the exact same code path proven correct by fin/3 and
  were separately confirmed already-`verified` in the curl output above —
  re-deriving the identical mechanism a second/third time by hand wasn't
  judged to add real confidence over what the code path itself guarantees).
- `npx tsc --noEmit` clean; `npx vitest run functional-model/
  card-status.test.ts` (22 passed, pre-existing suite, untouched by this
  refactor's actual logic — same computation, different call sites).
- Files touched/added: `functional-model/scripts/card-status-batch.mjs`
  (new, shared core), `functional-model/scripts/compute-all-card-status.mjs`
  (new), `functional-model/scripts/compute-card-status.mjs` (thinned to a
  wrapper), `server/api/card-status/[set].get.ts` (new),
  `app/pages/app/status/index.vue`. Did NOT touch
  `compute-one-card-status.mjs` (see above) or any
  `functional-model/recognizers/*.ts` (out of scope per this task's own
  constraint). `data/fin/fin_card_status.json` kept — still the real prod
  fallback source AND `npm run card-status`'s own output — not removed;
  its only other consumer, `app/lib/cardStatus.ts`'s `getCardStatusEntry`,
  was already flagged unreferenced-anywhere in the entry above this one and
  remains so, still not deleted (out of scope for this task too). No
  contract-file gap found — this route's shape is internal to the card
  agent's own domain (a derived-status dashboard endpoint), doesn't touch
  card-schema/state-event-format/api-contract's documented boundaries.

## 2026-09-17, add 7th `'uncertain'` status bucket (UI side, same pattern as the `'verified'` 6th bucket)

Direct repeat of the 2026-09-16 `'verified'`-bucket task above — same 2
files, same "duplicated literal union, not imported" convention, ~15min.
Sibling `engine` task (parallel, landed by the time this task reached
live-verification) widened `functional-model/card-status.ts`'s
`CardStatusBucket`/`classifyCardStatus` to 7 values and added
`progress.json.reviewCaveat?: string` — a human-authored note for "facts
are as complete as they can be, but here's a specific known conceptual
modeling gap." Motivating card: Cloud, Midgar Mercenary (fin/10) — its
trigger-doubling static is fully fact-covered (both precondition sink facts
real/recognizer-derived, 100% text coverage) but the DOUBLING EFFECT itself
has no synergy-graph relation category to land on (no generic "has/grants a
triggered ability" Fact shape exists yet), so it's flagged `uncertain`
instead of reading as a clean green/verified.

- Widened both literal-copy unions: `app/lib/cardStatus.ts`
  (`CardStatusBucket` + `CARD_STATUS_META`) and `app/pages/app/status/
  index.vue` (`CardStatusBucket` + `STATUS_META` + `STATUS_ORDER`), same
  header-comment "N colors" bookkeeping bumped 6->7 in both. Color
  `#3b82f6` (blue), label "Uncertain". **Position**: right after `verified`,
  before `green`, in both `STATUS_ORDER` and `CARD_STATUS_META`'s own key
  order — per the task's own reasoning (a human already looked at this
  card, same tier as `verified`, just with a caveat instead of a clean
  pass), not re-litigated, just applied. Status grid's own swatch-legend
  description: "Facts are as complete as they can be right now, but a human
  has flagged a specific known conceptual modeling gap — see the card's own
  caveat note."
- **`CardDetailTabs.vue`'s badge needed NO change to its lookup mechanism**
  (`CARD_STATUS_META[cardStatus.status]` already indexes generically, same
  as the `'verified'` precedent already established) — only refactored its
  inline `:title` into a named `cardStatusTitle` computed, no behavior
  change beyond that extraction.
- **Real finding, changed my own approach mid-task**: initially assumed
  (per the dispatch's own framing) that `reviewCaveat` would thread through
  as its OWN separate field on the API's `cardStatus`/`CardStatusEntry`
  object, and wrote speculative code in both `CardDetailTabs.vue` and the
  status grid page to read `entry.reviewCaveat` defensively (a permissive
  inline cast, since the imported `CardStatusEntry` type didn't have the
  field yet at edit time) and surface it in the title/aria-label/tooltip.
  Once the engine lane actually landed, checked the real
  `functional-model/card-status.ts` source directly rather than trusting
  the assumption: `classifyCardStatus` does NOT expose `reviewCaveat` as
  its own output field at all — `CardStatusEntry`'s shape stays `{number,
  name, status, reasons}` (no new field), and the classifier instead folds
  a **truncated-to-200-characters** copy of the trimmed caveat straight
  into `reasons` itself (`"...; flagged with a known caveat: <text>…"`)
  when it assigns `uncertain`. Confirmed via a real `compute-one-card-
  status.mjs cloud-midgar-mercenary 10` run and a live `curl localhost:3000
  /api/card/fin/10` — both show the caveat text living inside `reasons[0]`,
  no sibling field. **Reverted** the speculative separate-field code in
  both files back to plain `reasons.join(' ')` consumption (which already
  fully surfaces the caveat, truncated, with zero extra plumbing needed) —
  left a comment in both files pointing at this real, checked shape instead
  of the assumption, so a future reader doesn't have to re-discover this.
  This is the kind of thing worth flagging rather than silently guessing:
  the dispatch's phrasing ("if the API response includes it — check what
  field the engine lane threads it through as") anticipated exactly this
  uncertainty and I did check, the real answer was just "no separate field,
  it's inline text."
- Confirmed (per the dispatch's own explicit ask) both live per-request
  routes need zero code change: `server/api/card/[set]/[number].ts`'s
  `computeCardStatusLive` and `server/api/card-status/[set].get.ts`'s
  `computeAllCardStatusLive` both just spawn the engine's own scripts and
  `JSON.parse(stdout)` the result generically, no hardcoded bucket list
  anywhere in either file — read both directly to confirm rather than
  assuming, per this project's "complete before review" convention.
- **Live-verified end to end**, dev server already running on :3000
  (reused, not restarted): `npx vite-node functional-model/scripts/
  compute-one-card-status.mjs cloud-midgar-mercenary 10` ->
  `status:"uncertain"`; `curl /api/card/fin/10` -> same, `cardStatus`
  field present with the caveat text inline in `reasons[0]`; `curl
  /api/card-status/fin` -> pool tally `{orange:194, green:64, red:26,
  yellow:14, verified:4, gray:3, uncertain:1}` (Cloud is the sole
  `uncertain` card, as expected) — same route also confirmed generically
  passing the bucket through with no hardcoded list. Both `/app/card/fin/10`
  and `/app/status` return 200. `data/fin/fin_card_status.json` was already
  regenerated (untracked, presumably by the engine lane's own batch run)
  and already contains the one real `uncertain` entry — did not regenerate
  it myself, not this task's file to touch/commit.
- `npx tsc --noEmit` clean, both before AND after the reviewCaveat-field
  revert above (checked at each step, not just at the end).
- Files touched: `app/lib/cardStatus.ts`, `app/pages/app/status/index.vue`,
  `app/components/CardDetailTabs.vue`. Did not touch
  `functional-model/card-status.ts`, any `compute-*-card-status.mjs`
  script, or `cloud-midgar-mercenary/progress.json` — all sibling-engine-
  owned per this task's own constraint, confirmed untouched via `git
  status` at the end.
- **Contract flag**: `.claude/contracts/card-schema.md`'s "Per-card
  dashboard status" section (~line 1039-1040) still literally documents the
  bucket enum as the 6-value `'verified'|'green'|'yellow'|'orange'|'red'|
  'gray'` (stale again, same spot the `'verified'`-bucket task flagged
  before — that flag was apparently not yet applied) — now needs BOTH the
  `'uncertain'` 7th value added AND, worth adding while there, a short note
  on the real `reviewCaveat` plumbing this task discovered: it lives only
  in `progress.json` + `ClassifyCardStatusInput`, never as its own field on
  the generated `CardStatusEntry`/`fin_card_status.json` output — folded
  into `reasons` (truncated 200 chars) instead. Flagging for the
  orchestrator to update rather than editing the contract file myself.

## `re-review` 8th bucket wired (2026-09-17)

Third bucket added via the exact same 3-file recipe `verified` and
`uncertain` already established — `re-review` (color `#7dd3fc`, label
"Re-review"), meaning "was human-confirmed before (real
`verified-snapshot.json` existed), real content has since drifted, the old
confirmation is now stale." Engine lane (`functional-model/card-status.ts`,
`review: 'regression'`, `check-verified-regressions.mjs`) had already
landed; this task was purely the UI-side widening + 2 stale-comment
cleanups.

- `app/lib/cardStatus.ts`: `CardStatusBucket` widened to the real 8-way
  union, `CARD_STATUS_META['re-review']` added.
- `app/pages/app/status/index.vue`: same widening of its own local
  `CardStatusBucket`/`STATUS_META`/`STATUS_ORDER`, plus its stale header
  doc-comment (still said "6-bucket," predating even `uncertain`) fixed to
  8-bucket while touching the file anyway.
  - **Position chosen: `verified > uncertain > re-review > green`** (not
    `re-review` directly after `uncertain`-before-`green` in the other
    order) — reasoning: `uncertain`'s caveat is a CURRENTLY-accurate human
    signal about this exact content (nothing else is claimed wrong), while
    `re-review` means a PAST human confirmation has been invalidated by
    detected drift — the confirmation itself is now untrustworthy, which
    makes it the less-trustworthy of the two "narrows an otherwise-green
    outcome" tiers, even though both still clearly outrank a plain
    never-reviewed `green`. Documented inline as a comment above
    `STATUS_ORDER` so a future reader doesn't have to re-derive this.
  - Also widened `applyReviewStatusChange`'s optimistic-update branch: a
    live Confirm (`change.review === 'human'`) on a `re-review` card now
    also upgrades the local override to `verified`, not just a plain
    `green` card — per the contract's own "a fresh human confirm on a
    `re-review`/`regression` card transitions it straight back to
    `verified`/`'human'`" rule. `re-review` itself is never applied
    optimistically here (only ever written server-side by
    `check-verified-regressions.mjs`), only consumed as an upgrade source.
- `CardDetailTabs.vue`: confirmed (read the file directly, didn't assume)
  its badge already indexes `CARD_STATUS_META[cardStatus.status]`
  generically — zero code change needed, same precedent both prior buckets
  established.
- **3 stale "6-bucket" comments fixed** (flagged by the engine agent as
  card-owned, comment-text-only, no logic change):
  `scripts/AI_FACT_ELIMINATION_PROCESS.md` (2 spots), `server/api/
  card-status/[set].get.ts`, `server/api/card/[set]/[number].ts` — all now
  say "8-bucket" and list the real 8 names.
- **Live-verified with Playwright** (dev server already running on :3000,
  reused): `/app/status` grid — legend swatch for "Re-review" computes to
  `rgb(125, 211, 252)` (= `#7dd3fc`, exact match); all 3 real `re-review`
  cards (`Aerith Rescue Mission` #5, `Dwarven Castle Guard` #18, `Moogles'
  Valor` #27) render that same swatch color with a correct aria-label
  ("... — Re-review: ..."). `/app/card/fin/5` — the `CardDetailTabs.vue`
  status badge (a `<span>`) computes to the same `rgb(125, 211, 252)` with
  `title="Re-review: 4 fact(s), ..."`. Also confirmed via direct `curl`:
  `/api/card/fin/5`'s `functionalModel.cardStatus.status` and
  `/api/card-status/fin`'s per-entry `status` both read `"re-review"` for
  all 3 real cards, matching `data/fin/fin_card_status.json` directly.
  `npx tsc --noEmit` clean before and after.
- Did not touch `functional-model/*` or `functional-model/recognizers/*`
  (both explicitly out of scope this task — engine-owned/a separate task's
  own live area).
- **Contract flag from the prior (`uncertain`) task's own entry, above, is
  now resolved** — `.claude/contracts/card-schema.md`'s "Per-card dashboard
  status" section already documents the full 8-value enum plus both the
  `uncertain` and `re-review` narrowing sections in real detail by the time
  this task started; no further contract edit was needed.

## "Confirm (Uncertain)" real UI action — full snapshot/regression-guard parity with a plain verified confirm (2026-09-17)

Task: `reviewCaveat` was only hand/agent-authored directly into
`progress.json` (built earlier the same day, see the `uncertain`-bucket
entry above) — no UI control existed, and it never touched the
verified-snapshot regression guard. User's explicit ask: "Uncertain should
be handled the same as reviewed for all intents and purposes... Also need a
button near confirm for facts for this 'Uncertain confirm'." Full writeup
of the design now lives in `.claude/contracts/card-schema.md`'s own new
"'Confirm (Uncertain)' real UI action" section — this entry is the
narrative/process record, that file has the authoritative shape.

- **Ground-truthed `server/api/card/review-status.ts` FIRST**, per the
  dispatch's own explicit instruction (two conflicting secondhand
  descriptions were floating around) — the real code snapshots ONLY on
  `previousFieldValue !== 'human'` (a genuine ai/regression→human
  transition), never on re-confirming an already-`'human'` card. Confirmed
  by reading the literal condition, not trusting either prior description.
- **Endpoint widened**: request body gains optional `reviewCaveat?: string`
  (only meaningful for `field:'review'`+`reviewed:true`); non-empty writes
  it, omitted/empty on a plain confirm CLEARS a pre-existing one. Checked
  this against both real consumers (`functional-model/card-status.ts`'s
  `classifyCardStatus`, `functional-model/scripts/
  check-verified-regressions.mjs`) before deciding it was safe — neither
  ever writes or diffs `reviewCaveat`, so clearing it has zero knock-on
  effect on the regression guard. Response body now also echoes
  `reviewCaveat` (`null` when absent) for the UI to reconcile/pre-fill from.
- **Snapshot condition widened**: now also fires when `reviewCaveat` itself
  changes (added/edited/cleared) even when `review` was already `'human'`
  going in — an "Uncertain confirm" on an already-verified card, or a plain
  confirm clearing a stale caveat off an already-uncertain one, re-baselines
  the snapshot exactly like a fresh transition does. A true no-op re-POST
  (same reviewed value, same caveat text) still correctly skips it.
- **New `FunctionalModelData.reviewCaveat: string | null`** served on both
  the dev-live and production (`fmBundle.ts`) branches of `server/api/card/
  [set]/[number].ts`.
- **Real, pre-existing bug found and fixed, not part of this task's own
  ask**: `scripts/build-fm-bundle.mjs`'s own `classifyCardStatus` call never
  threaded `reviewCaveat` through at all (only `review`) — the production
  bundle path could NEVER classify a card `uncertain`, only the dev-live and
  pool-batch paths could. Fixed (read + threaded + carried on
  `FmBundleEntry.reviewCaveat?: string`). **Did NOT regenerate
  `data/functional-model/fm-bundle.json` itself** — the repo had substantial
  unrelated, currently in-flight uncommitted card edits from concurrent
  sessions at the time (confirmed via `git status` at task start), and
  regenerating now would bake all of that into one commit; left for a
  future normal "regenerate, commit" pass. Confirmed the bundle JSON file
  itself was clean (not concurrently dirty) before deciding this, so this
  gap is isolated to the two source files, not spread further.
- **UI, `CardDetailTabs.vue`**: third button "Confirm (Uncertain)" next to
  Confirm/Unconfirm — always a forced confirm (never a toggle, even when
  already `'human'`), `window.prompt()` pre-filled with the current caveat,
  cancel does nothing, a real-but-blank submission is treated as a plain
  confirm (explicit design decision, not left ambiguous). New
  `factsReviewCaveat` ref (same "independently reactive, not read off
  `props.data` directly" pattern `factsReviewStatus` already established,
  for the same in-place-mutation-doesn't-invalidate-computed reason).
  - **Did NOT widen `ReviewStatusBadge`** — its `ReviewStatus` vocabulary is
    shared with the unrelated keywords page; adding a 3rd value there would
    ripple into an unrelated consumer for a card-page-only concern.
  - **3-way visual state reuses EXISTING machinery instead**: the
    fact-authoring-status square already next to the Facts tab label
    (`cardStatus`/`CARD_STATUS_META`) already visually distinguishes
    `uncertain` (blue `#3b82f6`) from `verified` (lime `#84cc16`) from every
    other bucket — it just wasn't LIVE-reactive to a review-status click
    before (only ever reflected whatever the server computed at page-load
    time). Added a new same-tab `cardStatusOverride` ref + narrowing
    computed (mirrors `classifyCardStatus`'s own reasons-suffix convention:
    `; human-reviewed` / `; flagged with a known caveat: <text, truncated to
    200 chars>`), reset on a genuinely new card load, same
    "narrow-within-green/verified/uncertain-only, never invent a
    yellow/orange/red/gray/re-review transition locally" safety rule
    `app/pages/app/status/index.vue`'s own pre-existing green↔verified
    overlay already established for the 2-state case.
  - **Widened that SAME status-grid overlay too**
    (`app/pages/app/status/index.vue`'s `applyReviewStatusChange` +
    `useReviewStatusBus.ts`'s `ReviewStatusChange.reviewCaveat?: string`) —
    without this, a "Confirm (Uncertain)" click on the card page would have
    made the status grid's own square (if mounted concurrently, e.g. via a
    peek panel) optimistically flip to `verified` instead of `uncertain`,
    a real, if minor, inconsistency this task's change would otherwise have
    newly introduced (there was previously no way to reach `'human'`+caveat
    via any UI action at all, so this exact overlay bug couldn't have fired
    before). Small, contained, mirrors the exact same reasons-suffix
    convention.
- **Live-verified against the real dev server** (already running on :3000,
  reused) via direct `curl -X POST /api/card/review-status` calls
  reproducing exactly what `confirmFactsReviewWithCaveat`/`toggleReviewStatus`
  send (same request shape) — no browser/Playwright tool was available in
  this session, so this is route-level, not a literal button click, but it
  exercises the identical server-side code path a real click triggers:
  1. Fresh caveat on `cloud-midgar-mercenary` (fin/10 — a real, pre-existing
     `uncertain`-bucket card, `review:'ai'` going in): → `review:'human'`,
     caveat written, `verified-snapshot.json` created,
     `/api/card/fin/10`'s live `cardStatus.status` → `uncertain`.
  2. Second POST, DIFFERENT caveat text, already `'human'`: snapshot
     `capturedAt` re-baselined (proves the widened condition fires).
  3. Third POST, IDENTICAL caveat text: `capturedAt` unchanged (proves the
     no-op skip still works, not blanket-widened).
  4. Plain confirm (no `reviewCaveat` key): caveat cleared,
     `cardStatus.status` → `verified`, snapshot re-baselined again (caveat
     changed set→cleared, per the widened condition).
  5. Re-added a caveat: back to `uncertain`.
  6. Regression guard: hand-perturbed one fact in `synergy.json`
     (`types.has` array), ran `check-verified-regressions.mjs` (plain
     `node`, not `vite-node` — matches this project's own established
     tooling-quirk precedent) → flagged the mismatch, auto-reset
     `review:'human'` → `review:'regression'`, live `cardStatus.status` →
     `re-review` — **identical treatment to a plain verified card**, the
     explicit ask this task needed to prove, not just assume.
  - All scratch state reverted immediately after each check
    (`synergy.json`, `progress.json`, deleted `verified-snapshot.json`),
    confirmed byte-identical to the pre-test on-disk content via a direct
    diff against a backup taken before any test POST.
- `npx tsc --noEmit` clean throughout. `npx vitest run
  functional-model/check-verified-regressions.test.ts` — 13/13, unaffected
  (this task never touched that script's own diff logic, only its call
  sites' upstream inputs).
- Files touched: `server/api/card/review-status.ts`, `server/api/card/
  [set]/[number].ts`, `server/utils/fmBundle.ts`, `scripts/
  build-fm-bundle.mjs`, `app/components/CardDetailTabs.vue`,
  `app/composables/useReviewStatusBus.ts`, `app/pages/app/status/index.vue`.
  Did not touch `functional-model/card-status.ts`'s classification logic or
  any recognizer, per this task's own explicit constraint (both already
  correct going in).
- No new contract gap found beyond the one flagged above (the
  `build-fm-bundle.mjs` reviewCaveat-threading bug) — `.claude/contracts/
  card-schema.md` updated directly with the full design + live-verification
  writeup rather than left to a future flag, since this task's own dispatch
  asked for it explicitly.

- 2026-09-17: `/app/engine/sets` (`app/pages/app/engine/sets/index.vue`)
  reworked so selecting a row in its sidebar renders the card's real full
  content (Facts/Scenarios/Interactions tabs etc.) directly inline in the
  detail pane, instead of opening `CardPeekPanel.vue` (a floating overlay)
  on click. Mounts `CardDetailTabs.vue` — the same shared content component
  the standalone `/app/card/[set]/[number].vue` page and `CardPeekPanel.vue`
  itself both already mount — as a third consumer; no changes needed to
  `CardDetailTabs.vue`'s own props (`data`/`set`/`number`) or to either of
  the other two consumers. This page now owns its own small `fetch('/api/
  card/:set/:number')` + in-memory `set/number`-keyed response cache
  (mirrors `CardPeekPanel.vue`'s own copy, deliberately not shared as a
  composable — small enough duplication, and `CardPeekPanel.vue` isn't
  mine to refactor) keyed off `useStatusFilterList`'s `selected` entry +
  the page's own `SET` ref. `<CardPeekPanel />` mount and the old
  click-to-peek/`store.openCardPanel` call removed from this page entirely
  — confirmed via Playwright that no `aside[role="dialog"]` appears on this
  tab anymore, while the standalone page and the graph page's own peek
  panel (via `?card=` query) both still render exactly as before. The old
  small per-row summary block (status dot/reasons text) was dropped rather
  than kept alongside the new content — `CardDetailTabs.vue` already
  surfaces the identical live `cardStatus` (color dot + reasons tooltip) on
  its own Facts-tab strip, so keeping both would've been a duplicate, not
  new information. No contract shape mismatch found; `typecheck`/`vitest`
  both showed only pre-existing, unrelated failures (confirmed via `git
  stash` before/after comparison) — none in this file or its dependency
  chain.

## 2026-09-18: Gated Confirm/"Confirm (Uncertain)" buttons behind cardStatusBaseline === 'blue'

Closed a real, already-flagged gap in `.claude/contracts/card-schema.md`'s
"Real, enforced gate DOES now exist for the REVIEW-ACTION side of this axis"
section — server (`POST /api/card/review-status`) already 400s a
`reviewed:true` attempt on a `gray`/`purple`-baseline card, but the UI still
showed the buttons regardless, so a click just got a confusing failed
request. `app/components/CardDetailTabs.vue`:
- Imported `cardStatusBaseline` from `functional-model/card-status.ts`
  (engine-owned pure function, no fs/side-effects — safe cross-domain read,
  same pattern `CARD_STATUS_META` already established for `app/lib/
  cardStatus.ts`).
- New `canConfirmCardStatus` computed: `!!cardStatus.value?.status &&
  cardStatusBaseline(cardStatus.value.status) === 'blue'`. Reads the
  component's own live `cardStatus` (already same-tab-optimistic-override-
  aware via `cardStatusOverride`), not `baseCardStatus`.
- Facts row's `ReviewStatusBadge` (`variant="button"`, the single
  Confirm/Unconfirm control) now has `v-if="factsStatus === 'human_reviewed'
  || canConfirmCardStatus"` — hides the WHOLE control only when it would
  currently render "Confirm" (status `ai_reviewed`) on an ineligible card;
  "Unconfirm" (status `human_reviewed`) always renders regardless of
  baseline, matching Predicates'/Features' own "Clear review always
  allowed" precedent (confirmed by reading `app/pages/app/engine/
  predicates/index.vue`'s own `baseline === 'blue'`-gated
  Confirm/Reject + ungated "Clear review" `v-if`, exact same shape).
- "Confirm (Uncertain)" button gains `&& canConfirmCardStatus` onto its
  existing `v-if="isDev && data?.functionalModel"` — always a forced
  confirm, never an unconfirm, so it has no ungated analog to exempt.
- Scenarios/Interactions review rows (separate `scenariosReview`/
  `interactionsReview` progress.json fields, unrelated to fact-authoring
  completeness) were explicitly NOT touched — out of this task's scope, no
  baseline concept applies to them.
- `/app/engine/sets` needed zero changes — it already mounts
  `CardDetailTabs.vue` unchanged as a third consumer (see this file's own
  2026-09-17 entry), so the gate applies there automatically.
- Live-verified via a scratch Playwright script (chromium, not checked in,
  deleted after use) against the running dev server, both consumers:
  - Standalone `/app/card/fin/31` (status `orange` → baseline `purple`):
    table buttons = `["Confirm","Confirm"]` — only Scenarios+Interactions'
    own unrelated Confirm buttons, Facts' Confirm and Confirm (Uncertain)
    both correctly absent.
  - Standalone `/app/card/fin/4` (status `green` → baseline `blue`): table
    buttons = `["Confirm","Confirm (Uncertain)","Confirm","Confirm"]` — all
    four present as expected.
  - Standalone `/app/card/fin/1` (status `verified`, already human-reviewed,
    baseline `blue`): `["Unconfirm","Confirm (Uncertain)","Unconfirm",
    "Confirm"]` — Facts row correctly shows Unconfirm (never gated) +
    Confirm (Uncertain) (baseline blue, allowed to re-affirm/update the
    caveat on an already-verified card).
  - Embedded `/app/engine/sets` (clicked sidebar rows for fin/31 and fin/4
    via their `#<number>` span's ancestor `<li>`): identical button sets to
    the standalone page in both cases — confirms the shared-component reuse
    holds.
- `npx tsc --noEmit` clean. `npx vitest run` — 5 pre-existing failures in
  `scripts/relations.test.mjs` (missing `tagging/sets/{leb,2ed,arn}/
  *_relations.json`/`tagging/card-enrichment-status.json` — historical-sets
  tagging sweep's own in-progress files, nothing to do with this change),
  confirmed pre-existing via `git stash` before/after; everything else
  (1169 passed) unaffected.
- Files touched: `app/components/CardDetailTabs.vue` only, per this task's
  own constraint (didn't touch `functional-model/`, `server/api/*`, or the
  Predicates/Features/Sets page files).
- No contract mismatch found — `.claude/contracts/card-schema.md`'s own
  description of the gap (exact field names, exact server behavior) matched
  the real code precisely; the "not yet done as of this writing" note in
  that file is now stale and should be updated to reflect this fix (flagging
  for orchestrator, not editing that shared contract file myself).

## 2026-09-18: FDN cards get a real `CardDetailTabs.vue` page (Workstream 5's card-side half)

Replaced `/app/engine/cards` FDN detail pane's old one-off "source dump"
(`definition.ts` text + pipeline-status reasons, no real card-page
treatment) with the SAME shared `CardDetailTabs.vue` FIN cards use — the
whole point of this task. Ran concurrently with an `engine` agent building
`functional-model/pipeline-status.ts`'s `effectivePipelineStatus`/
`server/api/fdn-cards/[slug]/review.post.ts` from the same spec — both
landed mid-task, confirmed live against the real routes rather than mocked.

- **`server/api/card/[set]/[number].ts`**: new `loadFdnFunctionalModel(name)`
  (dev-only, `null` in production — mirrors `server/api/card-status/
  [set].get.ts`'s own "fdn is dev-only, no production branch" posture) —
  reads `functional-model/fdn-cards/<slug>/definition.ts` as `source`,
  `readPipelineStatus`+`effectivePipelineStatus` for a drift-aware
  `pipelineStatus: PipelineStatusFile | null` (raw file's other fields
  carried through, only `status` overridden to the effective value), and
  the `slug` itself. `synergy`/`traces`/`annotatedCard`/`cardStatus` all
  `null`/`[]` — never fabricated. `FunctionalModelData` interface (+
  `app/lib/cardResponse.ts`'s mirror) gained these two new
  `fdn`-only/`fin`-always-null fields. Main handler branches on `set ===
  'fdn'` vs the pre-existing `loadFunctionalModel` call — genuinely
  different computations, not a generalized rule (same pattern
  `card-status/[set].get.ts` already established for this exact split).
- **`app/components/CardDetailTabs.vue`**: new `isFdn` computed
  (`props.set === 'fdn'`). `functionalModelTabs` narrows to
  `Scenarios`+`Card Definition` only for `isFdn` (NOT just "Card
  Definition" — see correction below) — no Facts tab, ever (no
  synergy.json exists for FDN, full stop, structurally enforced by the
  `fdn-cards/`-vs-`cards/` directory split itself, not just this UI
  omission) and no Facts Json/Card Json (both would be empty, tied to
  `synergy`/`annotatedCard` which are always null for `fdn`).
  `functionalModelTabValue` wraps the shared `store.functionalModelTab`
  with a get-side-only FDN fallback (a stray FIN-only stored value like
  `'facts'` displays as `'definition'` for an FDN card without ever being
  written back, so returning to a FIN card resumes unaffected) — `set`
  always writes straight through unconditionally now (`'scenarios'`/
  `'definition'` are valid on both kinds, so no FDN-specific corruption
  risk). The FIN-only Facts/Scenarios/Interactions review-status table is
  now `v-if="!isFdn"`, with a `v-else` sibling: a `PIPELINE_STATUS_META`
  (new `app/lib/pipelineStatus.ts`, mirrors `app/lib/cardStatus.ts`'s
  established shape) badge + reasons/reviewNote/reviewedAt + Confirm/
  "Reject…" buttons, copied from `app/pages/app/engine/predicates/
  [[slug]].vue`'s established shape (button labels, reject-note-modal
  shape, `pendingKey`-style in-flight guard). Wired against the real,
  now-live `POST /api/fdn-cards/:slug/review`.
- **Two real, confirmed mismatches flagged rather than silently
  guessed/worked around** (both documented inline at their exact call
  sites too):
  1. **No Unconfirm/"Clear review" for the pipeline axis.** Every OTHER
     review axis in this app (FIN's own Facts Unconfirm,
     Predicates'/Features' "Clear review") has a reverse-to-baseline
     affordance; `pipeline-status.ts`'s `applyPipelineReview` is a PURE
     one-way `blue -> yellow|green` transition with no `verdict: null`
     case at all — there is nothing for a clear-review click to call, so
     none was added. Flagging for whoever owns that file/route next in
     case a reverse transition gets added later.
  2. **Confirm/Reject gates on `blue` ONLY, not `blue`-or-`re-review`** —
     this task's own original dispatch assumed re-review should be
     reviewable directly ("re-review only ever sits on a blue-rooted
     card"), but the REAL, now-live `server/api/fdn-cards/[slug]/
     review.post.ts` explicitly 400s a drifted `re-review` entry too
     ("confirm/reject is only meaningful once the card has actually
     reached blue" — a re-review must go back through the authoring
     pipeline to become fresh `blue` again first, it can't be
     re-confirmed directly). `canReviewPipeline` matches the REAL server
     precondition (confirmed live), not the dispatch's original
     assumption.
- **Mid-task correction** (relayed from the user via the orchestrator,
  after this task was already in flight): the original dispatch said omit
  BOTH Facts and Scenarios tabs for FDN — corrected to KEEP Scenarios (no
  FDN card has a `scenarios.ts` yet — that only gets authored later, when a
  reviewer rejects a `blue` card and a smart-tier model writes one to
  investigate — but the tab/its rendering machinery stay ready for when one
  does). Confirmed `ScenarioReplay`'s existing `v-else` "No scenarios
  recorded." fallback already degrades correctly for an FDN card's empty
  `traces: []` with zero FDN-specific casing needed. Also confirmed (no
  code change needed) the correction's point 3: no separate per-tab
  Scenario/Interaction confirm affordance was ever added — the pipeline
  Confirm/Reject block is the one and only review control on an FDN card
  page, matching this session's own long-standing "scenarios/interactions
  confirm buttons removed as a category" policy.
- **Standalone `/app/card/[set]/[number].vue` route**: NOT touched/verified
  — out of this task's explicit "nice-to-have, don't block on it" scope.
  From reading `server/api/card/[set]/[number].ts` and `CardDetailTabs.vue`,
  neither has any FIN-specific assumption baked in that would obviously
  block `set=fdn` there too (both are now genuinely set-generic), so it may
  well "just work" already — genuinely untested, flagging rather than
  claiming it works.
- **Live-verified** via a scratch Playwright script (chromium, run from the
  repo root so `node_modules/playwright` resolves, deleted after use — not
  committed) against the already-running dev server: clicking `serra-angel`
  (blue) from `/app/engine/cards/fdn`'s sidebar navigates to `/app/engine/
  cards/fdn/147` and renders exactly `["Scenarios", "Card Definition"]` as
  the tab strip (no Facts/Facts Json/Card Json), the pipeline-status badge
  ("PIPELINE STATUS" — visually uppercase via CSS, real text is "Pipeline
  status") shows "Transcribed" with real Confirm/Reject… buttons, the
  Reject… modal opens/gates its submit button on a non-empty note/closes on
  Cancel, and a REAL end-to-end Confirm click (on `day-of-judgment`, a
  different untouched blue card, to avoid reusing the same one twice) wrote
  a real `green` `pipeline-status.json` on disk and made the UI badge flip
  to "Confirmed" with both buttons disappearing — reverted the on-disk file
  back to its pristine `blue` content immediately after (confirmed via
  `git diff --stat` showing zero changes under `functional-model/
  fdn-cards/` at the end). `aetherize` (purple/Blocked) and `abrade` (gray/
  Not started, no folder at all) both correctly show zero Confirm/Reject
  buttons and their own real reasons/"no folder yet" text. `fin/4`
  (regression check) still renders its full, unchanged
  Facts/Scenarios/Facts Json/Card Json/Card Definition tab strip and
  Facts/Scenarios/Interactions review table, with no "Pipeline status" text
  anywhere on the page.
- `npx tsc --noEmit` clean (0 errors — the task's own dispatch mentioned 4
  known pre-existing baseline errors, but none exist as of this writing;
  likely fixed by concurrent work elsewhere in this same session). `npx
  vitest run` — same 5 pre-existing failures as always
  (`scripts/relations.test.mjs`, missing `tagging/sets/{leb,2ed,arn}/
  *_relations.json`/`tagging/card-enrichment-status.json` — the
  historical-sets tagging sweep's own in-progress files, unrelated); every
  other test passes (1235, up from 1227 at task start — the increase is the
  concurrent engine agent's own new `card-interactions`/`pipeline-status`
  tests, not mine).
- Files touched: `app/components/CardDetailTabs.vue`, `app/lib/
  cardResponse.ts`, `app/pages/app/engine/cards/[set]/[[number]].vue`,
  `server/api/card/[set]/[number].ts`, new `app/lib/pipelineStatus.ts`.
  Did NOT touch `functional-model/pipeline-status.ts`,
  `server/api/card-status/[set].get.ts`, `server/api/fdn-cards/`, or
  `.claude/contracts/card-schema.md` — all concurrent `engine` agent work
  landing in the same window; confirmed via `git status --short` right
  before finishing that none of those show up as changes I made.
- No NEW contract mismatch found beyond the two flagged above (both
  already inline-documented at their call sites, not left implicit) —
  `.claude/contracts/card-schema.md`'s "FDN authoring-pipeline status"
  section's own "Nothing in this section is wired to anything real yet...
  Workstream 5... is a separate, not-yet-started task" note is now stale
  (Workstream 5's card-side half — this task — is done); flagging for
  orchestrator to update, not editing that shared file myself since the
  concurrent `engine` agent was actively mid-edit on it during this task.

## 2026-09-18 (later): Standalone `/app/card/[set]/[number]` route deleted — `/app/engine/cards/[set]/[[number]].vue` is now THE ONE real card page

Consolidation task: eliminate the second, separately-maintained page
wrapper around `CardDetailTabs.vue`. The standalone page
(`app/pages/app/card/[set]/[number].vue`) is deleted; every real in-app
link that pointed there now points at `/app/engine/cards/<set>/<number>`
instead: `RecognizerEntryCard.vue:143`, `SearchBox.vue:332`,
`CardPeekPanel.vue:130` (its "Open full card page" expand action),
`GraphCanvas.vue:99` (ctrl/cmd-click new-tab), `CardDetailTabs.vue:1939`
(the Interactions tab's matched-card thumbnail links — turned out NOT to
be a meld/other-face link specifically as the dispatch guessed, just the
same kind of card-thumbnail link).

- **Previous/Next**: NOT reimplemented as separate chrome. The engine
  Cards tab's existing `EngineConsoleShell` (arrow-key + click Prev/Next,
  same Predicates/Features pattern) already walks the exact same
  "adjacent real card" semantics the old page's `useSetOrder`-backed
  default path had — confirmed both `/api/card-status/fin`'s cards array
  (backed by `data/fin/fin_scryfall.json`, verified 312 entries / 312
  unique names, zero reprint duplicates) and the `fdn` branch's own
  explicit per-name dedupe are ALREADY "one row per real card," matching
  `useSetOrder`'s own "mechanically unique" guarantee — not a downgrade.
  Dropped, not ported: the old page's Previous/Next could ALSO scope
  itself to an active global graph filter (deck paste order / live query
  result list) — a graph-page-only concept with no equivalent on this dev
  console tab.
- **Deck-qty badge**: dropped entirely, not ported — confirmed
  `getKnownDeckCards`/`getActiveFilterMode` (`useGraphStore.ts`) have no
  meaning on a tab with no deck-building concept. Both exports left in
  place (not `card` lane's call alone to prune a shared graph-store
  export used by "the main graph page might revisit this for a future
  deck-builder PRD" reasoning) but flagged inline as newly-orphaned in
  that file's own comments.
- **Real regression caught before calling this done**: a card whose
  `:set` ISN'T one of this tab's own tracked-corpus sets (`/api/card-status/sets`
  — today just `fin`/`fdn`) is a REAL, first-class case here — any live
  `?sf=` Scryfall-query card (CLAUDE.md: arbitrary live queries are
  supported, not a niche edge case) can be from literally any real MTG
  set, and all 5 real call sites above can link to one. The naive
  redirect-everything-unknown-away logic already on this page would have
  silently broken every one of those. Added `genericMode`: skips the
  whole card-status sidebar/list machinery for that one case and falls
  back to a real single-card view, with Previous/Next restored via
  `useSetOrder`/`neighborsInSetOrder` — confirmed by READING that
  composable/its server route (`/api/cards/set-order/[set].ts`) before
  assuming they were safe to delete alongside the old page: both were
  ALREADY written generic-over-any-set (live Scryfall `unique=cards`
  fallback when the set isn't in the local `cards.db`), not FIN-specific
  — so nothing needed to change there, just a new consumer. Almost deleted
  both as "now-orphaned" cleanup before catching this — don't repeat that
  mistake; `useSetOrder.ts`'s own header now documents the new consumer.
  The bare-`:set`-no-`:number` "stale set, redirect to first available"
  behavior is UNCHANGED (only fires when no specific card was requested).
- Also fixed in the same pass: the `ENGINE_SETS_LAST_SET_KEY` localStorage
  write (used by the bare `/app/engine/cards` index redirect) used to be
  an unconditional `onMounted`, which would have let a one-off
  `genericMode` visit clobber "last viewed set" with an arbitrary
  non-corpus code. Moved into the `availableSets` watch, gated on
  `sets.includes(SET)`.
- **Mid-task addition from the orchestrator** (unrelated to the page
  consolidation itself, folded into the same session since it was the
  same file): Scenarios tab now omitted ENTIRELY (not shown with "No
  scenarios recorded." text) whenever `scenariosCount === 0`, for either
  `fin` or `fdn`. `functionalModelTabValue`'s existing FDN-fallback `get`
  (a read-only fallback, never writes back) got a second, independent
  fallback clause for this: a stored `'scenarios'` value on a card with
  zero traces reads as `'facts'` (fin) / `'definition'` (fdn) instead,
  WITHOUT touching the stored value — confirmed live: selected Scenarios
  on fin/8 (2 traces) → navigated to fin/273 (0 traces, real card, no
  Scenarios tab, fell back to Facts) → back to fin/8, Scenarios selection
  intact. Also confirmed FDN's `serra-angel` (fdn/147, 0 traces) shows
  Card Definition only, no Scenarios tab.
- **Live-verified** (scratch Playwright, dev server already running,
  run from repo root under a gitignored `.scratch/` dir, deleted after):
  old `/app/card/fin/8` → real client-side 404 ("Page not found");
  new `/app/engine/cards/fin/8` → full Facts(4)/Scenarios(2)/Facts
  Json/Card Json/Card Definition tabs, 5 review-control buttons, correct
  title, Prev/Next buttons present; SearchBox row click → peek panel
  (`?card=fin/8`) → "Open full card page" → lands on
  `/app/engine/cards/fin/8` (takes several real seconds — the Cards tab's
  own `/api/card-status/:set` spawns a vite-node subprocess, a pre-existing
  cost unrelated to this change, initially mistook the resulting delay for
  a broken click before waiting longer disproved that); GraphCanvas
  ctrl-click on a real force-graph node → new tab lands on
  `/app/engine/cards/fin/279` (needed `page.keyboard.down('Control')`
  held across a raw mouse down/move/up rather than `.click({modifiers})`
  — d3-drag's own click-vs-drag gesture recognition doesn't reliably see
  Playwright's synthetic modifier-click as a real held key; NOT an app
  bug, a synthetic-input quirk against this file's own known-fiddly
  drag/click event plumbing); `/app/recognizers` matched-card links
  resolve to `/app/engine/cards/...`. Zero console errors throughout.
- `npx tsc --noEmit` clean. `npx vitest run`: same 5 pre-existing
  failures (historical-sets sweep's own in-progress `tagging/` files),
  1235 passed, unchanged from before this task.
- Files changed: `app/pages/app/engine/cards/[set]/[[number]].vue` (the
  real page-logic work), `app/components/{RecognizerEntryCard,SearchBox,
  CardPeekPanel,GraphCanvas,CardDetailTabs}.vue` (link updates + comment
  fixes), `app/composables/{useSetOrder,useGraphStore}.ts` (comment-only —
  new consumer / newly-orphaned-export notes), `app/pages/app/index.vue`,
  `app/layouts/graph.vue` (comment-only, stale path references).  Deleted
  `app/pages/app/card/[set]/[number].vue` (and its now-empty parent dirs).
  Left plenty of OTHER comment-only path references to the deleted file
  untouched (`ScenarioReplay.vue`, `ScenarioReplayTrace.vue`,
  `factConditions.ts`, `factOrder.ts`, `ReviewStatusBadge.vue`, `types.ts`,
  `server/api/card/[set]/[number].ts`) — all just "which page consumes
  this data shape" doc-comment pointers, still substantively true, didn't
  seem worth a repo-wide comment sweep for this task; flagging in case a
  future pass wants full cleanup.
- No contract mismatch found — didn't need to read `card-schema.md`/
  `state-event-format.md` for this task at all (pure page-routing/UI
  consolidation, no engine-shape questions).

## 2026-09-18, later same day: FDN cards get real printed oracle text (plain, un-annotated) alongside `definition.ts`

FDN cards' page previously showed ONLY `definition.ts` source (no rules
text at all). User explicit call: build a NEW, genuinely minimal
plain-text component for this — do NOT retrofit `FunctionalModelText.vue`
(FIN's real annotated-oracle-text component, hard-depends on
`annotatedCard`/`Fact.annotations`, which FDN structurally never has).

- **New served field**: `FunctionalModelData.oracleText: string | null`
  (`server/api/card/[set]/[number].ts`) — `null` for every `fin` entry
  (both dev and prod branches), real for `fdn`. `loadFdnFunctionalModel`
  now takes a second `faces: FaceInput[]` param (the SAME real
  Scryfall-derived `faces` array the main handler already builds off
  `lookupCardBySetNumber(set, number)` — no second DB query needed, that
  lookup already covers the "match by set/number" case the task asked
  about) and joins each face's own real `oracleText` with a blank line
  between faces, `null` if every face's text is empty (vanilla creature).
  Mirrored onto the shared client type `app/lib/cardResponse.ts`'s
  `CardResponse.functionalModel.oracleText` too (that file is a
  hand-mirrored copy of the server shape — noticed in passing that
  `reviewCaveat` is ALSO missing from it, a pre-existing gap unrelated to
  this task, not fixed here — `npm run typecheck` already fails on that
  line (964) on `main` before this task's changes, confirmed via
  `git stash`/typecheck-before/after diff).
- **New component**: `app/components/PlainOracleText.vue` — one prop
  (`oracleText: string`), one `<p class="whitespace-pre-wrap ...">`. No
  spans, no hover, no click-to-inspect, deliberately not meant to grow.
- **Wired into `CardDetailTabs.vue`**: `v-else-if="isFdn && data.
  functionalModel.oracleText"` sitting in the exact same slot as the
  `v-if="data.functionalModel.annotatedCard"` → `FunctionalModelText`
  block right above it (both are mutually exclusive in practice — `fin`
  always has `annotatedCard`/never `oracleText`, `fdn` is the reverse) —
  same "above the tab strip" position FIN's own annotated block already
  established. FIN's own `FunctionalModelText`/`annotatedCard` path is
  completely untouched.
- **Verified live** (dev server was already running, port 3000 — shared
  with a concurrent session, see note below):
  - `curl /api/card/fdn/16` → `oracleText: "When this creature enters,
    draw a card."` (Helpful Hunter); `curl /api/card/fin/8` →
    `oracleText: null`, `annotatedCard` still populated.
  - Playwright, `/app/engine/cards/fdn/16`: real oracle text visible in
    the page AND a `pre`/`code` block count of 3 (source code still
    shown) — both visible together, confirmed not one replacing the
    other.
  - Playwright, `/app/engine/cards/fin/8` (Auron's Inspiration): real
    annotated oracle text still renders via `FunctionalModelText`
    (confirmed via its own `whitespace-pre-wrap`/`text-text/90` paragraph
    class showing up exactly twice, matching its own two oracle-text
    lines, and a real `decoration-dashed` annotated span present in the
    raw HTML) — `PlainOracleText` never mounts there (`isFdn` is false).
  - `npm run typecheck`: pre-existing baseline failures only (confirmed
    identical error set before/after via `git stash`) — `CardStatusBucket`
    index-signature errors, the pre-existing `reviewCaveat` gap noted
    above, and unrelated `functional-model/card-status.ts` /`card.ts`/
    `mana.ts`/`server/api/tokens/by-key.ts` errors. No NEW errors from
    this change. Plain `npx vue-tsc --noEmit` (not the nuxt-specific
    typecheck) reports zero errors either way.
  - `npm run test`: 1235 passed, 5 pre-existing failures (all
    `scripts/relations.test.mjs`, missing `tagging/sets/*/`.json files —
    unrelated to this task, some other in-flight historical-sets/review
    process's own data, not touched here).
- **Flag, not mine to touch**: while working, `git status` showed
  `app/components/RecognizerEntryCard.vue` (modified) and
  `app/pages/app/card/` (new dir) appear/change mid-task with no action
  from me — a concurrent peer session/agent editing the same repo live
  (dev server on :3000 was already running before I started). Did not
  touch either; flagging per the "concurrent-agent git staging" project
  convention so the orchestrator scopes its own `git add`/commit
  carefully rather than assuming my diff is the only one present.

## 2026-09-18, later still: `/app/card/[set]/[number]` restored as a real SEPARATE route from `/app/engine/cards/...`

Partial reversal of the same-day consolidation two sections up, per
explicit user correction: `/app/engine/*` (internal dev/engine-console)
and the real app's own user-facing card page are two separate ROUTES going
forward, even though both currently render identical CONTENT via the same
shared `CardDetailTabs.vue` — "for now we use the same component, but that
might diverge at some point in the future." Restored the STANDALONE PAGE
(page-chrome only), did NOT re-fork `CardDetailTabs.vue` itself.

- **Restored `app/pages/app/card/[set]/[number].vue`** from
  `git show 46e504f^:'app/pages/app/card/[set]/[number].vue'` (its content
  immediately before the original deletion) essentially byte-for-byte:
  standalone `useFetch`, deck/query-filter-aware Previous/Next
  (`useSetOrder`/`neighborsInSetOrder` + the active-global-filter overlay),
  the deck-qty badge (`getKnownDeckCards`/`getActiveFilterMode` from
  `useGraphStore.ts`), pending/error/loading states, mounts the SAME
  `CardDetailTabs.vue` unchanged. Only real edit: the header comment now
  documents the delete→restore round-trip and the "separate routes, same
  component for now" rule so a future pass doesn't re-attempt the merge
  without checking here first.
- **The generic-set (`?sf=` live-query) fix did NOT need porting** —
  confirmed by reading, not assumed: this page's own `useSetOrder`/
  `neighborsInSetOrder` composable + its server route
  (`/api/cards/set-order/[set].ts`) were ALREADY generic-over-any-set
  (live Scryfall `unique=cards` fallback when the set isn't in the local
  `cards.db`) before the consolidation ever happened — the "genericMode"
  branch added to `/app/engine/cards/...` during the consolidation was
  new logic needed ONLY because that other page has a tracked-corpus
  sidebar concept (`fin`/`fdn` only) this standalone page never had in the
  first place. Verified live anyway (see below) rather than trusting the
  read alone.
- **Updated the 5 real call sites back** to `/app/card/<set>/<number>`:
  `RecognizerEntryCard.vue:143` (+ its header comment), `SearchBox.vue:332`
  (+ its header comment), `CardPeekPanel.vue:132` (`expand()`, + two header
  comments), `GraphCanvas.vue:99` (ctrl/cmd-click new-tab), `CardDetailTabs.
  vue`'s own matched-card thumbnail link (line ~1985 — confirmed again,
  same as the original consolidation task found, this is NOT meld/other-
  face-specific, just the Interactions tab's generic matched-card
  thumbnails) + that file's own header comment. Also fixed two more
  comment-only stale references the original consolidation left behind:
  `app/pages/app/index.vue`'s `CardPeekPanel` doc comment and `app/layouts/
  graph.vue`'s store-ownership doc comment, both of which named the
  now-wrong page path.
- **Left `/app/engine/cards/[set]/[[number]].vue` completely untouched**
  per explicit instruction — its own header comment still self-describes
  as "THE ONE real card-detail page" / documents the old standalone page as
  permanently gone, which is now STALE again now that the standalone page
  is back. Deliberately not fixed (told to leave that file exactly as-is);
  flagging here in case a future pass touches that file for an unrelated
  reason and wants to fix the comment in passing.
- **Live-verified** (dev server already running on :3000, shared with a
  concurrent peer session — see that session's own note above; scratch
  Playwright script under a local `.scratch/` dir, deleted after):
  `/app/card/fin/8` → real title, Facts tab visible, Previous/Next visible,
  correct URL; `/app/engine/cards/fin/8` → unaffected, own "Engine | Cards |
  ..." title, Facts tab visible; graph page SearchBox → row click → peek
  panel (`?card=fin/104`) → "Open full card page" (`aria-label="Open full
  card page"`) click → lands on `/app/card/fin/104` (client-side nav is
  slower than a real `load` event, tripped up `page.waitForURL`'s default
  wait-for-`load` state at first — not an app bug, just this test's own
  wait condition; the URL update itself is prompt); a live `?sf=t:goblin`
  query result card (peek panel opened `?sf=t:goblin&card=tecl/6`, a real
  Goblin token from set `tecl`, confirmed via `curl /api/card/tecl/6`) →
  expand → lands on `/app/card/tecl/6`, no "Card not found," real card data
  rendered. Zero console errors across all of the above.
- `npx tsc --noEmit` clean (0 errors, re-checked after the concurrent
  peer session's own edits landed too). `npx vitest run`: same 5
  pre-existing failures (historical-sets sweep's own in-progress
  `tagging/` files, unrelated), 1235 passed — unchanged.
- Files touched: new `app/pages/app/card/[set]/[number].vue` (restored);
  `app/components/{RecognizerEntryCard,SearchBox,CardPeekPanel,
  GraphCanvas,CardDetailTabs}.vue` (link + comment updates only);
  `app/pages/app/index.vue`, `app/layouts/graph.vue` (comment-only). Did
  NOT touch `app/lib/cardResponse.ts`, `server/api/card/[set]/[number].ts`,
  or the new `app/components/PlainOracleText.vue` — all concurrent peer
  work landing in the same window (confirmed via `git status --short`
  right before finishing: those three show as changes I didn't make).
- No contract mismatch found — pure page-routing/UI work, no engine-shape
  questions touched.

## 2026-09-18, later still — Sink CATALOG/ATTACHMENT card-side wiring

Built the `card`-side half of the sink-only-synergy experiment's
catalog/attachment foundation (engine landed `functional-model/
sink-attachment.ts`, `pipeline-status.ts`'s `blue` redefinition,
`sink-model/catalog/*` in `a6bcb4f` just before this task).

- New `server/api/fdn-cards/[slug]/sinks.post.ts` — `POST` body
  `{ attachedSlugs: string[] }`, writes `functional-model/fdn-cards/<slug>/
  sinks.json` via `markSinkAttachmentReviewed`+`writeSinkAttachment` (never
  hand-rolled a second fingerprint scheme). 404 if no `definition.ts`
  exists for the slug; 400 if `attachedSlugs` isn't a string array or
  references an unknown `SINK_CATALOG` slug (`validateSinkAttachment`
  reused, not reimplemented); dev-only (403 in production), same posture as
  the sibling `review.post.ts`.
- **Fixed the real, contract-flagged gap in `server/api/fdn-cards/[slug]/
  review.post.ts`**: it re-runs the schema gate fresh but never checked
  attachment completeness — added an `isSinkAttachmentComplete(slug, root)`
  check right after the fresh gate passes, 400ing with a clear message if
  not. Deliberately does NOT call `effectivePipelineStatus` directly against
  the STORED file for this (that would break the route's own pre-existing
  "reject after confirmed"/"confirm after rejected" support, since a stored
  `yellow`/`green` is never `'blue'` under `effectivePipelineStatus`) — just
  re-derives the same "schema-pass AND attachment-complete" rule against the
  FRESH gate result instead. Live-verified: `helpful-hunter` (schema passes,
  no `sinks.json`) correctly 400s on review; attaching `[]` sinks then makes
  the *identical* review request succeed (`green`). Reverted the live test's
  on-disk side effects (`helpful-hunter/sinks.json` removed,
  `pipeline-status.json` restored via `git checkout`) before finishing —
  don't re-break that card's "still gray, no attachment" demonstration state.
- `FunctionalModelData` (`server/api/card/[set]/[number].ts`) gained two new
  `fdn`-only fields: `sinkAttachment: SinkAttachmentFile | null` (raw file,
  `readSinkAttachment`) and `sinkAttachmentStatus: SinkAttachmentStatus |
  null` (`effectiveSinkAttachmentStatus`, always computable even with no
  file — `'not-started'`). Both `null` for `fin`. Mirrored into the
  hand-maintained `app/lib/cardResponse.ts` `CardResponse` interface too —
  that file doesn't import the server route's own type, easy to forget.
- New "Sinks" tab in `CardDetailTabs.vue`'s `isFdn` strip (now `Scenarios? /
  Sinks / Card Definition`) — status badge (new `app/lib/
  sinkAttachmentStatus.ts`, `SINK_ATTACHMENT_STATUS_META`, reuses the shared
  gray/green/re-review color vocabulary rather than coining a 4th palette),
  a checkbox picker over `SINK_CATALOG` (category label + slug + a
  `factConditions`/`describeFact`-rendered structural summary — `SinkQuery`
  is structurally `Fact` minus 4 fields, so this reuses the exact same
  Facts-tab rendering vocabulary rather than a hand-rolled JSON dump), and
  its own explicit "Mark attachment reviewed" button — deliberately
  SEPARATE from the card-level pipeline-status Confirm/Reject block above it
  (two different completion steps, per the task's own instruction). Added
  `'sinks'` to `useGraphStore.ts`'s shared `FUNCTIONAL_MODEL_TABS`/
  `functionalModelTabValue` union + fallback logic.
- Real TS inference gotcha, fixed: adding the 3rd distinct FDN tab-item
  literal shape (`'sinks'`) to the pre-existing `isFdn ? [...] : [...]`
  ternary building `functionalModelTabs` broke `UTabs`'s generic `:items`
  prop inference (a real, narrow fragility, not a runtime-shape problem) —
  fixed by giving that computed an explicit `FunctionalModelTabItem[]`
  return type instead of letting TS infer one from the ternary.
- Live-verified (shared dev server, already running from a concurrent `ui`
  session — same `:3000`, no conflict) via a throwaway Playwright script
  (run from a copy inside the project root so `node_modules/playwright`
  resolves, deleted after): `ajani-s-pridemate` → effective `blue`
  ("Transcribed"), Sinks tab badge "1", Lifegain checked, Attachment status
  "Attached"; `serra-angel` → effective `blue`, zero checked, still
  "Attached" (the real zero-sink-but-complete case); `helpful-hunter` →
  effective `gray` ("Not started" — same label `gray` already carries
  elsewhere, not a bug), no Confirm/Reject buttons rendered (`canReviewPipeline`
  already correctly gates off the EFFECTIVE status, no extra card-side fix
  needed for point 4 — `effectivePipelineStatus` folds attachment
  completeness in at the engine layer, and every consumer here already read
  through it before this task). Clicking a checkbox flips draft state +
  shows "unsaved changes" with zero disk writes until Save is clicked
  (confirmed via `git status` before/after).
- `npm run typecheck`: same pre-existing baseline errors only (confirmed via
  `git stash` A/B — `CardStatusBucket` string-index issues at now-shifted
  line numbers, `card-status.ts`/`card.ts`/`mana.ts`/`tokens/by-key.ts`,
  none touched by this task); zero NEW errors after the `FunctionalModelTabItem`
  fix. `npx vitest run`: same 5 pre-existing `tagging/` ENOENT failures
  (historical-sets sweep's own in-progress files), otherwise clean.
- Concurrent `ui`-agent work landed in the same working tree while this ran
  (`EngineConsoleTabs.vue`, `app/pages/app/engine/sinks/**`,
  `functional-model/sink-catalog-reviews.json`, `server/api/sink-catalog/**`,
  `.claude/agent-memory/ui/notes.md`) — confirmed via `git status` I never
  touched any of them, per this task's own "not yours" scope.
- No contract mismatch found against `.claude/contracts/card-schema.md`'s
  "Sink CATALOG..." section — it already correctly described the exact gap
  this task closed; no orchestrator update needed there beyond someone
  eventually striking the "not yet done" framing now that it's fixed (left
  for the orchestrator/engine agent's own contract-maintenance pass, not
  edited here since this agent only flags, doesn't author engine-owned
  contract sections).
