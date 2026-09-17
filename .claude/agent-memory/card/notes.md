# card agent notes

- 2026-09-17: new route `server/api/deck-sink-supply.post.ts` — thin server
  wrapper around engine's new `functional-model/synergy.ts`
  `computeDeckSinkSupply`/`augmentPoolCards` (didn't touch that file, per
  task constraint). `POST` body `{ deck: [{ set, number, qty }] }`, response
  `{ results: [{ set, number, rows: [{ label, count }] }] }` — full shape +
  rationale now in `.claude/contracts/api-contract.md`. Consumer is a `ui`
  dispatch (renders under graph nodes), not built here.
  - Card resolution reuses `server/utils/functionalModelPool.ts`'s
    `loadFunctionalModelPool()` (same cached whole-pool loader `/api/card/
    :set/:number` and `/api/graph-links` already use) — did NOT hand-roll a
    second `PoolCard`-construction path.
  - set/number -> Scryfall name lookup is a small LOCAL duplicate of
    `server/api/card/[set]/[number].ts`'s own `lookupCardBySetNumber`
    (own `data/cards.db` connection + paced live-Scryfall fallback), not an
    extraction into a shared util — deliberately following the existing
    precedent `server/api/card/review-status.ts`'s own `lookupOracleCard`
    already set (that file's own header comment explains why: this route
    only needs the read-only single-field case, not the big route's
    token/interaction/relations machinery, so a shared helper wasn't worth
    the coupling). Worth knowing if a future 4th consumer shows up — three
    near-identical copies might tip the balance toward finally extracting one.
  - **Real gotcha caught before shipping**: a DFC's top-level Scryfall
    `name` is `"Front // Back"`, but `PoolCard.name` (from
    `CardDefinition.name`) is the FRONT face's name ALONE (confirmed against
    `jill-shiva-s-dominant-shiva-warden-of-ice`/`jecht-reluctant-guardian-...`
    `definition.ts`) — the lookup reads `card.card_faces?.[0]?.name ??
    card.name`, not the bare top-level `name`, or every DFC in a deck would
    silently fail to resolve into the pool.
  - Two deck lines resolving to the same card by name (different printings)
    have their `qty` SUMMED before building `DeckEntry[]` — otherwise
    `computeDeckSinkSupply`'s own self-supply `qty - 1` withholding would
    double-discount a card split across two decklist lines.
  - Verified live against a real dev server (one was already running from a
    concurrent session — reused it rather than fighting the Nuxt single-dev
    lock) with a real FIN deck matching engine's own `synergy.test.ts`
    worked example (Ambrosia Whiteheart vs. Elrond/Al Bhed Salvagers/
    Gladiolus Amicitia/Vector, Imperial Capital) — got back the exact same
    `{battlefield presence: 13, landfall: 0, enters the battlefield: 1}` the
    engine test hand-verifies. Also spot-checked: an unresolvable set/number
    and a real-but-unmodeled card (Plains) are both silently skipped, not
    errored; malformed body returns 400.
  - `npm run typecheck`: clean on this file; 4 PRE-EXISTING failures found
    elsewhere (`functional-model/card-status.ts`, `card.ts`, `mana.ts`,
    `server/api/tokens/by-key.ts`) — not touched by this task, matches the
    "3-4 pre-existing from concurrent sessions" the dispatch itself warned
    about.
  - No contract shape mismatch found against `card-schema.md`/
    `state-event-format.md` for this task — only `api-contract.md` needed a
    new section (added).

- 2026-09-16 (follow-up, same day, to the entry directly below): 3 user
  corrections to the `annotatedNonFactSpans` feature, all addressed.
  1. **Row content**: dropped the `note` free text from the visible row
     entirely (still readable via the raw-JSON debug button, not gone from
     the data) — row now shows a distinct icon (`lucide:file-text`, slate,
     NOT the Fact log-in/log-out role icon) + a short label from a new
     `NON_FACT_SPAN_KIND_LABEL` map (`app/lib/factOrder.ts`, exported):
     `'definition-path'` → "Definition", `'rules'` → "Rules", `'lore'` →
     "Lore". No recognizer-link icon (correct already — these have no
     recognizer, never had one).
  2. **Click(hover)-to-highlight**: wired the SAME `hoveredFactKey`
     mechanism a real Fact row already uses (mouseenter/mouseleave, not an
     actual `click` handler — matches the literal existing Fact-row
     mechanism, which is hover-based) onto the non-Fact-span row, using its
     own stable `NonFactSpanRow.key`. Required extending
     `FunctionalModelText.vue` (previously untouched by the first pass of
     this feature) to accept a new `nonFactSpans?: NonFactSpanRow[]` prop
     and build highlightable segments from it — `Segment`/`Range` both
     gained an optional `spans?: NonFactSpanRow[]` alongside `facts?:
     Fact[]`, `buildSegments`'s merge/interval-partition logic now unions
     both per slice, `isRowHighlighted`/`show()`/the hover tooltip all
     check/emit a span's own `.key` the same way they already do a Fact's
     `factKey()`. A non-Fact-only segment gets its own neutral
     `decoration-slate-400/65` underline (not blue/emerald, which both
     carry real source/sink meaning this doesn't have).
     - **Real bug found and fixed in the same pass**: the template's own
       `v-if="seg.facts?.length"` gate (both the oracle-text-line and
       type-line rendering blocks) only ever checked `facts`, never
       `spans` — so a segment covered ONLY by a non-Fact span silently
       rendered as plain, non-underlined, non-hoverable text even after
       `buildSegments` correctly attached its `spans` array. Fixed via one
       shared `hasSegmentLink(seg)` helper (`!!(seg.facts?.length ||
       seg.spans?.length)`) used in both places — named specifically so a
       future third row-kind can't reintroduce the same one-sided check
       silently. Caught by literally hovering the row and seeing zero
       highlight in the printed text before this fix; confirmed fixed by
       the same test after.
  3. **Checkbox↔highlight sync** (confirmed the reported bug was real
     before fixing it, per instruction): `FunctionalModelText.vue`'s
     `facts`/(now `nonFactSpans`) props used to always receive the FULL
     unfiltered fact list (`allSynergyFacts`) and the header name's own
     self-fact underline (`headerFaceFacts`) read the same unfiltered
     list — so unchecking a Facts-tab toggle removed a row from the table
     but left its phrase/header-name still highlighted in the printed card
     text. Fixed by adding `visibleSynergyFacts` (CardDetailTabs.vue) —
     `allSynergyFacts` filtered by the SAME 3 fact-provenance toggles that
     already gate `factRowGroups` — and pointing BOTH
     `<FunctionalModelText :facts="...">` and `headerFaceFacts` at it
     instead of the raw unfiltered list; `<FunctionalModelText
     :non-fact-spans="...">` gets the equivalent `visibleNonFactSpanRows`
     (gated by the 4th toggle). `allSynergyFacts`/`factRows` themselves
     stay unfiltered on purpose — the ordering/toggle-filtering pipeline
     downstream (`orderedAllDisplayRows`/`factRowGroups`) still needs the
     full authored set to work from; only the FINAL render/highlight
     consumption filters.
  - **Live-verified** (Playwright, `nuxt dev --port 3010`,
    `NUXT_IGNORE_LOCK=1` since another session held :3000's lock; stopped
    cleanly after, :3000 untouched):
    - fin/2 (ultima-origin-of-oblivion): row shows "Definition" label + new
      icon, no note/kind-string text anywhere; hovering the row highlights
      the correct oracle-text span (confirmed via `bg-surface/60` on the
      right `<span>`) AND the reverse direction (hovering the oracle-text
      span highlights the row + shows a "Definition"-only tooltip, no
      `describeFact`/note leakage).
    - fin/2 also incidentally proves the checkbox↔highlight sync for the
      fact-provenance toggles for real, no scratch data needed: this
      card's 5 real facts are ALL parser-derived ("other" bucket, default
      OFF) — default state shows ZERO underlined phrases at all; toggling
      "other" on/off shows/hides all 4 annotated facts' underlines
      together, in sync with the table rows.
    - fin/252 (Adventurer's Airship) used as a second, richer case (real
      pool card, not scratch/throwaway data — none needed): 4 parser-
      derived facts including a genuine NESTED overlap (`crew` fact spans
      the whole "Crew 2 (...)" reminder-text line 0-137; `grantType` fact
      spans 89-135, wholly inside it) — confirmed toggling "other" renders
      3 correctly-partitioned segments (plain / nested-both / tail) and
      toggling off removes all of them, table and text in lockstep.
  - `npx nuxt typecheck` clean (pre-existing unrelated `mana.ts`/
    `tokens/by-key.ts` errors confirmed present independent of this work,
    same as the first pass); `factOrder.test.ts`/`factConditions.test.ts`
    (40 tests) still pass unchanged.
  - Files touched beyond the first pass: `app/components/
    FunctionalModelText.vue` (new prop + segment/highlight logic — this
    file was explicitly NOT touched in the first pass per the then-current
    "don't add to printed card content" constraint; this follow-up's
    explicit ask to wire click/hover-highlight supersedes that for this
    one case, since a highlight IS the standing "annotations are the one
    exception" carve-out), `app/components/CardDetailTabs.vue`,
    `app/lib/factOrder.ts` (`NON_FACT_SPAN_KIND_LABEL`, re-exported
    `AnnotatedNonFactSpan`).

- 2026-09-16: `annotatedNonFactSpans` (`progress.json`'s new 2026-09-16
  annotation-taxonomy field — real oracle-text spans deliberately fact-less,
  `kind: 'definition-path'|'rules'|'lore'`) is now served end-to-end and
  surfaced on the Facts tab.
  - **API**: `server/api/card/[set]/[number].ts` gained an exported
    `AnnotatedNonFactSpan` type (defined locally there, no shared TS type
    existed for `progress.json` fields before this) and a new
    `FunctionalModelData.annotatedNonFactSpans: AnnotatedNonFactSpan[]`
    field (always an array, `[]` when absent) — read in BOTH the dev branch
    (`progress.json` parse) and the prod branch (`fmBundle[slug]`).
    `server/utils/fmBundle.ts`'s `FmBundleEntry` and
    `scripts/build-fm-bundle.mjs` both updated to carry it through too
    (verified via a scratch-output run of the real script, not just read —
    ultima-origin-of-oblivion's real entry round-trips correctly). **Did
    NOT regenerate/commit the real `data/functional-model/fm-bundle.json`**
    — deliberately left for a separate regen pass, since the working tree
    already has a large amount of unrelated in-flight engine-side
    dirty/uncommitted state (many `synergy.json`/`trace.json` files) that
    running `npm run sync:fm-bundle` for real would sweep into that JSON
    file's diff. The new field defaults to `[]` harmlessly until that's
    next run — same staleness contract every other bundle field already
    has. `app/lib/cardResponse.ts` (the shared client-side `CardResponse`
    type — a SEPARATE hand-kept interface from the server route's own
    `FunctionalModelData`, easy to miss) needed the same field added too;
    `nuxt typecheck` catches it if it's ever missed here again.
  - **UI**: `app/components/CardDetailTabs.vue`'s Facts tab gained a 4th
    toggle (`showAnnotatedNonFactSpans`, default OFF, persisted the same
    localStorage/store way as the existing 3 fact-provenance toggles — new
    `useGraphStore.ts` ref, own storage key). Rows for these spans are NOT
    `Fact`s (no `role`, no source/sink icon) — rendered with a small badge
    naming `span.kind` and the `note` text as the row's content, same
    4-column row shape, only a raw-JSON debug button (no copy-context
    button, no oracle-text highlight — there's no `Fact` for
    `FunctionalModelText.vue`'s own highlighting to key off).
  - **Ordering** (the part worth remembering if this ever needs touching
    again): `app/lib/factOrder.ts`'s `orderByTextPosition` went generic
    (`<T extends DisplayRow>`, a new `FactRow | NonFactSpanRow` union) so a
    span row can slot into the exact same text-ordered list as real facts,
    never a separate section (per
    `feedback_facts_text_order_role_icon_only`). Preserving the pre-existing
    "hiding a row via a toggle must never reorder the rows that stay
    visible" property required care: `CardDetailTabs.vue`'s renamed
    `orderedAllDisplayRows` computed always includes non-fact span rows
    (append AFTER all fact rows per face group, before the ONE
    `orderByTextPosition` call), regardless of the toggle's state — the
    toggle only ever filters the already-fully-ordered result
    (`factRowGroups`), it never re-sorts. Live-verified via Playwright
    against fin/2 (ultima-origin-of-oblivion): toggling "non-fact spans" on
    interleaves the one real span row correctly between its "Counters"
    fact (same oracle line, earlier offset) and its "Mana production"
    facts (next line) — order of the surrounding fact rows was confirmed
    byte-identical before/after toggling, both with the span toggle alone
    and combined with the pre-existing "other" (parser-fact) toggle.
  - **Contract**: `.claude/contracts/api-contract.md` gained a new
    `GET`/`POST /api/card/:set/:number` section documenting this field (that
    file previously had no section for this route at all, despite it being
    the single largest served payload in the app).
  - Only one real pool entry exists (`ultima-origin-of-oblivion`, fin/2) —
    everything above is generically correct for more entries, not hand-fit
    to that one case (confirmed via the ordering design above, which never
    assumes "at most one span").

- 2026-09-13 (latest #3, recognizer-source viewer reintroduced as a
  dedicated debug-column button, after the icon-inversion pass below (#2's
  hover-popover-on-the-wand-sparkles-badge design) was itself later
  inverted and its popover machinery deleted): the wand-sparkles icon in
  the role column now marks the OPPOSITE thing (agent-authored, no
  provenance — plain `title`, no popover, see the icon-inversion commit),
  which left parser-derived facts with no UI at all for "show me the
  recognizer." Rebuilt as a **third icon in the `SHOW_FACT_DEBUG_COLUMN`
  cell** (`app/pages/app/card/[set]/[number].vue`, next to the existing
  copy/braces icons), `lucide:scroll`, `v-if="isParserFact(row.fact)"` only
  (no icon at all for an agent-authored row — not disabled/greyed, per the
  task's own instruction not to clutter those rows).
  - Click opens a **new, separate `UModal`** (not the existing
    `debugModalOpen`/JSON one — that one is JSON-only via `JsonHighlight`;
    this one renders real TS source via `FunctionalModelScript`, wrong
    content type for the JSON modal to grow a mode-switch for) —
    `recognizerSourceModalOpen`/`recognizerSourceModalRule`/
    `recognizerSourceModalCode`/`recognizerSourceModalError`/
    `recognizerSourceModalLoading` refs, `openRecognizerSourceModal(rule)`
    fetches `GET /api/recognizer-source/${rule}` via `$fetch`, cached in a
    plain (non-reactive) per-page-lifetime `Map<string,string>`
    (`recognizerSourceCache`) keyed by rule — confirmed live via Playwright
    that a second open of the same rule issues zero network requests.
  - **ofetch error-shape gotcha, worth remembering**: a `FetchError`'s own
    `.statusMessage`/`.statusText` fields are the raw HTTP status TEXT
    ("Not Found"), NOT the JSON error body's `statusMessage` field h3's
    `createError()` sets server-side ("Unknown recognizer" etc) — that
    real message is under `err.data.statusMessage`/`err.data.message`
    instead (`err.data` = ofetch's parsed response body). Got this wrong on
    a first pass (extracted `err.statusMessage`, silently showed the
    useless generic "Not Found" for every error), caught via a
    route-mocked Playwright check simulating a real 404 body, fixed to read
    `err.data` first.
  - Verified live on fin/1 (Summon: Bahamut, 7 real parser-tagged facts
    once the "Show parser-derived facts" checkbox is on): scroll icon
    appears on exactly the 7 parser rows and is absent from the 3
    agent-authored rows with duplicate-looking labels ("Dies"/"Card
    draw"-adjacent/"Battlefield presence"/"Damage" — the ones carrying the
    wand-sparkles icon instead); clicking shows real, correctly-matched
    recognizer source (`destroy-effect-structural`, confirmed by content,
    not just by title) with hljs syntax highlighting; error path verified
    via a mocked 404 response, shows an in-modal message, no throw/silent
    failure. `npx nuxi typecheck`: same 2 pre-existing baseline errors
    (`functional-model/mana.ts`, `server/api/tokens/by-key.ts`), nothing
    new from this change.

- 2026-09-13 (recognizer-source popover on the parser-fact
  badge + showParserFacts persistence, follow-up to the entry just below —
  **superseded by the entry above**, this popover/badge design was itself
  later removed when the wand-sparkles icon's meaning was inverted; kept
  here only as history):
  - **Filename convention confirmed for real**: both existing recognizers
    (`functional-model/recognizers/instant-sorcery-resolves-to-graveyard.ts`,
    `.../permanent-enters-battlefield-normally.ts`) have a filename that is
    exactly their `RecognizerId`/`Fact.provenance.rule` string + `.ts` — no
    exceptions found. New `RecognizerId` values must keep this invariant or
    the new server route below silently 404s them (allowlist is hand-kept,
    not derived from the filesystem).
  - **New `server/api/recognizer-source/[rule].get.ts`**: same
    explicit-allowlist shape as `server/api/docs/[slug].get.ts` (a
    hand-maintained `RECOGNIZER_IDS: RecognizerId[]` array, not a directory
    listing/glob) — `GET /api/recognizer-source/:rule` → `{ rule, content }`
    (raw file text) or 404 for anything not on the list, verified live
    (unknown rule id, and a `..`-path attempt — router itself already
    doesn't hand a literal `..` through as a clean `:rule` segment, but the
    allowlist check is what actually gates it either way, not string
    shape). Read-only, dev-and-prod both (no `NODE_ENV` gate unlike
    `docs/*` — recognizer source isn't sensitive and the badge/toggle it
    backs isn't dev-only either, so gating this alone would just break the
    feature in production for no real benefit).
  - **Badge → real popover**: the old plain `title="Parser-derived — rule:
    ..."` on the `lucide:wand-sparkles` icon is now a `UPopover
    mode="hover"` (`openDelay=200` to avoid flashing while scanning the
    column) whose `#content` renders the rule name plus a
    `FunctionalModelScript` instance (same component/hljs styling the
    Script tab and `/docs` already use — no new CSS) fed by a small
    per-rule fetch-once cache (`recognizerSourceCache`/
    `recognizerSourceError` refs, `ensureRecognizerSource(rule)` called from
    `@update:open`). Verified live via Playwright against fin/212 (Absolute
    Virtue, `permanent-enters-battlefield-normally`): hovering the badge
    shows the real recognizer source, syntax-highlighted, matched to the
    correct rule.
  - Template narrowing gotcha under this repo's
    `noUncheckedIndexedAccess: true`: bare `cache[rule]` bracket access in
    two separate template spots (`v-if` + `:code`) doesn't narrow away
    `undefined` reliably — used plain wrapper functions
    (`recognizerSource(rule)`/`recognizerSourceErrorFor(rule)`) instead of
    direct index expressions, which narrow cleanly.
  - **`showParserFacts` moved from a page-local `ref` onto the shared
    store** (`app/composables/useGraphStore.ts`, mirrors
    `functionalModelTab`'s own existing pattern exactly): new
    `SHOW_PARSER_FACTS_STORAGE_KEY = 'mtg-visualizer-show-parser-facts'`
    (not set-namespaced — same "standing UI habit" reasoning as the tab
    key), persisted via `watch` + `localStorage`, restored on store init.
    The page now does `const showParserFacts = store.showParserFacts;`
    (still a plain ref, template auto-unwraps it same as any other
    top-level `<script setup>` binding) instead of owning its own ref.
    Verified live: toggling writes `'true'` to
    `mtg-visualizer-show-parser-facts` immediately, survives a full page
    reload within the same browser session.
  - Checkbox nudged `ml-[0.5em]` per direct ask (was flush against the
    table's own left edge).
  - `npm run typecheck`: same 2 pre-existing baseline errors
    (`functional-model/mana.ts`, `server/api/tokens/by-key.ts`), nothing
    new. Relevant vitest suites (`factConditions.test.ts`,
    `functional-model/recognizers`) pass unchanged.

- 2026-09-13 (Facts tab parser-derived-fact toggle +
  provenance badge, `PRD_AUTOMATED_AUTHORING.md`): new optional
  `Fact.provenance?: { origin: 'parser'; rule: string }` (engine-owned,
  `functional-model/synergy.ts` — see `.claude/contracts/card-schema.md`'s
  "Parser-derived facts" section) now rides on 435 real facts across
  202/323 pool cards; server already passed it through as-is
  (`server/api/card/[set]/[number].ts` untouched, verified live against
  fin/196 A Realm Reborn).
  - `app/pages/app/card/[set]/[number].vue`: new `showParserFacts` ref
    (default `false`), `isParserFact()`, `parserFactsCount` (total count,
    NOT "currently hidden" — a hidden-count would go to 0 the instant the
    toggle flips on and make its own guard/label vanish, a real bug caught
    during this task). A `UCheckbox` above the Facts table (only rendered
    when `parserFactsCount > 0`) reads "Show parser-derived facts (N)".
  - Filtering lives in `factRowGroups` (toggle-filtered render only) —
    split out a separate `orderedAllFactRows` (unfiltered, text-ordered)
    that `factOrderIndex` now reads instead, so the Interactions panel
    below (which sorts against `factOrderIndex`) doesn't silently
    mis-sort/drop-to-end a real interaction whose own fact happens to be a
    currently-hidden parser fact. Toggling never splits the Facts list
    into two sections — parser facts interleave into the SAME
    text-ordered table (`feedback_facts_text_order_role_icon_only`
    convention held, verified live via Playwright: row order unchanged
    before/after, one `<tbody>`, no new group header).
  - Provenance detail: small `lucide:wand-sparkles` badge (violet) next to
    the existing source/sink role icon, `title="Parser-derived — rule:
    <rule>"`, only ever rendered on a row that's already visible (a parser
    row doesn't reach the table at all while hidden, so no extra
    conditional needed there).
  - `app/lib/factConditions.ts`: added `'provenance'` to
    `HANDLED_OR_LABEL_KEYS` — without this, the generic "unknown field"
    fallback loop (`formatUnknown`) rendered a redundant raw
    `provenance: origin parser, rule ...` string in the same row's notes
    column, right next to the new badge (caught live, not just by
    reasoning about the code — first Playwright pass showed the
    duplication before this fix). New test in
    `app/lib/factConditions.test.ts` locks this down.
  - No per-fact human-review affordance exists anywhere today to exclude
    parser facts from — `progress.json`'s `review` field
    (`server/api/card/review-status.ts`) is per-CARD only
    (`'ai'|'human'`), confirmed via the contract file and this file's own
    review-status code; nothing invented, per the task's own instruction
    not to build one if none exists.
  - Verified live (dev server + Playwright, fin/196 A Realm Reborn):
    toggle off -> 1 row (hand-authored `Battlefield presence` only, its 2
    parser siblings `Cast a spell`/`Enters the battlefield` hidden);
    toggle on -> all 3 rows, badge+tooltip present, conditions column
    clean. `npx vitest run` unaffected (same 5 pre-existing
    `scripts/relations.test.mjs` failures with or without this change,
    confirmed via `git stash`; unrelated tagging-sweep fixture files
    absent from this checkout, not a regression). `npm run typecheck`:
    same 2 pre-existing baseline errors (`functional-model/mana.ts`,
    `server/api/tokens/by-key.ts`), none new.
  - `FunctionalModelText.vue`'s oracle-text overlay was deliberately left
    untouched — it sits above the tabs, not part of the Facts tab itself,
    so a parser fact's annotation still highlights inline regardless of
    the toggle. Flagging in case a future task wants that overlay to
    respect the toggle too — not requested this time, scope was
    Facts-tab-only.

- 2026-09-12 (Previous/Next walks unique cards only + header row
  never hides behind the loading spinner): Two related asks against
  `app/pages/app/card/[set]/[number].vue`.
  - **Task 1 — Previous/Next skip bonus/variant collector numbers.** FIN
    reuses collector numbers 300+/400+/500+ for booster-fun/showcase/
    extended-art/surgefoil re-treatments of the SAME card (Aerith
    Gainsborough: #4 base, #374/#423/#519 bonus variants) — plain ±1 on
    `:number` (the old default-path fallback, no filter active) walked
    through these as separate "stops." Per the task's own explicit
    definition, "mechanically unique" = Scryfall's own `unique=cards`
    one-printing-per-name collapse, already relied on elsewhere in this repo
    (`server/api/cards.ts`, `server/api/cards/by-names.ts`,
    `server/api/card/[set]/[number].ts`'s own `fetchStandardPrintForName`) —
    reused that convention rather than inventing an oracle_id/name-based
    de-dup rule.
    - **New generic server route,
      `server/api/cards/set-order/[set].ts`**: `GET /api/cards/set-order/:set`
      -> `{ collectorNumbers: string[]; representativeByNumber: Record<string,
      string> }`. Dev/local path reads `data/cards.db` (the same gitignored,
      `scripts/sync-card-db.mjs`-synced bulk mirror
      `server/api/card/[set]/[number].ts`'s own `cardsDb` already reads) —
      groups every English-language row for the set by NAME, picks one
      representative per name via the exact same `is_normal DESC,
      released_at DESC` tie-break that file's own `dbExactNameStmt` already
      uses for the identical "prefer the standard/normal-art printing"
      purpose, sorts the resulting numbers by leading numeric prefix. Also
      builds `representativeByNumber`, mapping EVERY real printing's own
      number (including a bonus one) to its representative — this turned out
      load-bearing, see the "real gap found" note below. Falls back (no local
      DB — always true in prod, Netlify Functions never ship
      `data/cards.db`) to a live, paginated Scryfall search
      (`set:<set>&unique=cards`), same polite-pagination shape
      `server/api/cards.ts`'s own search loop already uses; documented
      in-file that this path's own `representativeByNumber` is identity-only
      (Scryfall's `unique=cards` doesn't expose the OTHER printings of a
      name it collapsed away, so there's nothing to map bonus numbers from
      on this path) — an accepted degradation, not a bug, only reachable when
      the local DB is absent.
    - **New client cache, `app/composables/useSetOrder.ts`**: module-scope
      `Map<string, Promise<SetOrderData>>` (same "outlives one component
      instance, keyed by set code" shape this file's own doc comment
      compares to `server/api/card/[set]/[number].ts`'s `cardMetaCache`) —
      fetches once per set code, caches the in-flight PROMISE (not just the
      settled value) so concurrent callers for an uncached set share one
      request. Verified live (Playwright): exactly 1 `/api/cards/set-order/`
      request across an initial load + 4 Previous/Next clicks within FIN.
      Exported `neighborsInSetOrder(data, current)` is the actual stepping
      logic.
    - **Real behavioral gap found and fixed mid-task, not just "de-dup the
      list": a bonus/variant number needs to resolve to its CARD'S OWN TRUE
      POSITION, not its own raw number, when computing neighbors.** First cut
      only shipped the de-duped `collectorNumbers` list and treated the
      current URL number as a plain "insert point" via numeric betweenness.
      That's correct when Previous/Next arrives at a bonus number by
      stepping there from its base card, but WRONG for a direct visit to a
      bonus number itself (e.g. loading `/app/card/fin/374`, Aerith's own
      showcase print, directly): betweenness against the RAW number 374
      landed neighbors at #309/#482 (numerically nearest OTHER unique cards,
      a huge meaningless jump), not Aerith's real neighbors #3/#5. Fixed by
      having the server also emit `representativeByNumber` (every printing,
      including bonus ones, mapped to its own representative) — the client
      now anchors on `representativeByNumber[current] ?? current` before
      indexing into `collectorNumbers`, so viewing Aerith at #4, #374, #423,
      or #519 all produce the IDENTICAL #3/#5 Previous/Next pair. Verified
      live (Playwright, dev server): `/app/card/fin/374` — Previous href
      `/app/card/fin/3`, Next href `/app/card/fin/5`, clicking Next actually
      lands on `/app/card/fin/5`. Sequential walk from `/app/card/fin/1`
      clicking Next 5 times: `#1,#2,#3,#4,#5,#6` (below the bonus range,
      unaffected). At `#1`, Previous correctly renders disabled (no
      wraparound). `nearestNumericNeighbors` (the old betweenness logic) kept
      as a fallback ONLY for a number with no `representativeByNumber` entry
      at all (an unresolvable/typo'd number, or the live-Scryfall-fallback
      path where the map is identity-only).
    - **Loading-state decision, documented in the page's own new comments**:
      while the one-time per-set fetch is still in flight
      (`setOrderLoaded === false`), Previous/Next render DISABLED (same look
      as either edge of the set) rather than showing a transient plain-±1
      target that would visibly change out from under the user the instant
      the real list lands. Only once the fetch has settled AND come back
      genuinely empty (network hiccup, or a set this route can't resolve at
      all) does it fall back to the old plain ±1 arithmetic, as a safety net
      rather than leaving Previous/Next permanently dead.
    - Deliberately did NOT touch `filterOrder`/`filterIndex` (the
      deck-import/Scryfall-query active-filter path) at all — confirmed via
      diff review that only the no-filter default branch of
      `prevTarget`/`nextTarget` changed.
  - **Task 2 — header row never hides behind the loading spinner.** The
    entire page content, including the "← Back to graph" link and the
    "← Previous / #N / Next →" row, used to sit behind
    `v-if="pending && !hasLoadedCard"` inside `template v-else` — a
    Previous/Next click blanked the WHOLE page (including its own trigger
    controls) back to a spinner. Moved the header `<div>` block out to sit
    unconditionally at the top of the outer wrapper, before the
    pending/error/loaded branches — nothing in it actually depends on
    `card`/`data` having resolved (`deckQty` already self-guards via its own
    `v-if`, `currentNumber` reads straight off the route param,
    `prevTarget`/`nextTarget` are route/setOrder-derived). The
    `hasLoadedCard`/pending spinner-flash-avoidance gate is UNCHANGED in
    behavior, just now only covers the actual card-detail content below the
    header (CardMedia, review-status table, functional-model tabs,
    Interactions, ...). Verified live (Playwright): `document` still shows
    "Back to graph" (`isVisible() === true`) immediately after a Next click,
    before the new card's fetch resolves.
  - `npm run typecheck`: 0 new errors in any file this task touched (2 real
    ones surfaced mid-task from a `RegExpExecArray` capture-group typing
    quirk — `m[1]` typed `string | undefined` even though the code's own
    logic guarantees it matched; fixed both the server route and the
    composable by reading `m[0]` — the whole match, identical value for an
    unnamed all-digits group — instead of `m[1]`). Only remaining error is
    the same pre-existing, confirmed-not-mine `server/api/tokens/by-key.ts`
    `u_3_3_robot_warrior` gap logged repeatedly below (confirmed via
    `git status` — that file isn't in this task's own diff at all, a
    concurrent `functional-model/tokens.ts` edit is). `npx vitest run
    app/lib`: 69/69 pass. Full `npx vitest run`: one unrelated pre-existing
    failure (`scripts/relations.test.mjs`, missing
    `tagging/card-enrichment-status.json`) confirmed via `git stash` to fail
    identically on the pre-task tree too — not caused by this change.
  - **No `.claude/contracts/*.md` mismatch** — this task added a new
    server↔client data shape entirely within the card domain's own lane
    (a plain per-set collector-number list/map, nothing engine-served), no
    existing contract describes or needs to describe it.
  - Scope: new files `server/api/cards/set-order/[set].ts`,
    `app/composables/useSetOrder.ts`; touched
    `app/pages/app/card/[set]/[number].vue` (script: new setOrder
    load/cache wiring, `prevTarget`/`nextTarget` no-filter branch rewritten;
    template: header row hoisted above the pending/error/loaded gate) plus
    this notes file. Did not touch `functional-model/`, any other
    `.vue`/`server/api` file, or the deck/query `filterOrder` logic.

- 2026-09-12 (latest, face-aware printed keywords — fin/13 Crystal
  Fragments front-face false-Flying badge, fin/16 Dion follow-up): Fixed
  the exact bug flagged (not fixed) at the end of the same-day
  `continuousKeywordGrants` entry below — `printedKeywords()` badged a
  transform DFC's CURRENT face with the OTHER face's own keyword.
  - **Root cause, more subtle than it first looked**: the code read
    `card.keywords`, Scryfall's raw WHOLE-card field, which for a
    transform DFC is already the union of both faces'. The obvious fix
    ("read `card_faces[i].keywords` instead") doesn't work — confirmed
    live against Scryfall's real `/cards/<set>/<num>` API for several FIN
    transform DFCs (Crystal Fragments, Dion, Jill, Cecil, Kefka, and the
    other ~20 transform DFCs in the set) that Scryfall **never serves a
    per-face `keywords` array at all**, only the whole-card top-level one
    — `card_faces[i].keywords` is always `undefined`, so a naive per-face
    read would silently return `[]` for EVERY face, hiding a real
    printed keyword like Bahamut's back-face Flying entirely instead of
    just misattributing it.
  - **Fix — `app/lib/buildGraph.ts`'s new `cardFaceKeywords(card, face)`**:
    scans that face's own `oracle_text` for a STANDALONE keyword line (the
    MTG frame convention — a printed keyword ability is always its own
    line, comma-separated if more than one, optionally with a trailing
    cost/number like "Ward {2}"/"Crew 1", reminder text either on its own
    line or trailing the keyword on the SAME line with no comma — both
    stripped before matching), restricted to keywords `card.keywords`
    already confirms the card genuinely HAS somewhere (so a face can never
    pick up a bare word the whole card doesn't actually carry as a real
    keyword). This is what correctly tells apart Dion, Bahamut's Dominant's
    front face — which only MENTIONS "flying" inside a full sentence
    ("Dragonfire Dive — During your turn, Dion and other Knights you
    control have flying," a CONTINUOUS turn-conditional grant, handled by
    the separate `continuousKeywordGrants`/`continuousGrantedKeywords`
    mechanism, not a static keyword) — from its back face Bahamut, which
    prints "Flying" as its own bare line. Verified pool-wide (throwaway
    Node script against `data/fin/fin_scryfall.json`) across all ~26 FIN
    transform DFCs: zero missed keywords vs. the old whole-card union
    (every real keyword still attributed to SOME face) and zero false
    positives (Dion's own front face, the one case with a same-word grant
    sentence, correctly stays empty).
  - **Threaded through**: `server/api/card/[set]/[number].ts`'s
    `CardData.keywords` now uses `cardFaceKeywords(card, 0)` (front) instead
    of the old whole-card `cardKeywords(card)`; new `CardData.backKeywords`
    (`cardFaceKeywords(card, 1)`, undefined with no second face) mirrors the
    existing `backPower`/`backToughness` convention. `app/types.ts`'s
    `CardData` gained the new field + a doc-comment caveat that
    `buildGraph.ts`'s own separate whole-graph node builder deliberately
    keeps the UNION for its own independently-constructed `CardData` shape
    (a graph node badge means "has this ability somewhere," not
    "on the currently-shown face" — not a bug, a different, correct,
    out-of-lane (`ui`) use of the same type). Card page → `ScenarioReplay.vue`
    → `ScenarioReplayTrace.vue`: new `cardBackKeywords` prop threaded
    alongside the existing `cardKeywords`/`cardPower`/`cardBackPower` set;
    `printedKeywords()` now picks `cardBackKeywords` once `card.faceName`
    shows the self chip has transformed (same `flipped` check `ptFor`
    already uses for power/toughness) instead of always reading the front
    prop. Also fixed the same bug class for a real BYSTANDER card (not just
    the tested "self" card): `ScenarioReplay.vue`'s own `extraArt` builder
    (feeds `namedCardArt`/`iconKeywords` for any other real card a scenario
    references by name) used the same wrong `c.keywords` whole-card read;
    switched to `cardFaceKeywords(c, 0)` (a bystander is always shown
    printed/front-face — this replay model has no mechanism for a non-self
    card to transform mid-scenario). `server/api/_cardShaping.ts`'s shared
    `CardFace`/`minimalCard()` (used by both `cards.ts` and
    `cards/by-names.ts`) gained a passthrough `oracle_text` field — it had
    been stripped entirely (this file's own header comment: "shrink to only
    what buildGraph.ts reads," which didn't need per-face oracle text until
    this task), needed for `cardFaceKeywords` to have anything to scan for a
    bystander fetched via `/api/cards/by-names`.
  - **Verified live** (Playwright, throwaway scripts at repo root, deleted
    after) against the already-running dev server, stepping fin/13's real
    scenario with the Forward button: front chip (Crystal Fragments) has
    ZERO ability-icon `<svg>`s at every step before transform; back chip
    (Summon: Alexander) shows exactly one `<svg>` (Flying) from the
    transform step onward. fin/16 (Dion) spot-checked the same way — front
    chip's OWN printed-keyword contribution confirmed empty at every step
    (the on/off flying icon actually observed on Dion's own chip across
    turns is the separate, pre-existing, correctly-still-working
    `continuousGrantedKeywords` mechanism firing per `onlyDuringYourTurn`,
    not this fix — confirmed by reading the served `continuousKeywordGrants`
    JSON directly, `includeSelf: true`, which is in fact semantically
    correct: the real oracle text says "Dion **and other Knights**... have
    flying," including Dion himself, just conditionally/via a grant rather
    than a static keyword). Also re-verified via direct `/api/card/fin/<n>`
    curl calls for all ~26 FIN transform DFCs (Crystal Fragments, Dion,
    Jill, Cecil, Kefka, Sephiroth, Vincent Valentine, Zenos, Clive, Emet-
    Selch, Exdeath, Garland, Joshua, Kuja, Serah, Terra, Ultimecia, Balamb
    Garden, the various Sidequest lands, ...) — every front/back split now
    matches the real card's own actual printed keywords, no card left with
    a wrong or dropped badge.
  - `npm run typecheck`: zero new errors in any file this task touched.
    Two pre-existing, confirmed-not-mine failures at check time: the
    long-standing `server/api/tokens/by-key.ts` `u_3_3_robot_warrior` gap
    (logged repeatedly below), and a NEW-that-session
    `functional-model/state.ts` `untilEndOfTurnKeywordGrants` error —
    confirmed via `git status`/`git diff --stat` that `state.ts` was
    already dirty (a concurrent `engine` session's own in-flight,
    uncommitted work) before and unrelated to anything touched here; not a
    file in this task's own diff at all. `npx vitest run app/lib`: 68/68
    pass.
  - **No `.claude/contracts/*.md` mismatch** — `CardData`/`card-schema.md`
    don't describe this specific field's face-scoping either way; nothing
    there was wrong, just under-specified for a case that hadn't come up
    before. Not adding a new contract entry unprompted (out of this
    session's own ask), but worth a future note if another specialist
    trips on the same "Scryfall doesn't serve per-face keywords" surprise.
  - Scope: touched `app/lib/buildGraph.ts`, `app/types.ts`,
    `server/api/card/[set]/[number].ts`, `server/api/_cardShaping.ts`,
    `app/components/ScenarioReplay.vue`, `app/components/
    ScenarioReplayTrace.vue`, `app/pages/app/card/[set]/[number].vue` (one
    new prop wired through), plus this notes file. Did not touch
    `functional-model/` or the keywords-coverage page
    (`KeywordEntryCard.vue`/`server/api/keywords/index.get.ts`) — the
    latter has the exact same bug class (`keywords: card.keywords ?? []`,
    confirmed via grep) but lives outside this domain's file list; flagging
    for whichever agent owns it (`ui`, per the keyword-coverage-page project
    note) rather than fixing it here.

- 2026-09-12 (latest, Facts-tab copy button rework — full context string +
  spacing fix): Two related requests on the same Facts-tab copy button added
  earlier the same day (see the "reverted hidden-text ... real copy-icon
  button" entry below): (1) "copy button for fact is pretty useless now" —
  it copied only the bare role marker ("SO"/"SI"); wanted the full row
  context instead. (2) "add some padding to the right of that button, so
  that I don't hit json instead" — it sat flush against the adjacent
  debug-JSON braces icon in the same cell.
  - **Task 1 fix**: reworked `copyRoleMarker`/`copiedRoleKey` (renamed
    `copyFactContext`/`copiedFactKey`) in
    `app/pages/app/card/[set]/[number].vue`. New `factContextText(row)`
    builds `` `${cardRef} #${rowNumber} ${label}[ · ${conditions}]` `` —
    `cardRef` is `${route.params.set}/${route.params.number}` (e.g.
    `fin/21`), `rowNumber` is 1-based off the ALREADY-EXISTING
    `factOrderIndex` computed (built for the Interactions panel's own
    reordering) — the fact's position in the table's actual DISPLAYED order,
    not raw synergy.json source/sink array order — and `label`/`conditions`
    are the exact same `factLabel(row.fact)`/`factConditions(row.fact)` calls
    the row's own label/notes `<td>`s already render (reused, not
    reformatted from raw JSON, per the task's own explicit ask). Verified
    live real output on fin/21's 3rd displayed fact row: clipboard read back
    exactly `"fin/21 #3 Dying · yours · (Creature/Artifact) permanent · once
    per turn"` — matches the requested shape byte-for-byte.
  - **Task 2 fix**: reordered the two icons in the shared debug `<td>` — copy
    now comes FIRST (left) with its own `mr-2` on top of the existing
    `gap-1.5` wrapper gap, braces/JSON second (right). Chose reorder+own-margin
    over just widening the shared gap so the literal "padding to the right of
    that [copy] button" wording is satisfied exactly (previously copy was
    the RIGHTMOST icon, so a right-margin on it alone wouldn't have separated
    it from JSON, which sat to its left) — copy is also the more-used button
    per the user's own framing, so giving it the left/first slot reads
    naturally. Verified live via bounding boxes: icon gap widened from the
    old flush `gap-1.5` (6px) to 14px (`mr-2`'s 8px + the wrapper's own
    6px gap) between copy's right edge and braces' left edge.
  - Verified live (Playwright, throwaway script at repo root, deleted after)
    against the already-running dev server, fin/21: clipboard content
    confirmed exact as above; screenshot confirms visible checkmark click
    feedback and clear spacing between the two icons.
  - `npm run typecheck`: only the same pre-existing, unrelated
    `server/api/tokens/by-key.ts` `u_3_3_robot_warrior` error already logged
    in the entry below (not touched by this task). No test suite covers this
    template-only change; didn't add one (no existing `.test.ts` exercises
    this `.vue` file's button handlers).
  - Scope: touched only `app/pages/app/card/[set]/[number].vue` + this notes
    file.
  - No `.claude/contracts/*.md` mismatch — pure client-side display/
    interaction change, no engine-served shape touched.

- 2026-09-12 (latest, `untilEndOfTurn` camelCase display bug): Same bug
  class as the earlier same-day `preventDamage`/`grantKeyword`/`grantType`
  raw-label fixes, but this one was in the CONDITIONS/notes column
  (`app/lib/factConditions.ts`), not the label column (`describeFact` in
  `functional-model/synergy.ts`) those were. `Fact.untilEndOfTurn?: boolean`
  (documentary-only field `engine` added earlier the same day) had no
  branch in `factConditions()` and no entry in `HANDLED_OR_LABEL_KEYS`, so
  it fell through to the generic `formatUnknown` fallback loop and rendered
  as the raw field name `untilEndOfTurn` instead of a phrase — reported
  live on fin/27 (Moogles' Valor)'s Grant keyword row.
  - **Fix**: mirrored the exact existing `tapped`/`oncePerTurn` pattern
    (both already handled the same way): added `'untilEndOfTurn'` to
    `HANDLED_OR_LABEL_KEYS` (suppresses the generic fallback) and a new
    `if (fact.untilEndOfTurn) bits.push('until end of turn');` line right
    after the `oncePerTurn` branch, inside the same `isEventFact(fact)`
    block (the field only lives on `EventFact` per `synergy.ts`'s own
    doc comment, same as `tapped`/`oncePerTurn`).
  - **Pool-wide confirmed**: `grep -rl '"untilEndOfTurn": true'
    functional-model/cards/*/synergy.json` → 12 cards (cargo-ship,
    restoration-magic, the-lunar-whale, summon-choco-mog, moogles-valor,
    magic-damper, the-prima-vista, zack-fair, the-wind-crystal,
    summon-knights-of-round, magitek-armor, summon-primal-garuda) — the fix
    is in the shared `factConditions()` function, applies to all of them
    identically, not a per-card patch.
  - **Verified live** (Playwright, throwaway scripts at repo root, deleted
    after) against the already-running dev server: fin/27, fin/30
    (Restoration Magic), fin/43 (The Wind Crystal) — each Facts tab now
    shows "until end of turn" in the conditions column, zero raw
    `untilEndOfTurn` text anywhere on any of the three pages. fin/27's
    exact Grant keyword row confirmed: "yours · creature permanent · until
    end of turn · keyword: Indestructible · not targeted".
  - **Real, unrelated, engine-owned type gap found along the way, flagged
    not fixed (out of lane)**: `grantKeyword` facts' own `keyword: string`
    field (e.g. `moogles-valor/synergy.json`'s `{"event": "grantKeyword",
    "keyword": "Indestructible", ...}`) is written pool-wide but is NOT a
    declared property anywhere on the `Fact` type in
    `functional-model/synergy.ts` (confirmed via grep — no `keyword` field
    declaration exists, only the string `'grantKeyword'` event-name
    literal and the word appearing in prose comments). Runtime is
    unaffected (it flows through as a plain untyped extra property, caught
    by `factConditions()`'s generic `formatUnknown` fallback same as any
    other undeclared field, rendering as `keyword: Indestructible` — this
    is in fact why my own test fixture had to drop a `keyword: ...` literal
    to pass `npm run typecheck`, since object-literal excess-property
    checking rejects it on a variable explicitly typed `Fact`). Not fixed
    here (`functional-model/synergy.ts` is `engine`'s lane) — worth a
    small follow-up there (`keyword?: string` alongside `type`/`color`/
    `counterType`'s own free-form-field pattern) so future authors get
    real type-checking on it instead of only JSON-shape convention.
    `.claude/contracts/card-schema.md` also doesn't mention this field at
    all; not flagging that as a contract error per se (the contract
    doesn't enumerate every free-form per-event field), just noting it
    alongside the type gap in case it's useful context for whoever picks
    up the `synergy.ts` fix.
  - `npm run typecheck`: same single pre-existing, unrelated failure both
    before and after this change (`server/api/tokens/by-key.ts` missing a
    `u_3_3_robot_warrior` entry in its per-key map — not a file I touched,
    not in `git status` as dirty from my own edits, some other concurrent
    session's in-flight token addition; zero errors in either file this
    task touched). `npx vitest run app/lib`: 65/65 pass (added 1 new case
    to `factConditions.test.ts`'s existing 64).
  - Scope: touched only `app/lib/factConditions.ts` +
    `app/lib/factConditions.test.ts`; did not touch
    `functional-model/synergy.ts` or any `synergy.json` (per this project's
    engine/card lane split — the `keyword` type gap above is a flag, not a
    fix, for that reason).

- 2026-09-12 (latest, `PlayerState.creatureCards` board-seeding gap +
  placeholder-label follow-ups): Fixed a real bug on fin/29 (Phoenix Down)
  scenario 2's replay — a real, specifically-named creature seeded via
  `functional-model/harness.ts`'s new `PlayerState.creatureCards` field
  (added same-day by an engine session, replacing a fabricated fake-Zombie
  Grizzly Bears — Qutrub Forayer, a real 3/2 Zombie Horror) didn't appear on
  the board at Start, only once the trace's own `moveTo` (to Exile) log
  entry happened to name it and fell through to `ensure`'s lazy-create path.
  - **Root cause confirmed**: `app/lib/scenarioReplay.ts`'s `seedPlayerCards`
    mirrors `harness.ts`'s `setupPlayer` field-for-field (per its own header
    doc comment) but had NO branch at all for `PlayerState.creatureCards` —
    a genuine gap, not a stale-data issue (`setupPlayer` itself already had
    the real loop).
  - **Fix**: added a matching loop to `seedPlayerCards` — `for (const c of
    ps?.creatureCards ?? []) push(c.name, 'Battlefield', [c.power ?? 1,
    c.toughness ?? 1])`, positioned identically (right after the
    token-creature filler loop, before `tokens`/`basicLands`) to
    `setupPlayer`'s own ordering.
  - **Pool-wide check**: grepped every `scenarios.ts`/`definition.ts` for
    `creatureCards` — exactly 2 cards use it: `phoenix-down` (this bug) and
    `louisoix-s-sacrifice` (Stiltzkin, Moogle Merchant, `you:` side) — the
    latter benefits from the same fix, not independently verified beyond the
    generic fix applying identically to both (same field, same seeding
    code).
  - **Verified live** (fresh dev-server restart — see stale-HMR note below
    — then Playwright, throwaway scripts at repo root, deleted after):
    fin/29 scenario 2 ("exiles the Zombie") — Qutrub Forayer now renders
    with real Scryfall art on OPP0's own battlefield at step 0/2 (Start),
    correct 3/2 P/T badge, title="Qutrub Forayer" — not just appearing
    retroactively once the Exile `moveTo` replays. Also confirmed directly
    via a standalone script calling the real `replayTrace()`/
    `groupForDisplay()` against the live `run-one-card.mjs` output (not just
    the browser) for both phoenix-down scenarios and restoration-magic's
    Curaga scenario.
  - **Stale dev-server HMR gotcha hit again** (NEXT_STEPS.md's own
    documented issue) — the long-running dev server (up since 2026-09-11,
    predating today's `GENERIC_FILLER_ARTIFACT` addition to `harness.ts` by
    a concurrent engine session) threw `SyntaxError: ... does not provide an
    export named 'GENERIC_FILLER_ARTIFACT'` in the browser console even
    though the source file plainly had it — restarted `npm run dev` (killed
    the stale PIDs, relaunched in background), confirmed clean after.
    Flagging since this is a SHARED dev server other sessions may also be
    using — did this only because the documented convention explicitly
    permits/expects it for this exact symptom, not a unilateral call.
  - **Coordinator-added follow-ups, same task, same file**:
    1. Fixed `seedPlayerCards`'s `plainArtifacts` loop, which had fallen out
       of sync with an ALREADY-LANDED `setupPlayer` change (same-day, a
       sibling fix for Restoration Magic's own Curaga scenario): `setupPlayer`
       already seeds a plain artifact as `GENERIC_FILLER_ARTIFACT` ("Mind
       Stone", a real card), but `seedPlayerCards`'s own mirror still pushed
       the old synthetic `${n}-artifact-${i}` name, producing a stub "Ar"
       placeholder chip. Fixed to match (`push(GENERIC_FILLER_ARTIFACT,
       'Battlefield')`), imported the constant. Verified live: fin/30
       (Restoration Magic) scenario 3's Mind Stone chip now resolves real art
       (no placeholder text at all).
    2. General "show full name, not a 2-letter stub" fix to
       `placeholderLabel()` per direct user request ("use full name on card
       as a fallback — so I have easier time communicating"): the function's
       final fallback (previously `displayName(card).slice(0, 2)`) now
       returns the full `displayName(card)` untouched. The short
       bucket-specific abbreviations (`Cr`/`Ld`/`Eq`/`Ar`/`En`/`?`) are kept
       ONLY for names still matching a genuinely-synthetic per-index pattern
       (no real card exists to name at all) — `-hand-`/`-library-` are
       already dead code today (both zones' own fillers already carry a real
       name), kept defensively for an older/unmigrated trace shape rather
       than deleted. This box only ever renders when the caller's own
       `imagesFor()` found no real art (an art-lookup miss, not proof the
       name is fake) — for anything with a real resolvable name, real art
       generally already wins over this fallback anyway (confirmed: Qutrub
       Forayer/Mind Stone/Grizzly Bears never actually reach this function
       live, since real art resolves for all three via the existing
       `autoNamedCardArt` mechanism — this fallback change mainly matters for
       a real name that DOESN'T have art available for some reason, or a
       future caller/edge case).
  - **Real, confirmed, engine-owned gap found — NOT fixed here, flagged for
    `engine`**: `harness.ts`'s `setupPlayer` own `graveyardCreatureCount`
    loop still seeds a purely synthetic `${n}-gy-creature-${i}` name (no real
    Scryfall identity at all) — same class of gap `GENERIC_FILLER_CREATURE`/
    `_LAND`/`_ARTIFACT` already fixed for their own buckets, just not yet
    done for this one. This is why fin/29 scenario 1 (mode 0, "returns a
    creature card from graveyard...") still shows a "Cr" placeholder chip
    live (confirmed, screenshot). Deliberately did NOT fix this myself even
    though it's the exact same shape of change as the artifact fix above —
    the NAME is produced by `harness.ts`'s own real trace log entries (an
    engine-lane file, `functional-model/`), and changing ONLY
    `scenarioReplay.ts`'s own mirrored seed name without a matching
    `harness.ts` change would break identity matching entirely (the seeded
    chip and the log's own `moveTo`/`tap` target name would no longer agree,
    producing a phantom duplicate chip instead of fixing anything) — needs a
    coordinated two-file change engine should own, not a one-sided
    card-lane patch.
  - `npm run typecheck`: only pre-existing error is `server/api/
    tokens/by-key.ts`'s `u_3_3_robot_warrior` `Record` mismatch — confirmed
    via `git stash`/re-run NOT caused by this task (disappears when
    stashing, since it comes from a concurrent engine session's own
    in-flight, uncommitted `tokens.ts` edit, unrelated to anything touched
    here). `npx vitest run app/lib`: 64/64 pass (unchanged assertions — no
    existing test covers `seedPlayerCards`/`placeholderLabel` directly).
  - Scope: touched only `app/lib/scenarioReplay.ts` + this notes file — no
    `functional-model/` or `.vue` changes.
  - **Contract note**: no `.claude/contracts/*.md` mismatch — `PlayerState.
    creatureCards` is plain harness-side scenario-setup data, not part of
    the engine↔card `card-schema.md`/`state-event-format.md` boundary
    either contract describes; nothing there needed correcting.

- 2026-09-12 (latest, continuous keyword grants in scenario replay —
  fin/16 Dion, Bahamut's Dominant / ENGINE_GAPS.md gap #14 UI side):
  `engine` built real query-time machinery (`CardDefinition.
  continuousKeywordGrants`, `state.ts`'s `effectiveKeywords`/
  `isActiveOrDefault`/`GameState.activePlayerId`) for a continuous keyword
  grant like Dion's "Dragonfire Dive" ("during your turn, Dion and other
  Knights you control have flying") and correctly flagged that nothing on
  the replay-rendering side could show it — there's no discrete
  `fn:'grantKeyword'` log entry for a query-time fact, only a one-off manual
  `read:hasKeyword` proof-of-concept line naming Dion himself, never the
  Knight token. Live bug reported: the ETB'd Knight token showed no flying
  icon at all.
  - **Approach**: serve the grant as plain declarative data, then
    recalculate it at RENDER time per snapshot, generically (no Dion-
    specific code):
    - `server/api/card/[set]/[number].ts`: new `FunctionalModelData.
      continuousKeywordGrants: { front?; back? } | null` (type derived from
      `CardDefinition['continuousKeywordGrants']`, exported as
      `ContinuousKeywordGrant` for reuse). Dev path: a NEW, independent
      per-slug dynamic `import()` of `definition.ts` by absolute `file://`
      URL (same technique `functionalModelPool.ts` already established for
      the same Nitro-relative-import-resolution reason) — deliberately NOT
      reusing `loadFunctionalModelPool()`/`computeTracesLive`'s
      run-one-card.mjs subprocess, since the pool skips any card with no
      (or not-yet-v2) synergy.json (irrelevant to whether a card's own
      CardDefinition carries a grant) and the subprocess only ever prints a
      `TraceResult[]`, never the raw parsed module. Prod path: extended
      `scripts/build-fm-bundle.mjs`'s existing `poolFacts` (already a
      hand-picked CardDefinition-field subset for the SAME reason
      `synergy.ts`'s matcher needs it) to also carry
      `continuousKeywordGrants` + a minimal `backFace` mirror of the same
      field; regenerated and left `data/functional-model/fm-bundle.json`
      un-committed in the working tree (320 cards, re-run again after this
      task to pick up a concurrent engine session's own synergy.json
      changes — see below).
    - `app/pages/app/card/[set]/[number].vue` → `ScenarioReplay.vue` →
      `ScenarioReplayTrace.vue`: new `continuousKeywordGrants` prop threaded
      straight through, no transformation.
    - `ScenarioReplayTrace.vue`'s own new `continuousGrantedKeywords(card)`
      is the real logic, called per rendered chip from `iconKeywords`
      (unioned with `printedKeywords`/`card.keywords`, same badge filtering
      as before): finds the snapshot's own self chip, picks front vs. back
      grants off `self.faceName` (unset = front), skips a grant when
      `onlyDuringYourTurn` and the snapshot's real `activePlayer` isn't
      self's own owner (mirrors `state.ts`'s `isActiveOrDefault` default of
      "yes" when `activePlayer` is undefined — a flat harness.ts scenario),
      then matches `includeSelf` (this chip IS self) or `subtype` (this
      chip is a DIFFERENT permanent, same owner as self, whose subtype list
      includes the grant's subtype). A new small `TOKEN_SUBTYPES_BY_NAME`
      map (module scope, built off `functional-model/tokens.ts`'s `TOKENS`
      registry — same "plain data" import `ScenarioReplay.vue`'s own
      `tokenNameToKeys` map already established) is the ONLY subtype source
      for a non-self chip — resolves Dion's own Knight token correctly
      (`createToken` log entries name a token by its bare printed name,
      which is always a `TOKENS[key].name`).
    - **Two accepted, documented (not fixed) gaps**, both because
      `ReplayCard` doesn't track the field a grant would need: a subtype
      grant can't match a real BYSTANDER creature (no token, no served
      subtype data anywhere in this pipeline) — not hit by any current
      scenario; `grant.equippedBySelf` (Dragoon's Lance's "equipped
      creature has flying") never matches — `scenarioReplay.ts`'s own
      `equip` case doesn't record WHICH creature an Equipment is attached
      to. Both documented inline in `continuousGrantedKeywords`'s own doc
      comment and in `app/SCENARIO_REPLAY.md`'s new section.
  - **Verified live** (Playwright, throwaway scripts at repo root, deleted
    after) against the already-running dev server, fin/16's real
    engine-piloted trace, stepping through with the Forward button: Knight
    token chip doesn't exist yet at steps 0-1 (before Dion's ETB), gains a
    real flying icon at steps 2-3 (turn 1, "Your turn" — the query-time
    front-face grant), LOSES it at step 4 (turn 2, "opp0's turn" —
    correctly toggles OFF, the exact behavior the bug report asked for),
    regains it from step 5 onward and keeps it through every later
    opponent turn too (turn 3 onward — Bahamut's own REAL chapter I
    `grantKeywordAll` discrete log entry has fired by then, a permanent
    grant per this model's own accepted "duration not tracked"
    simplification, correctly independent of turn from that point on).
    Confirmed via `svg` count inside the Knight chip's own DOM node at each
    step (0 vs 1), not just eyeballing a screenshot.
  - **Separate, pre-existing, OUT-OF-SCOPE cosmetic finding, not fixed**:
    Dion's own self chip shows a flying icon at EVERY step, including
    before the ETB/transform and during an opponent's turn — but this isn't
    my new code; `printedKeywords()`'s `cardKeywords` prop is Scryfall's own
    top-level `card.keywords` for the WHOLE two-faced card, which already
    combines both faces' keywords (`curl /api/card/fin/16` →
    `card.keywords: ["Flying"]`, sourced from the BACK face Bahamut's real
    printed Flying, not Dion's own front-face text) — a pre-existing "self
    chip's printed-keyword badge doesn't know which face is currently
    showing" gap for any DFC whose two faces' printed keywords differ, not
    something `continuousKeywordGrants` introduced or something this task
    was scoped to fix. Flagging for a future pass (`printedKeywords` would
    need to pick per-face keywords the same way `ptFor` already picks
    per-face power/toughness off `faceName`).
  - **Real-world concurrent-session note**: mid-task, a DIFFERENT live
    session was actively editing `functional-model/harness.ts` +
    `app/lib/scenarioReplay.ts` (the per-instance `id`-consumption entry
    logged just below this one) — briefly left the whole dev server 500ing
    site-wide (`harness.ts` not yet exporting `GENERIC_FILLER_CREATURE`
    that `scenarioReplay.ts`'s own new import already expected mid-edit).
    Did not touch either file myself; waited it out (~2 min) rather than
    working around/reverting someone else's in-flight uncommitted work,
    per this project's own safety rules. Resolved on its own once that
    session's edit landed.
  - `npm run typecheck`: exit 0 (re-checked twice, before and after the
    concurrent session's own edits landed). `npx vitest run app/lib
    functional-model`: 302/302 pass.
  - **Contract note**: none of `.claude/contracts/card-schema.md`/
    `state-event-format.md` needed a correction for this — both already
    accurately describe the engine↔card boundary this task worked within
    (`card-schema.md`'s "must not assume Effect kinds/resolveCard()
    internals" line was the one I checked most carefully against;
    `continuousKeywordGrants` is plain declarative CardDefinition data, not
    an `Effect`/interpreter internal, so serving it doesn't cross that
    line — noted explicitly in the new code's own comments for a future
    reader who might wonder the same thing). `app/SCENARIO_REPLAY.md`
    (this domain's own maintained primer) got a new section for this
    mechanism, plus an unrelated small cleanup: it still named the
    `KeywordIcon.vue`/`lib/keywordIcons.ts`/`KEYWORD_ICON_NAMES` component
    trio by an old name — renamed to `AbilityIcon.vue`/
    `lib/abilityIconPaths.ts`/`ABILITY_ICON_NAMES` (the real current names)
    while I was already in that section, not a new task of its own.

- 2026-09-12 (latest, per-instance `id` consumption in scenarioReplay.ts):
  Consumed the new additive per-instance `id` field `engine` added to
  `trace.json` log entries (`.claude/contracts/state-event-format.md`'s
  "Per-instance `id` fields" section, 2026-09-12) to fix the real reported
  bug: `putCounter`/`pump`/`tap`/etc. targeting multiple same-name,
  same-owner real board instances (2 Grizzly Bears, 4 dynamically-created
  Hero tokens, ...) all resolved to the SAME first-matched instance instead
  of the actual distinct one each real action targeted (The Crystal's
  Chosen, fin/14: "put a +1/+1 counter on each creature you control"
  visibly piled all 6 counters onto one creature). `ensureForZone`/
  `ensureForTap`'s own pre-existing `owner`-scoping (latest+29 era) only
  disambiguates by controller — same-owner multiple-same-name instances
  still collided.
  - **Fix, `app/lib/scenarioReplay.ts`**: `ensure`/`ensureForZone`/
    `ensureForTap` each gained an optional trailing `exclude?:
    ReadonlySet<ReplayCard>` param — when given, their own `cards.find(...)`
    match skips anything in that set (falling through to `ensure`'s
    create-new path only if literally nothing else matches). New
    `resolveInstance(id, resolve)` helper (a running `Map<number,
    ReplayCard>` keyed by the real `id`): an id-less entry (older trace
    shapes, or an fn that never carries one) calls `resolve` with NO
    exclusion — byte-identical to pre-fix behavior. An id-carrying entry
    NOT seen before calls `resolve` with the set of cards already pinned to
    some OTHER id (steers it onto a genuinely different same-named sibling
    instead of re-picking the first alias), then PINS the result to that id
    going forward — every later entry sharing the id skips straight to the
    pinned object, no re-resolution at all. Every switch case for a fn the
    contract lists as now carrying `id` (`pump`, `moveTo`, `ceasesToExist`,
    `putCounter`, `equip` +`equipmentId`, `animate`, `gainControl`,
    `destroy`, `tap`, `untap`, `grantKeyword`, engine-trace's `tap`/`attack`/
    `block` +`blockerId`/`attackerId`) now routes through `resolveInstance`.
    `dealDamage` (also listed as carrying `id`+`sourceId`) deliberately left
    alone — it doesn't mutate any `ReplayCard` today (only player life
    loss), so there's no per-instance resolution there yet to fix.
    `ReplayCard` gained an optional `id?: number` field (recorded once an
    id-carrying entry resolves to it) — deliberately NOT added to
    `groupKey`, so genuinely-identical-looking distinct instances still
    visually collapse into one "×N" chip same as any other fungible group;
    it only disambiguates which object a later same-id entry mutates, not
    display grouping.
  - **Verified**: direct `replayTrace()` calls (via `tsx`, no browser) against
    the real on-disk `trace.json` for `the-crystal-s-chosen` (fin/14) — all
    6 creatures (2 Grizzly Bears ids 2424/2425, 4 Hero tokens ids
    2427-2430) end with exactly `{"+1/+1":1}`, not piled/uneven. Also spot-
    checked 2 more of the ~50 pool cards `engine`'s own notes flagged for
    this collision class: `summon-knights-of-round` scenario 4 (3 distinct
    Grizzly Bears, ids 2299/2300/2301, each independently gets its own
    `pump` +2/+2 AND its own Indestructible counter — previously would have
    piled onto one) and `craterhoof-behemoth` scenario 1 (2 distinct Grizzly
    Bears, ids 464/465, each independently gets +3/+3 and Trample).
    `summon-esper-ramuh` scenario 1 also spot-checked (2 distinct Grizzly
    Bears each get their own +1/+0 pump). Live browser confirmation
    (Playwright, throwaway scripts at repo root, deleted after) against the
    already-running dev server, fin/14's Scenarios tab stepped to the final
    step: board shows a "Grizzly Bears ×2" chip and a "Hero ×4" chip, EACH
    with a single `[+1/+1]` counter badge (not `×2` on the badge, not split
    unevenly) — screenshot-confirmed groupKey correctly collapses all 6 into
    2 chips specifically BECAUSE their post-replay state is now identical
    (1 counter each), which is itself further proof of even distribution
    (an uneven 2/0 split would have produced 2 UNGROUPED Grizzly Bears
    chips with different counter badges).
  - `npm run typecheck`: exit 0. `npx vitest run app/lib`: 64/64 pass (full
    suite as it stands today).
  - No `.claude/contracts/*.md` mismatch found — `state-event-format.md`'s
    already-updated "Per-instance `id` fields" section (engine's own edit)
    matched the real on-disk field names (`id`/`equipmentId`/`sourceId`/
    `blockerId`/`attackerId`) exactly; nothing to flag.
  - Scope: touched only `app/lib/scenarioReplay.ts` per this handoff's own
    file-ownership note; did not touch `functional-model/` (engine's
    already-landed fix) or any `.vue` component.

- 2026-09-11 (latest, dynamic-token art bug fix): Fixed a real bug in
  `app/components/ScenarioReplay.vue`: a token created DURING scenario
  execution (a real `createToken` log entry firing mid-replay, e.g.
  `the-crystal-s-chosen`'s "Create four 1/1 colorless Hero creature tokens")
  wasn't recognized as a token at all, because the old `tokenKeys`/
  `tokenNameSet` only read names pre-declared in a scenario's static
  `ps.tokens` setup config. A dynamically-created token's bare name ("Hero")
  fell through to the generic real-bystander path (`extraNames` →
  `POST /api/cards/by-names`, a plain `name = ?` DB lookup with no
  disambiguation) — and multiple real cards across different sets are
  literally named "Hero" in the local DB (`tfin/2`..`/33` = the correct
  plain vanilla FIN 1/1 token, but also `tmsh/2` = an unrelated
  Vigilance 3/2 from a different game/set), so the wrong art rendered.
  - **Fix**: built a reverse name→keys map across the FULL
    `functional-model/tokens.ts` `TOKENS` registry (not just this
    scenario's own `ps.tokens`) — a board snapshot showing a name already
    proves a token by that name exists, regardless of whether the
    scenario's static setup declared it upfront. Computed `boardCards` once
    (last snapshot of every trace's `replayTrace(...)`, same "nothing ever
    removed, only re-zoned" property already relied on elsewhere in this
    file) and derived `dynamicTokenKeySet`: for every non-self, non-land,
    not-already-pre-seeded-token board name, look up `tokenNameToKeys`;
    only keep it if it resolves to EXACTLY ONE key. Those keys get folded
    into the same `/api/tokens/by-key` fetch (`allTokenKeys = [...tokenKeys,
    ...dynamicTokenKeySet]`) pre-seeded tokens already used, and matching
    names are excluded from `extraNames` so they never take the ambiguous
    by-name path at all.
  - **Cat tie-break decision (documented in the new code comment)**:
    `TOKENS.w_1_1_cat` and `TOKENS.w_1_1_cat_lifelink` both have `.name ===
    'Cat'` — genuinely ambiguous, no scenario-level signal available at
    replay time to pick the right variant. Chose to NOT apply the new
    TOKENS-name fallback for an ambiguous name at all — it falls back to
    the OLD behavior exactly (pre-seeded `ps.tokens` still resolves it
    correctly if declared; otherwise it's treated as a generic real-
    bystander lookup, same as before this fix). Deliberate, not an
    accidental `Object.values`/insertion-order pick — ambiguous names are
    rare and already handled correctly today via the pre-seeded path;
    only the unambiguous dynamic-token case needed fixing. Checked live:
    no currently-authored scenario actually creates a dynamic "Cat" token
    (grepped every `trace.json` for `"token": "Cat"` — zero hits), so this
    tie-break isn't exercised by any real card today, just guarded against.
  - **Verified live** (Playwright, throwaway script at repo root, deleted
    after) against the already-running dev server, all three flagged
    cards, stepped to each scenario board's "End" step: fin/14 (The
    Crystal's Chosen), fin/18 (Dwarven Castle Guard), fin/17 (Dragoon's
    Lance) — every "Hero" chip now renders `imgSrc` ending in
    `d0657ce1-bf75-4007-ac1b-0623eb263357.jpg`, confirmed via a direct
    `cards.db` query to be `tfin/2` (Hero, 1/1, the correct plain vanilla
    FIN token) — NOT `tmsh/2` (the unrelated Vigilance 3/2 Hero that the
    old plain-name-lookup sort order was picking). `dion-bahamut...`'s own
    Knight token untouched/unaffected (only one `TOKENS` key has that name,
    so it was never ambiguous and this fix is purely additive for it).
  - `npm run typecheck`: exit 0. `npx vitest run app/lib`: 64/64 pass (full
    suite as of today — down from a previously-logged 115 in older entries
    below, likely reflecting file changes since; not investigated further,
    out of this task's scope, all passing is what matters here).
  - No `.claude/contracts/*.md` mismatch to flag — pure client-side
    display/token-art-resolution fix, no engine-served shape (`trace.json`/
    `synergy.json`) touched or misdescribed by either contract. The bug
    itself was real engine-log-consumption logic living in card's own lane
    (`ScenarioReplay.vue`), not an engine-side defect — `trace.json`'s
    `createToken` entries are already correctly shaped per
    `state-event-format.md`.

- 2026-09-11 (follow-up): Reverted the hidden-text-behind-icon "SO"/"SI"
  select-to-copy trick from the Facts tab's role cell (user tried it live:
  "very hard to select, I pretty much have to go from previous row") —
  replaced with a real copy-icon button. `app/pages/app/card/[set]/[number].vue`:
  role `<td>` restored byte-for-byte to its pre-trick form (plain `<Icon>`
  with `title`, no wrapping `<span>`/hidden text/`pointer-events-none`).
  New copy button lives in the SAME debug-column `<td>` as the existing
  braces/JSON-debug icon (`SHOW_FACT_DEBUG_COLUMN`), immediately to its
  right, both inside one `inline-flex items-center gap-1.5` wrapper span:
  `lucide:copy` icon, `title="Copy SO"`/`"Copy SI"`, `@click="copyRoleMarker(row)"`.
  New `copyRoleMarker(row: FactRow)` async helper calls
  `navigator.clipboard.writeText(marker)` with the plain string `'SO'`/`'SI'`
  per `row.fact.role`. Added the nice-to-have click feedback (trivial given
  an existing icon-swap convention already in this file for reviewed-state
  icons): new `copiedRoleKey` ref holds `row.key` for ~1s after a click,
  icon swaps `lucide:copy` → `lucide:check` while set (per-row, keyed by
  `row.key` so only the clicked row's button flips), `setTimeout` clears it
  back.
  - Verified live (Playwright, throwaway scripts copied to repo root then
    deleted, per this project's established module-resolution workaround)
    against the already-running dev server, fin/1: clicking a row's copy
    button — clipboard read-back exactly matched `"SO"` for that row's
    source fact; icon visibly swapped to `lucide:check` immediately after
    click, reverted to `lucide:copy` ~1.1s later; the adjacent braces/debug
    button still opens the existing shared JSON modal unaffected (confirmed
    the modal body renders the correct fact JSON — its own lack of a
    visible "Fact JSON —" title text is pre-existing/by-design, that modal
    is deliberately header-less, not a regression from this change); role
    cell's own icon+title confirmed unchanged from the pre-trick markup.
  - `npm run typecheck`: exit 0 (used the correct command per this file's
    own earlier-logged policy correction, not the no-op `vue-tsc -p .`).
  - No `.claude/contracts/*.md` mismatch — pure card-page display/
    interaction change, no engine-served shape touched.


- 2026-09-11 (latest, scenario replay real-art fix): Fixed the root cause of
  fin/1's Scenarios tab showing blank placeholder boxes ("Ah"/"Co") for real
  bystander cards Ahriman/Coeurl in summon-bahamut's own scenario, generally
  (not a summon-bahamut-only patch).
  - **Root cause confirmed**: `ScenarioReplayTrace.vue`'s `imagesFor(card)`
    checks the `namedCardArt` prop (real art for any non-self real card,
    keyed by name) before falling back to the singular `cardImages` prop
    (self only) — but `namedCardArt` was, until now, ONLY ever populated by
    `KeywordEntryCard.vue` (the keywords-coverage page, from its own
    already-fetched `entry.cards` pool). The per-card page
    (`app/pages/app/card/[set]/[number].vue`) never populated it at all, on
    the now-false assumption (stated in the prop's own old doc comment) that
    a per-card page's Scenarios tab only ever has the one tested "self" card
    on the board. summon-bahamut's real scenario legitimately puts TWO real
    non-self cards on the board (Ahriman stays the whole time; Coeurl gets
    destroyed by chapter I) — added earlier the same day to replace
    fabricated placeholder names, which is what surfaced this.
  - **Fix, in `app/components/ScenarioReplay.vue`** (not the per-card page —
    fixes it for every current/future caller in one place, including the
    keywords page): added a new `autoNamedCardArt` ref, populated in the
    SAME watcher that already resolves `fillerImages` for basic
    lands/tokens. For every trace, runs `replayTrace(trace)` (imported from
    `app/lib/scenarioReplay.ts`, previously only used inside
    `ScenarioReplayTrace.vue`) and takes the LAST snapshot's `cards` array
    (nothing is ever removed from it, only re-zoned — the last snapshot
    alone reflects every card that ever appeared). Filters that list down to
    genuine real bystanders: `!c.isSelf` (already covered by `cardImages`),
    not a name already in the land-name set, not a name matching any
    `TOKENS[key].name` (both already covered by `fillerImages`), and not
    matching `/^(you|opp\d+)-/` (setupPlayer's own synthetic filler-name
    prefix — a real Scryfall name never takes that shape, per
    `scenarioReplay.ts`'s own `guessOwner`/`groupNameOf` doc comments).
    Fetches the survivors via the SAME `/api/cards/by-names` endpoint
    `fillerImages` already uses (one more parallel branch in the existing
    `Promise.all`), building `{images: string[], keywords: string[]}` per
    name (front-then-back image array, same convention `registry.ts`'s own
    `cardArtFor` uses for the keywords page — note `/api/cards/by-names`'s
    `minimalCard()` does NOT carry power/toughness at all, unlike the
    keywords page's own richer `fin_scryfall.json` pool, so `autoNamedCardArt`
    entries never set those two fields; harmless since no current consumer
    of `namedCardArt` reads power/toughness for a non-self chip — `ptFor()`
    in `ScenarioReplayTrace.vue` gets non-self P/T from the trace's own
    `ReplayCard.power`/`toughness`, not from `namedCardArt`, at all). New
    `mergedNamedCardArt` computed layers the CALLER-provided `namedCardArt`
    prop (still present, still what `KeywordEntryCard.vue` passes) on top of
    `autoNamedCardArt` — a caller's own entry for a name wins (keeps the
    keywords page's richer power/toughness data for its own three
    cardNames), but nothing requires a caller to pass anything anymore for a
    real bystander to get real art. `ScenarioReplayTrace.vue`'s own `props`
    doc comment and `imagesFor`'s doc comment updated to drop the
    now-false "only ever set by the keywords-coverage page" claim.
  - Verified live (Playwright, throwaway scripts run from the repo root —
    module resolution needs `node_modules` on an ancestor path — deleted
    after) against the already-running dev server: fin/1's Scenarios tab —
    both Ahriman and Coeurl chips now render a real `<img>` (not the
    placeholder `<div>` text box), correct Scryfall CDN URLs (confirmed via
    `curl -I`, and via a real `waitForResponse` + `naturalWidth>0` check —
    initial `naturalWidth:0`/`complete:false` reads were just this sandbox's
    slow/contended concurrent-image-load speed for `cards.scryfall.io`, not
    a real block: a plain `fetch()` from the same page context to the exact
    same URL round-tripped in ~1.8s, and the image DID arrive within ~60s
    when waited for explicitly); a cropped screenshot confirms real
    Ahriman/Coeurl art. Keywords-coverage page (`/app/keywords/flying-reach`,
    the exact bundle the old doc comment cited, `cardNames: ["Ahriman", "Iron
    Giant", "Coeurl"]`) — unaffected, all three real-art chips still render
    with `imgCount:1` each, real 200-status page load, heading present.
  - `npm run typecheck`: exit 0. `npx vitest run app/lib`: 115/115 pass
    (unaffected — no `app/lib` test file exercises `ScenarioReplay.vue`
    itself, this is a template/script-only Vue component change).
  - **Real, separate engine-owned bug found along the way, NOT fixed here
    (out of lane — trace.json is generated output; this project's own
    convention is engine regenerates it from `scenarios.ts`, card just reads
    it) — flagging for `engine`**: summon-bahamut's own `trace.json` `enters`
    log entries for both Ahriman (yours) and Coeurl (the OPPONENT'S) carry no
    `controller` field, so `scenarioReplay.ts`'s own `ensure(cardName,
    'Battlefield')` branch for a no-`instanceId` `enters` entry falls back to
    `guessOwner`'s default ('you' — neither name has a role-prefix to guess
    from), and BOTH chips render on YOUR board at the replay's Start step,
    not opponent's, even though the scenario's own `result` prose and
    `scenarios.ts` (`pilot.opponents[0]!` for Coeurl) are clear Coeurl
    belongs to the opponent. Confirmed live via the same Playwright session
    (Start-step screenshot shows both 2/2 chips under "YOU", none under
    "OPP0"). Cosmetic (doesn't affect chapter I's own real destroy-target
    logic, which reads real engine state, not this replay reconstruction),
    but worth a real fix: either `scenarios.ts`'s own manual `enters` push
    for a bystander needs a `controller` field threaded through to the
    logged entry (mirroring what the `enters` case already reads via
    `str(entry.controller)`), or whatever code path emits this log entry
    from `pilot.state.addCard(pilot.opponents[0]!, ...)` needs to actually
    log the real owner it was given instead of omitting it.
  - No `.claude/contracts/*.md` mismatch to flag — this is a client-side
    Vue-prop/display fix, no engine-served shape (`trace.json`/`synergy.json`)
    changed or misdescribed by either contract.

- 2026-09-11 (latest, real typecheck fix): Fixed the 24 real `npm run
  typecheck` errors in `app/lib/factConditions.test.ts` flagged by a peer
  agent (see the "Big process finding" entry below for how the broken
  `vue-tsc --noEmit -p .` no-op was discovered in the first place) — every
  fixture `Fact`/`ZoneFact`/`EventFact` object literal in that file predated
  `Fact.annotations` becoming required (min 1 entry) earlier the same day,
  and none had been updated. Added `annotations: [{ target: 'oracle', line:
  0, start: 0, end: 1 }]` (a placeholder — these are synthetic unit fixtures
  with no real card text behind them, and `factConditions()` itself never
  reads `annotations`) to all 24 literals missing it, single-line and the 3
  multi-line ones alike. Also grepped for lingering removed `id`/
  `sourceText`/`highlight` fields per the task's own "verify, may be
  nothing left" framing — confirmed genuinely clean, a prior pass already
  got them all.
  - **Policy correction, stated plainly for any future reader of this
    file**: `npx vue-tsc --noEmit -p .` is a **silent no-op** on this repo
    (root `tsconfig.json` is `{ files: [], references: [...] }`; without
    `-b`/`--build` the references aren't picked up, so literally nothing
    gets checked — verified by a peer agent injecting a deliberate type
    error and still getting exit 0). Every "vue-tsc exit 0 / clean"
    confirmation logged anywhere below this line in this file, across many
    past entries, was false confidence, not a real clean bill of health.
    **The correct, only-trustworthy command is `npm run typecheck`** (→
    `nuxt typecheck`, real build-mode project-reference checking) — use
    this exclusively from now on, in this and every future task, instead of
    any `vue-tsc` invocation.
  - Verified: `npm run typecheck` → 0 errors anywhere in the codebase (this
    file's 24 were the only ones surfacing). `npx vitest run
    app/lib/factConditions.test.ts app/lib/factOrder.test.ts`: 30/30 pass
    (unchanged assertions — adding a required-but-unread field doesn't
    change any test's behavior). `npx vitest run app/lib`: 115/115 pass
    (full suite).
  - Scope: touched only `app/lib/factConditions.test.ts` plus this notes
    file, per explicit task constraint (`functional-model/*` untouched).
  - No `.claude/contracts/*.md` mismatch to flag — this was a stale test
    fixture catching up to an already-correctly-documented required field,
    not a contract shape problem.

- 2026-09-11 (latest): Type-line highlighting for `target: 'typeLine'`
  annotations (fin/1's `self-cast`/`self-enters`), plus a coordinator-flagged
  modal-sizing correction and two real pre-existing bugs found along the way.
  - **`app/components/FunctionalModelText.vue`**: the type line
    (`<span>{{ face.typeLine }}</span>`) now gets the exact same
    dashed-underline/hover-tooltip/cross-highlight treatment oracle-text
    lines already have. Refactored the old `buildLineSegments`'s inline
    overlap logic into a shared `buildSegments(text, ranges)` core (target-
    agnostic — just "given `{start,end,facts}` ranges over a string, build
    runs") called by both `buildLineSegments` (oracle: filters
    `ann.target === 'oracle' && ann.line === lineIndex`) and the new
    `buildTypeLineSegments` (typeLine: filters `ann.target === 'typeLine'`,
    no line filter — a typeLine `AnnotationRef` has no `line` field at all,
    slices `face.typeLine` directly by `start`/`end`). New `faceTypeLine`
    computed (one `Segment[]` per face) feeds a new template block mirroring
    the oracle-line segment span markup exactly (same `segColor`/
    `isRowHighlighted`/`show`/`hide` reuse, no new logic needed there since
    `Segment`/`factKey` were already target-agnostic).
  - **Real bug found in the byte-for-byte-ported merge algorithm, fixed as
    part of this task (not a pure refactor-only change)**: the OLD
    `buildLineSegments` overlap tolerance (ported from the deprecated
    `annotateOracleText`) treated any non-identical overlapping range pair as
    "ambiguous — keep whichever sorts first," silently DROPPING the loser's
    facts entirely. Fine for oracle text (no current fact data has a true
    partial/nested overlap there), but wrong for the type line: fin/1's real
    data has `self-enters` spanning the WHOLE typeLine phrase "Enchantment
    Creature" (0-20) and `self-cast` nested entirely inside it, "Creature"
    only (12-20) — a real, common nesting case, not a rare edge case. Under
    the old algorithm this silently dropped `self-cast` from ever rendering
    at all (confirmed via a live Playwright check before the fix: only 1
    typeLine span, "Enchantment Creature," backing self-enters alone).
    Rewrote `buildSegments` as a proper interval partition — every distinct
    boundary point across all ranges becomes a cut, each minimal slice
    carries the union of every range fully covering it, adjacent slices with
    identical fact-sets (by reference) rejoin into one visual run. Verified
    this preserves the old exact-duplicate-merge behavior (two identical
    ranges still produce one multi-fact segment, confirmed live: fin/1's
    Mega Flare damage clause still merges its 3 facts into one span) while
    fixing the nesting case (now renders as TWO segments, "Enchantment " →
    self-enters only, "Creature" → both self-enters+self-cast — confirmed
    live via Playwright: 7 total `cursor-help` spans post-fix vs 6 before
    this task started, tooltip on the bare "Creature" span shows BOTH "cast a
    spell" and "enters the battlefield," and hovering the Facts tab's "Cast a
    spell" row correctly highlights ONLY the "Creature" span, not
    "Enchantment ", proving the per-fact cross-highlight resolves to the
    exact right sub-span under nesting).
  - **Real, unrelated `AnnotationRef`-narrowing type bug found and fixed in
    the same class, in-lane**: `app/lib/factOrder.ts`'s `orderByTextPosition`
    read `ann.line`/`ann.start` directly off a raw `AnnotationRef` union
    without narrowing on `target` first — a real TS2339 (`Property 'line'
    does not exist on type '{ target: "typeLine"; ... }'`), same class of bug
    my own refactor above had to guard against. Added a small
    `annotationPosition(ann: AnnotationRef)` helper: a `typeLine` annotation
    (no real `line`) gets a synthetic `line: -1` for this function's OWN sort
    purposes only (never served/read as a real line number elsewhere) —
    ranks it before every real oracle-text line, matching where a type line
    actually sits visually on the rendered card (above line 0 of the oracle
    text), tie-broken by its own `start`. No behavior change for any
    currently-authored oracle-only fact (this file's own `.test.ts` has zero
    `typeLine` fixtures, confirmed via grep — purely additive, all 6 existing
    cases still pass unchanged).
  - **Big process finding, flagging with real urgency**: `npx vue-tsc
    --noEmit -p .` — the exact command this agent's own notes have cited as
    "exit 0, clean" after nearly every task for the past several
    sessions — **does not actually type-check anything**. The root
    `tsconfig.json` is `{ "files": [], "references": [...] }`; run as a
    plain (non-build-mode) `-p .` invocation, `files: []` means zero root
    files and project references are NOT auto-included without `-b`/
    `--build`, so the whole invocation silently no-ops (verified directly:
    injected a deliberately-nonexistent-property access into
    `FunctionalModelText.vue`, ran the exact command, still got exit 0).
    Confirmed the CORRECT command is `npm run typecheck` (→ `nuxt
    typecheck`, real build-mode project-reference checking) — this single
    run surfaced BOTH real bugs fixed above (they'd been sitting
    unnoticed) plus 24 pre-existing, unrelated `factConditions.test.ts`
    fixture errors (`Property 'annotations' is missing` — those test
    fixtures predate `annotations` becoming required and were never updated;
    NOT touched here, out of this task's scope, flagging only). This means
    every past "vue-tsc -p . exit 0" confirmation in this agent's own prior
    notes entries was false confidence, not a real clean bill of health —
    worth the orchestrator/other specialists knowing too, this isn't
    card-specific (the same broken root tsconfig affects any specialist
    running the same command). Going forward this agent uses `npm run
    typecheck` exclusively.
  - **Coordinator mid-task correction, addressed**: the shared debug/JSON
    `UModal` (`app/pages/app/card/[set]/[number].vue`) had just been changed
    to `:fullscreen="true"` in a concurrent edit — dialed back per explicit
    ask to a normal centered/sized box (`:ui="{ content: 'max-w-3xl' }"`,
    `JsonHighlight` capped at `max-h-[70vh]` again) while keeping it
    header-less (`:close="false"`, no `title` prop — unchanged). Verified
    live: modal renders as a 768px-wide centered box (not edge-to-edge),
    confirmed no header/title bar renders (Reka UI's own a11y-only hidden
    title/description spans are the only thing before the body slot).
  - Verified live (Playwright, throwaway scripts, deleted after) against the
    already-running dev server: fin/1 — type line now shows real highlighted
    spans as described above; fin/9 (no `typeLine` annotations at all) —
    type line renders as fully plain text, zero `cursor-help` spans on it
    (only the pre-existing unrelated header self-fact span on the card
    name), confirming zero regression for every not-yet-annotated card.
  - `npm run typecheck`: 24 errors, ALL in `app/lib/factConditions.test.ts`
    (pre-existing, confirmed via `git status` that file was already dirty
    before this task started — not caused by this task). Zero errors in
    every file this task touched. `npx vitest run app/lib`: 115/115 pass
    (test fixtures aren't type-checked by vitest itself, only by `nuxt
    typecheck`, which is why the 24 fixture-shape errors don't fail the
    actual test run).
  - **Contract note**: no mismatch in `.claude/contracts/card-schema.md`'s
    `AnnotationRef` description — the two-variant shape (`oracle` w/ `line`,
    `typeLine` w/o) matched exactly what's on disk in
    `summon-bahamut/synergy.json`. Nothing to flag there. The only thing
    worth a future contract note (not added there, out of this agent's own
    contract-editing scope) is that a `typeLine` annotation's real-world data
    is NOT guaranteed disjoint from another fact's `typeLine` annotation on
    the same face — nesting is the norm for a baseline claim like
    "self-cast" nested inside "self-enters," not an edge case — any future
    consumer of raw `Fact.annotations` ranges should assume overlap/nesting
    is possible, not just exact-duplicate sharing.

- 2026-09-11 (latest): Finished card-side cleanup after engine's `Fact.id`
  removal + required-`annotations` rework, plus two small independent UI
  tweaks. Scoped to summon-bahamut (fin/1) per task constraint; didn't touch
  anything under `functional-model/` or `app/lib/factOrder.ts` (both
  explicitly off-limits, and both were already being modified live by a
  concurrent session during this task — confirmed via `git diff` that my own
  changes never touched either).
  1. **Dropped `fact.id` everywhere** — `app/components/FunctionalModelText.vue`'s
     and the card page's own `factKey()` now both mirror engine's own
     `factIdentity()` (`functional-model/synergy.ts`) exactly: `` `${fact.role}::${describeFact(fact)}::${JSON.stringify(fact.annotations[0])}` ``
     (no more `fact.id ??`/`sourceText` fallback — `annotations[0]` is always
     safe since the field is now required with a minimum of one entry).
     `openFactDebugModal`'s modal title dropped its `fact.id ??` branch too
     (now just `` `Fact JSON — ${factKey(fact)}` ``). `server/api/graph-links.ts`'s
     `sourceKey` dropped its `group.fact.id ??` branch, now just
     `` `${name}::${group.description}` `` (that's the only field it had
     available there — no other identity source needed, `description` alone
     was already the established fallback). `app/lib/graphRenderer.ts`'s
     stale doc-comment citing `${producer}::${fact.id}` updated to
     `${producer}::${group.description}` (comment-only, no code change).
     `app/lib/factConditions.ts`'s dead `'sourceText'`/`'id'` allowlist
     entries removed from `HANDLED_OR_LABEL_KEYS`.
  2. **Replaced the `sourceText` hover tooltip** — `sourceText`/`highlight`
     are no longer served on `Fact` at all (moved engine-side to a separate,
     non-served `annotations-authoring.json`). New `factSourceText(fact)`
     helper (`app/pages/app/card/[set]/[number].vue`, right after
     `factFaceIndex`): reads `fact.annotations[0]` against the real served
     `annotatedCard` face (via the existing `annotatedFaces`/`factFaceIndex`)
     — `target: 'oracle'` shows the WHOLE line the span lives on
     (`face.oracleText.split('\n')[ann.line]`, a full sentence reads better
     than a bare phrase, matching the old `sourceText` tooltip's own feel);
     `target: 'typeLine'` slices `face.typeLine` directly at `start`/`end`
     (no line-splitting — a type line has no paragraph structure). Falls
     back to `describeFact(fact)` if ever empty (shouldn't happen given
     `annotations` is required, but doesn't crash if it does). The Facts
     table's label-cell `<td>` `:title` binding now calls
     `factSourceText(row.fact)` instead of reading `row.fact.sourceText`
     directly. Also updated two nearby doc comments (around
     `isHeaderLinkedFact`) that referenced a "real `sourceText`/`highlight`
     pair" as still-current vocabulary — reworded to describe the pointer
     model instead, no behavior change.
  3. **JSON/debug modal styling** — the shared `UModal` (Facts-tab per-fact
     debug cells only; the JSON tab itself renders `JsonHighlight` directly
     inline, no modal, per an earlier same-day correction — see the entry
     below) now uses `:fullscreen="true" :close="false"` and no `title` prop
     at all, dropping `:ui="{ content: 'max-w-3xl' }"`. Confirmed via reading
     Nuxt UI 4.11's own `Modal.vue` source
     (`node_modules/@nuxt/ui/dist/runtime/components/Modal.vue` +
     `.nuxt/ui/modal.ts` theme) that the header `<div>` only renders when
     `slots.header || props.title || slots.title || props.description ||
     slots.description || props.close || slots.close` — with none of those
     set, the header block doesn't render at all (a `#header` slot override
     rendering nothing would still leave an empty bordered bar, since
     `slots.header` itself would still be truthy — omitting the prop
     entirely is the clean way to get zero header). `fullscreen` is a real,
     documented boolean prop whose own theme variant sets `content` to
     `inset-0` (no `max-w`/centered-transform/`max-h` compound variants,
     which only apply when `fullscreen: false`) — gives the near-full-
     viewport sizing the task asked for natively, no custom `:ui` override
     needed. `JsonHighlight`'s own passed-in class changed from
     `max-h-[70vh]` to `h-full` to fill the now much taller container.
     `debugModalTitle` ref is kept (still assigned by `openDebugModal`) but
     is now write-only — no longer read by the template since the header
     that would have shown it is gone; documented as such in the ref's own
     header comment for a future reader (kept for a potential future
     accessible-name use, not dead code by mistake).
  - **Real regression found and fixed along the way, in my own lane**:
     `app/lib/factConditions.ts`'s generic `formatUnknown` fallback loop
     iterates every own-enumerable key on a `Fact` not in
     `HANDLED_OR_LABEL_KEYS` — `annotations` (an array, now required on every
     fact) was never in that allowlist, so EVERY fact's notes column was
     leaking a garbled `annotations: 0 [object Object]` bit (confirmed via a
     quick `vite-node` repro before fixing, then again after — output went
     from `'self · annotations: 0 [object Object]'` to `'self'`). Added
     `'annotations'` to `HANDLED_OR_LABEL_KEYS` with a comment explaining
     why (positional oracle-text-pointer metadata, not a human-facing
     condition — same treatment `sourceText`/`id`/`highlight` got before
     they were dropped from `Fact` entirely). This predates this task (any
     card with real `annotations` would have hit it) but wasn't caught until
     now since summon-bahamut is the only card that has `annotations` at
     all.
  - **Test fixtures fixed**: `app/lib/factConditions.test.ts`'s ~25 fixture
     facts all still had a literal `id: '...'` field (a artifact of pre-
     `Fact.id`-removal fixtures) — harmless while `'id'` was in the
     allowlist, but once removed per this task's own instruction, every one
     of those facts started leaking `id: <value>` into the notes column via
     the same fallback loop above, breaking 23/23 of that file's tests at
     runtime (types didn't catch it — test files aren't covered by
     `vue-tsc -p .`'s project references, confirmed by checking
     `tsconfig.json`'s `references`). Stripped every `id: '...',`
     (single-line and multi-line literal forms) and one stray
     `sourceText: undefined,` line via a small Python regex pass, re-ran:
     115/115 pass across the full `app/lib` suite.
  - **Critical, unrelated, engine-owned bug found — flagged, NOT fixed
     here** (out of this task's own explicit "don't touch
     `functional-model/`" constraint): `functional-model/synergy.ts`'s own
     `factIdentity(fact)` (the exact function this task's `factKey()` rework
     was told to mirror) does `` `...${JSON.stringify(fact.annotations[0])}` ``
     with NO optional chaining, and `findInteractionsForCard`'s `matchOne`
     calls it unconditionally on `theirs` for every OTHER card's facts in
     the whole pool during cross-card matching — not just the calling
     card's own facts. Since `annotations` is only actually backfilled
     on-disk for summon-bahamut (confirmed: `grep -l annotations
     functional-model/cards/*/synergy.json` → exactly 1 of 320 cards), this
     throws `TypeError: Cannot read properties of undefined (reading '0')`
     for literally any card whose interactions touch an un-backfilled card
     — which is effectively every card in the pool right now. Confirmed
     live: `curl localhost:3000/api/card/fin/1` AND `.../fin/9` both 500
     with this exact stack trace, on a freshly restarted dev server, with
     none of my own changes able to cause it (I never touched
     `functional-model/synergy.ts` this task, confirmed via `git diff`
     showing my diff scoped elsewhere). This is uncommitted, in-flight work
     already sitting in the working tree (confirmed via `git diff --
     functional-model/synergy.ts` — the `factIdentity` function and its
     unguarded `.annotations[0]` read are part of the SAME uncommitted
     engine change this task's own brief describes), almost certainly
     already known to whoever's mid-editing it live in a concurrent
     session, not something introduced by this task. **This currently
     breaks EVERY card page and the graph-links endpoint app-wide**, not
     just fin/1 — flagging with real urgency for the orchestrator to route
     to `engine` immediately (trivial fix: `fact.annotations?.[0]`, or gate
     the whole call behind an "is this card annotation-opted-in" check
     until the pool-wide backfill lands). Because of this, I could NOT get
     a live browser/Playwright confirmation of fin/1's Facts tab this
     round — verified my own logic instead via a standalone `vite-node`
     script that replayed the real summon-bahamut `synergy.json` facts (12
     facts, matches the expected count post `self-battlefield` removal)
     against the real Scryfall oracle text/type line for a hand-built
     `factKey`/`factSourceText`, confirming: unique non-crashing keys for
     all 12 facts, sensible full-line tooltips for `oracle`-targeted facts
     (e.g. "IV — Mega Flare — This creature deals damage..."), and correct
     substring tooltips for `typeLine`-targeted ones ("Creature",
     "Enchantment Creature").
  - `npx vue-tsc --noEmit -p .`: exit 0 (checked after every edit round).
    `npx vitest run app/lib`: 115/115 pass (full suite, includes the fixed
    `factConditions.test.ts`).
  - **Contract note**: `.claude/contracts/card-schema.md`'s own "Fact-to-
    oracle-text pointers" section already fully and correctly described
    everything this task needed (the `Fact.id` removal, the new
    `factIdentity` tuple, the `sourceText`/`highlight` removal, the exact
    hover-tooltip derivation) — no mismatch found, it was accurate and
    complete going in. Worth the orchestrator knowing the `factIdentity`
    crash above isn't a contract-description problem — it's a real runtime
    gap in the engine's own generic matching code that the contract
    (correctly) doesn't get into that level of implementation detail on.

- 2026-09-11 (later still): Finished the `Fact.annotations` pointer-based
  migration engine handed off (`.claude/contracts/card-schema.md`'s
  "Fact-to-oracle-text pointers" section) — card side is now fully off the
  old live-recomputed `annotateOracleText`/`AnnotatedSegment`/
  `AnnotatedFactRef` segment-tree design, scoped/verified against
  summon-bahamut (fin/1) per the task's own constraint.
  - `server/api/card/[set]/[number].ts`: `buildAnnotatedCard` no longer
    calls `annotateOracleText` — each face now serves raw `oracleText:
    string` (real `\n`s, untouched) instead of `oracleLines:
    AnnotatedSegment[][]`. Dropped the `annotateOracleText` import entirely.
  - `app/types.ts`: `AnnotatedFace.oracleLines` → `oracleText: string`;
    dropped the now-unused `AnnotatedSegment` import.
  - `app/components/FunctionalModelText.vue` — the real rewrite. New props:
    `facts?: Fact[]` (every visible source+sink fact, same list the Facts
    tab itself is built from) alongside the existing `card`/`highlightKey`/
    `selfFacts`/`headerHighlightIndex`. `selfFacts` type changed from
    `Map<number, AnnotatedFactRef[]>` to `Map<number, Fact[]>` — the
    component now carries real `Fact` objects throughout instead of the
    deprecated slim ref shape, computing `describeFact(fact)` at render
    time (imported from `functional-model/synergy.ts` — already an
    established, if backwards-per-the-contract's-own-note, import the card
    page itself already makes; not a NEW engine-owned function added to
    that boundary, same `describeFact` both sides already shared). New
    local `Segment { text: string; facts?: Fact[] }` type replaces
    `AnnotatedSegment`. New `buildLineSegments(lineText, lineIndex, facts)`
    ports `annotateOracleText`'s own overlap/merge algorithm BYTE-FOR-BYTE
    (sort by `(start, end)`, exact-duplicate ranges merge their facts
    together, overlapping-but-different ranges keep whichever sorted
    first) — the only change is reading pre-baked `fact.annotations[].{line,
    start,end}` per fact instead of re-deriving whole-text ranges from live
    `sourceText`/`highlight` `indexOf` search. New `faceLines` computed
    (one entry per face, one entry per line) replaces the server-served
    `face.oracleLines` as the template's iteration source. New
    `factFaceIndexFor(fact, faceCount)` — `faceCount<=1` always 0, else
    `fact.face==='back'?1:0` — matches a fact to its owning face (needed to
    scope which facts feed a given face's own line-segment build); no
    fallback heuristic needed since annotation `line` numbers are already
    computed relative to whichever face `Fact.face` names. `factKey`,
    `isRowHighlighted`, `segColor`, `show`/`hide`, `scrollToFace` all kept
    their EXACT prior behavior/signatures conceptually, just operating on
    `Fact`/`Segment` instead of `AnnotatedFactRef`/`AnnotatedSegment`.
  - `app/lib/factOrder.ts` — `orderByTextPosition` DROPPED its second
    `faces: AnnotatedFace[]` parameter entirely (no longer needed: each
    row's own `fact.annotations[0]` already carries its real `(line,
    start)` position directly, no server-built segment tree left to walk
    to derive one) — new signature `orderByTextPosition(rows: FactRow[])`.
    Also deleted the now-pointless `annotatedFactRefKey` export (existed
    solely to key an `AnnotatedFactRef` pulled from a segment tree; nothing
    needs that anymore). Same tie-break/inherit-from-predecessor/
    sink-before-source semantics ported over unchanged, now built off
    `(line, start)` tuples read straight off each fact instead of
    integer positions assigned by walking a segment array.
    `factOrder.test.ts` fixtures rewritten to build `Fact.annotations`
    directly (a `row(id, { line, start, role })` helper) instead of the old
    `faceWithAnchors(...ids)` segment-tree builder — all 6 cases kept their
    original assertions/semantics, just re-expressed against the new
    pointer shape.
  - `app/pages/app/card/[set]/[number].vue`: new `allSynergyFacts` computed
    (`[...synergy.source, ...synergy.sink]`, shared by `factRows`,
    `headerFaceFacts`, and now passed to `<FunctionalModelText :facts=.../>`
    as its own prop). `isFactAnnotated(fact)` simplified from "walk every
    face's `oracleLines` looking for this fact's key" to a direct
    `!!fact.annotations?.length` check — deleted `factKeysInFaces`/
    `mainFaceFactKeys`/`annotatedFactKeys` entirely (no segment tree left to
    walk). `factFaceIndex(fact)` simplified similarly: the old fallback
    heuristic (infer front/back from a real oracle-text match on face 0,
    for a fact with no `face` set) is GONE — under the pointer model a
    fact's own `annotations` are only ever computed relative to whichever
    face `Fact.face` already names, so an unset `face` just defaults to
    front (0) directly, matching the contract's own "omitted-for-
    single-faced" convention; `annotatedFaces.value.length<=1` still
    short-circuits to 0 first, unchanged. `headerFaceFacts`'s `Map` value
    type changed from `AnnotatedFactRef[]` to plain `Fact[]` — no longer
    builds a slim ref via `describeFact`, just pushes the real fact.
    `headerLinkedFactKeys` now keys off `factKey(f)` (not raw `f.id`) for
    consistency with `isHeaderLinkedFact`'s own lookup — strictly more
    correct for a fact without a real `id` (latent gap in the old code,
    doesn't change fin/1 since all its facts have real ids). Both
    `orderByTextPosition(...)` call sites in `factRowGroups` dropped their
    second `faces` argument. Dropped the now-unused `AnnotatedFactRef`/
    `AnnotatedFace` type imports and `annotatedFactRefKey` import.
  - Verified live against the ALREADY-RUNNING dev server for fin/1 (no
    restart needed — this is a client+API-route change, not the
    functional-model-source-tree dev cache the project's documented
    stale-HMR gotcha is about; confirmed via a direct `/api/card/fin/1`
    fetch that `annotatedCard.faces[0]` already has `oracleText` not
    `oracleLines`): exactly 5 underlined `cursor-help` spans total — 4 body
    spans (`Sacrifice after IV` merging self-sacrifice-graveyard+
    self-sacrifice's identical range; `Destroy up to one target nonland
    permanent` merging destroy-act+destroy-nonland; `Draw two cards` alone;
    the Mega Flare damage clause merging chapter-iv-damage+mega-flare-you+
    mega-flare-opp's identical range) + 1 header span (`Summon: Bahamut`,
    the 5 real still-unannotated self facts: self-cast/self-enters/
    self-battlefield/self-counters/self-dies — one more than the task
    brief's own worked example of "3 don't" because `self-counters` also
    has no `highlight` on disk, confirmed via the raw synergy.json read,
    not a regression introduced here). Hovering each span pops the correct
    tooltip content (checked via `.fixed.z-20` tooltip row text against
    each span, matches `describeFact` output for the exact facts on that
    span). Cross-highlight confirmed BOTH directions: hovering the Facts
    tab's "Cast a spell" row label adds `bg-blue-400/20` to the header
    span (header-linked fact); hovering the "Card draw" row label adds
    `bg-surface/60` to the "Draw two cards" body span (body-linked fact) —
    both via throwaway Playwright scripts (repo-root temp files, deleted
    after). `npx vue-tsc --noEmit -p .`: exit 0. `npx vitest run
    app/lib/factConditions.test.ts app/lib/factOrder.test.ts`: 30/30 pass
    (6 factOrder cases rewritten for the new fixture shape, same
    assertions); `npx vitest run app/lib`: 115/115 pass (full app/lib
    suite, nothing else touched).
  - Confirmed fully off `AnnotatedSegment`/`AnnotatedFactRef`/
    `annotateOracleText` — grepped the whole `app/`+`server/` tree, zero
    remaining imports/type-usages/call-sites; the only hits left are
    historical/explanatory prose comments (a few left deliberately, e.g.
    FunctionalModelText.vue's own doc comment naming the algorithm it
    ported from) that don't reference the actual exports. **Safe for
    `engine` to delete `annotateOracleText`/`AnnotatedSegment`/
    `AnnotatedFactRef` from `functional-model/synergy.ts` outright.**
  - No `.claude/contracts/card-schema.md` mismatch found — the "Fact-to-
    oracle-text pointers" section's own description of the handoff (shapes,
    file-by-file plan) matched what was actually on disk exactly. Only
    flag: that section is still headed "IN PROGRESS" and ends with "card
    side is not [done]" — now stale, worth the orchestrator updating it to
    reflect this task's completion (not done here — out of this agent's
    own edit scope for a contract file).
  - Scope reminder for whoever does the pool-wide `annotations` backfill
    next (engine-side): every card OTHER than summon-bahamut currently has
    `annotatedCard.faces` but zero `Fact.annotations` anywhere, so
    `FunctionalModelText.vue` will render them with zero inline-highlighted
    spans (graceful degrade, same tolerance the old code had for an
    unmatched `sourceText`/`highlight`) until that backfill lands — not a
    bug, per this task's own explicit scope constraint, just flagging so
    it isn't mistaken for one later.


- 2026-09-11 (even later): Facts-review-confirm now snapshots real oracle
  text into `progress.json`, for a future (not-yet-built) staleness check —
  baked `Fact.annotations` (line/char pointers into oracle text, see
  card-schema.md's "Fact-to-oracle-text pointers" section) are never
  re-validated live anymore, so if Scryfall's own text for a reviewed card's
  printing is ever corrected after review, nothing currently catches it.
  - `server/api/card/review-status.ts`: when `field === 'review'` and
    `reviewed === true`, resolves the real Scryfall card for `body.set`/
    `body.number` (new optional request fields) — local `data/cards.db` by
    `set_code`+`collector_number` first, live
    `https://api.scryfall.com/cards/:set/:number` fallback (small deliberate
    duplicate of `server/api/card/[set]/[number].ts`'s own
    `lookupCardBySetNumber`, not an import of it — that file's own helpers
    aren't exported, and this route only needs the single-card read case,
    not its token/interaction machinery) — then writes `oracleTextSnapshot`
    (bare `string` for a single-faced card, `{front, back?}` for a DFC —
    matches `Fact.face`'s own `'front'|'back'` vocabulary,
    `functional-model/synergy.ts`) + `reviewedAt` (`YYYY-MM-DD`, same format
    `lastVerified` already uses) into `progress.json` alongside the existing
    `review` field write. Un-reviewing (`reviewed === false`) deliberately
    leaves a prior snapshot untouched (no code path touches it) — flagged
    per task instruction rather than silently deciding to clear it; no
    strong reason found either way, "keep evidence of what was last
    reviewed" seemed the safer default.
  - Re-snapshots on every confirm, not just the first — re-reviewing after a
    content fix re-baselines the staleness check too (matches this
    project's existing "review flag resets on content change" convention in
    spirit — the artifact backing the review gets refreshed, not left
    pointing at stale text).
  - `app/pages/app/card/[set]/[number].vue`'s `toggleReviewStatus`: POST
    body now also sends `set: String(route.params.set), number:
    String(route.params.number)` unconditionally (harmless/ignored
    server-side for the `scenariosReview`/`interactionsReview` fields) —
    the page is always at that exact `/app/card/:set/:number` route, so it
    already has both without a new fetch; simpler and more precise (exact
    printing) than reconstructing a by-name cross-set search purely for
    this.
  - Explicitly did NOT build any staleness-comparison/drift-warning UI —
    out of scope per task, snapshot-writing only.
  - Verified end-to-end against summon-bahamut (fin/1) via direct
    `curl -X POST /api/card/review-status` against the running dev server:
    flipping `review: 'ai' -> 'human'` (with `set:'fin', number:'1'`) wrote
    a real, correct `oracleTextSnapshot` (matches Summon: Bahamut's actual
    Saga oracle text exactly, including the reminder-text parenthetical and
    all 4 chapters + Flying) and `reviewedAt: '2026-09-11'`; fast response
    confirmed it resolved via the local `cards.db` path, not a live network
    call. Flipping back to `'ai'` confirmed the snapshot fields survive
    untouched, per design. Left the repo in its EXACT pre-test state
    afterward: `functional-model/cards/summon-bahamut/progress.json`'s
    `review` was already `'ai'` before this task (a parallel engine-agent
    session had it mid-edit, unrelated to this task — visible in
    `git diff` as `lastVerified`/`notes`/`knownGaps` changes that predate
    this task), so after testing I manually stripped just the two keys my
    test round-trip added (`oracleTextSnapshot`/`reviewedAt`) rather than
    `git checkout`ing the file (would have destroyed that other session's
    legitimate uncommitted work) — confirmed via `git diff` afterward that
    the only remaining diff on that file is the pre-existing engine-agent
    edit, zero trace of my own test left.
  - `npx vue-tsc --noEmit -p .`: exit 0, clean.
  - Did not touch anything under `functional-model/` (engine-owned) besides
    the transient test round-trip on `progress.json`, fully reverted. Did
    not touch `FunctionalModelText.vue`/`app/types.ts`/`app/lib/factOrder.ts`
    (parallel in-flight annotated-text rewrite) — confirmed by grep, this
    task's diff is scoped to exactly `review-status.ts` +
    `[number].vue`'s one `toggleReviewStatus` body-literal edit.
  - No `.claude/contracts/card-schema.md` mismatch to flag — this task
    doesn't touch the `annotations`/`AnnotationRef` rework itself, just adds
    a sibling `progress.json` field the contract's existing "progress.json —
    review/tagging progress state" line already covers generically (didn't
    itemize progress.json's own field list, so no update needed there).

- 2026-09-11 (later): Two small additive changes to
  `app/pages/app/card/[set]/[number].vue`, dispatched together (same file,
  sequenced to avoid a race with a separate in-flight engine edit to
  `summon-bahamut/synergy.json` — that file was NOT touched here).
  1. **Facts tab debug column**: user spotted a real duplicate-labeling bug
     on fin/1 (two rows both "Enters the battlefield / self" — flagged
     separately for the `engine` agent, not fixed here) and asked for a
     standing way to inspect a row's raw `Fact` JSON without switching to
     the JSON tab/devtools. Added a new trailing `<td>` per Facts row:
     compact single-line `JSON.stringify(fact)` in small muted monospace
     (`text-[10px] text-muted/50`, matches the JSON tab's own `<pre>`
     styling), full pretty-printed (`JSON.stringify(fact, null, 2)`) as the
     `title` attribute for hover — same "compact in-cell, detail on hover"
     convention the label cell already uses for `sourceText`. New
     `SHOW_FACT_DEBUG_COLUMN = true` const (default ON — standing debug aid,
     not the value/weight column's existing default-OFF convention) plus
     `factDebugJson`/`factDebugJsonPretty` helpers next to `factLabel`/
     `factLinkTitle`. Group-header colspan updated to
     `(SHOW_FACT_VALUE_COLUMN ? 4 : 3) + (SHOW_FACT_DEBUG_COLUMN ? 1 : 0)`
     so a multi-face card's section header still spans the true visible
     column count with both toggles independent. Purely additive — didn't
     touch the value bar/role icon/label/conditions columns.
  2. **JSON tab → modal**, same-session follow-up ask (user found the
     inline `<pre>` "very hard to read" squeezed into the tab's small
     fixed-height box): replaced that inline `<pre>` with a
     `<UButton>View JSON</UButton>`; content unchanged (same
     `functionalModelJson` computed, already pretty-printed) now renders in
     a `UModal` (`v-model:open="jsonModalOpen"`, `title="Functional model
     JSON"`, `:ui="{ content: 'max-w-3xl' }"`) opened on click, placed at
     the template's top level as a sibling of the page's root `<div>` —
     mirrors `AppHeader.vue`'s own only pre-existing `UModal` usage in this
     codebase exactly (same `v-model:open`/`title`/`#body` slot shape; that
     was the only other call site, checked via grep first). No new
     import needed — `UModal`/`UButton` are Nuxt UI auto-imports, confirmed
     by `AppHeader.vue` itself importing neither explicitly.
  - Verified live (Playwright, throwaway scripts copied into the repo root
    then deleted after — module resolution needs `node_modules` on an
    ancestor path, per this project's own established convention) against
    the already-running dev server: fin/1 (migrated, 13 facts) — debug
    column present on all 13 rows, one screenshot confirms readable compact
    JSON per row with existing columns (icon/label/conditions) visually
    unaffected; fin/196 (still-unmigrated legacy bare-`zone` shape) — debug
    column correctly shows that different shape (`{"zone":...,"subject":
    "self",...}` vs. fin/1's `to`/`from` rework shape), confirming the
    column is a raw passthrough with zero shape assumptions, not a
    v2-only feature. JSON-tab modal: clicking "View JSON" pops a real
    modal titled "Functional model JSON" containing the full pretty JSON
    (screenshot confirms), page dims behind it (standard UModal overlay).
  - `npx vue-tsc --noEmit -p .`: exit 0 (checked after each of the two
    changes). `npx vitest run app/lib/factConditions.test.ts
    app/lib/factOrder.test.ts`: 30/30 pass, unaffected (this task touched
    only the page template/script, not either lib file).
  - No `.claude/contracts/card-schema.md` mismatch — both changes are
    pure app/-side display/interaction changes, no engine-owned `Fact`
    shape read differently than before (the debug column deliberately
    passes the whole object through verbatim via `JSON.stringify`, so it
    can't itself drift from whatever shape `Fact` actually is).
  - Did NOT touch `functional-model/cards/summon-bahamut/synergy.json` or
    `scenarios.ts` per explicit instruction (another agent mid-edit there);
    the real duplicate-label bug that prompted this task is that agent's
    fix, not addressed here.
  - **Same-session correction/follow-up**: the "hard to read, make it a
    modal" ask was actually about the debug column's own inline
    hover-title (item 1 above), not the separate JSON tab (item 2) — I'd
    misread it as the latter first. Fixed by generalizing: renamed
    `jsonModalOpen` to a reusable `debugModalOpen`/`debugModalTitle`/
    `debugModalContent` trio plus one `openDebugModal(title, content)`
    setter, backing a SINGLE shared `UModal` used by both callers rather
    than two near-identical modals. The JSON-tab button now calls
    `openDebugModal('Functional model JSON', functionalModelJson ?? '')`;
    each Facts-row debug cell's text is now wrapped in a `cursor-pointer
    hover:text-text hover:underline` `<span>` (same interactive-label
    convention `factLabel`'s own cursor-pointer already uses) with
    `@click="openFactDebugModal(row.fact)"` — a new small helper that calls
    `openDebugModal` with a per-fact title (`` `Fact JSON — ${fact.id ??
    factKey(fact)}` ``) and `factDebugJsonPretty(fact)` as the body. The
    cell's native `:title` attribute (the original, still-hard-to-read
    hover tooltip) is REMOVED entirely — click-to-modal fully replaces it,
    not layered alongside it. `factDebugJson`/`factDebugJsonPretty`
    themselves are unchanged; only how the pretty version surfaces
    changed. Label/notes columns untouched, scoped purely to the debug
    column per instruction.
  - Verified live: clicking a Facts-row debug cell (fin/1's "Cast a spell"
    row) opens a modal titled "Fact JSON — self-cast" with that one fact's
    full pretty JSON (screenshot confirms); the JSON tab's "View JSON"
    button still opens the same shared modal with the whole-model JSON
    under its own title — both reuse one `UModal` instance correctly, no
    stale `jsonModalOpen` references left (grepped clean).
    `npx vue-tsc --noEmit -p .` exit 0; `npx vitest run
    app/lib/factConditions.test.ts app/lib/factOrder.test.ts` 30/30 pass
    (unaffected, no lib file touched by this round either).
  - **Third same-session addendum**: added JSON syntax color-highlighting to
    both of these modals. Checked for an existing `highlight.js` usage
    first (`grep`) — found one already-established pattern,
    `FunctionalModelScript.vue` (highlights the Card Definition tab's
    TypeScript source): `highlight.js/lib/core` + registering only the one
    needed language module (avoids bundling every language hljs knows),
    `v-html`-bound `<code>` inside a `<pre>`, and — deliberately, per that
    file's own comment — NO stock hljs theme stylesheet; instead a small
    scoped `<style>` block hand-maps hljs's token classes onto this app's
    OWN existing palette (the same hex values `ForgeCardScript.vue`'s
    `FORGE_LINE_COLORS`/the card page's `SYNERGY_ROLE_COLORS` already use),
    with every selector wrapped in `:global(...)` since `v-html` content
    never receives Vue's scoped `data-v-xxxx` attribute. Followed this
    exact pattern rather than pulling in a `highlight.js/styles/*.css`
    theme (would fight the app's own dark theme, and there's already a
    from-scratch precedent one file away).
  - New shared `app/components/JsonHighlight.vue` (`props: { json: string
    }`, `hljs.registerLanguage('json', ...)`, single-root `<pre><code
    v-html=.../></code></pre>`) — one small component reused by BOTH
    modals rather than duplicating the `hljs.highlight()` call twice, per
    the coordinator's explicit ask. JSON's own hljs token set (confirmed by
    reading `node_modules/highlight.js/lib/languages/json.js` directly):
    `.hljs-attr` (keys), `.hljs-string`, `.hljs-number`, `.hljs-literal`
    (true/false/null), `.hljs-punctuation` (braces/colons/commas — JSON has
    no keyword/built_in/title tokens, so those `FunctionalModelScript.vue`
    mappings don't apply here). Mapped: attr → cyan `#9dcacf` (matches
    `FunctionalModelScript.vue`'s keyword color), string → green `#9ecfa0`
    (matches its string color), number/literal → purple `#cfa9d8` (matches
    its number/literal/type color), punctuation → `var(--color-muted)`.
    Component's own root `<pre>` only carries font/text-size classes
    (`font-mono text-[10px] leading-relaxed text-text/80`); layout classes
    (`max-h-[70vh] overflow-auto rounded border border-border bg-panel
    p-2`) are passed in as a plain `class` attr from each call site and
    land on that same root via Vue's normal single-root attrs fallthrough
    — no `inheritAttrs: false`/explicit passthrough plumbing needed.
  - Card page's shared debug-modal body (`<template #body>`) now renders
    `<JsonHighlight :json="debugModalContent" class="max-h-[70vh]
    overflow-auto rounded border border-border bg-panel p-2" />` in place
    of the old plain `<pre>{{ debugModalContent }}</pre>` — no other change
    to `debugModalOpen`/`debugModalTitle`/`openDebugModal`/
    `openFactDebugModal` wiring from the prior addendum; this was purely a
    "how does the body render" swap. No explicit import needed —
    `JsonHighlight` auto-imports from `app/components/` same as
    `FunctionalModelScript`/`ForgeCardScript` already do in this same file
    (confirmed via grep: neither has an explicit import statement either).
  - Verified live (Playwright): both modals — the Facts-row "Fact JSON —
    self-cast" modal and the JSON tab's "Functional model JSON" modal —
    render real `.hljs-attr`/`.hljs-string`/`.hljs-number`/`.hljs-literal`
    spans (12 tokens on the single-fact modal, 291 on the whole-model one)
    with the colors described above; screenshots confirm cyan keys, green
    string values, purple `-1`/`1` numeric values, muted punctuation,
    matching `FunctionalModelScript.vue`'s established look exactly.
    `npx vue-tsc --noEmit -p .` exit 0; `npx vitest run
    app/lib/factConditions.test.ts app/lib/factOrder.test.ts` 30/30 pass.
  - No contract mismatch — pure app/-side display component, no
    engine-owned shape touched.
  - **Fourth same-session correction (partial revert)**: the JSON tab
    itself should NOT go through the button/modal — that indirection was
    only ever meant for the Facts-tab per-fact debug cells. Reverted the
    JSON tab back to rendering directly inline, but keeping the new
    `JsonHighlight` coloring (not the old plain `<pre>`): `<template
    v-else-if="store.functionalModelTab.value === 'json'">` now renders
    `<JsonHighlight :json="functionalModelJson ?? ''" class="max-h-[32rem]
    overflow-auto rounded border border-border bg-panel p-2" />` directly
    — no button, no click required. Sized `max-h-[32rem]` (matches
    `FunctionalModelScript.vue`'s own Card Definition tab box, a fair
    "how big should the non-modal one be" default) instead of the old
    modal's `max-h-[70vh]` (kept only on the Facts-cell modal, where the
    extra room is still warranted). The shared `debugModalOpen`/
    `debugModalTitle`/`debugModalContent`/`openDebugModal` machinery and
    its `UModal` are UNCHANGED and left in place — still exactly what the
    Facts-tab debug cells use, per instruction. Updated the stale
    doc-comment above `debugModalOpen` (previously described BOTH the JSON
    tab and Facts-cell as modal callers) to describe it as
    Facts-debug-cell-only now.
  - **Fifth same-session correction (debug column → icon-only)**: the
    Facts-tab debug cell itself should show ONLY a trigger, no raw JSON
    text at all. Replaced the clickable compact-JSON `<span>` with a plain
    `<Icon name="lucide:braces" class="h-3.5 w-3.5 cursor-pointer
    text-muted/50 hover:text-text" title="View this fact's raw JSON"
    @click="openFactDebugModal(row.fact)" />` — same `h-3.5 w-3.5` sizing
    convention the row's own role icon (source/sink `lucide:log-out`/
    `lucide:log-in`) already uses. Deleted the now-fully-unused
    `factDebugJson()` compact-string helper entirely (only
    `factDebugJsonPretty()` remains, still used by `openFactDebugModal`)
    — nothing else referenced it.
  - Verified live (Playwright) after both corrections together: Facts tab
    — 13 icon-only debug cells on fin/1 (confirmed via the icon's own
    `title` attribute, `[title="View this fact's raw JSON"]`, count 13);
    a debug cell's own `<td>` `textContent` is empty string (no visible
    JSON anywhere in the cell, just the icon); clicking the icon still
    opens the correct per-fact modal (`Fact JSON — self-cast` for the
    first row, full pretty+highlighted content, screenshot confirms).
    JSON tab — zero "View JSON" buttons found; `.json-highlight-root`
    renders directly in the tab body (count 1) with real highlighted
    tokens (162 `.hljs-attr` matches on fin/1's full model JSON);
    screenshot confirms colored JSON visible immediately, no click
    needed, roomier than the pre-this-whole-task original box.
    `npx vue-tsc --noEmit -p .` exit 0; `npx vitest run
    app/lib/factConditions.test.ts app/lib/factOrder.test.ts` 30/30 pass.
  - Net state after all five rounds this session: Facts-tab debug column =
    icon-button-only, opens a per-fact modal with highlighted JSON. JSON
    tab = highlighted JSON rendered directly inline, no modal. Both share
    `JsonHighlight.vue`; only the Facts-tab side uses the `UModal`/
    `debugModal*` machinery.

- 2026-09-11: Wired the Facts tab's notes/conditions column to engine's new
  SOURCE `ZoneFact.to`/`from` zone-CHANGE shape (2026-09-11 rework,
  `functional-model/synergy.ts`). **`describeFact()` already fully handled
  the LABEL side with zero card-agent changes needed** — it calls
  `zoneMovementName(fact.from, to)` internally and falls back to the
  unchanged bare "<zone> presence" phrasing when the (from,to) pair isn't
  catalogued, so the Facts tab's `factLabel`/`factKey` (both call
  `describeFact` directly, `app/pages/app/card/[set]/[number].vue`) needed
  NO changes at all — confirmed live, fin/1's `self-battlefield` renders
  "Enters the battlefield" and `self-sacrifice-graveyard` renders "Dies"
  purely from the existing import.
  - **Real change was the notes column** (`app/lib/factConditions.ts`):
    added `movementOriginPhrase(fact: ZoneFact)` — shows `from <zone>` in
    the notes column ONLY when the movement's origin is real, declared data
    NOT already implied by a named movement (checked via
    `zoneMovementName(fact.from, to)` returning truthy = redundant, skip).
    E.g. "Dies" already means battlefield→graveyard per CR 700.4 regardless
    of cause (per `ZONE_MOVEMENT_NAMES`'s own doc comment) — repeating "from
    battlefield" in the notes column for `self-sacrifice-graveyard` would be
    pure noise, so it's suppressed; a hypothetical future `(from:'Library',
    to:'Exile')` fact (no catalogued name) WOULD show "from library" since
    the fallback "<zone> presence" label says nothing about origin. Never
    shows `to` itself (always redundant with either the movement name or the
    zone the fallback label already names). Added `to`/`from` to
    `HANDLED_OR_LABEL_KEYS` so they never leak raw via the generic
    `formatUnknown` fallback loop (would have rendered "to: Battlefield" as
    a bit otherwise, since that loop is exclusion- not allowlist-based).
  - **Real bug found and fixed in the same file**: the `constraintPhrases`
    call site picking a zone's plural noun (`ZONE_NOUN[fact.zone] ??
    'permanents'`) read `fact.zone` directly — for a rework-shaped fact
    with only `to` set, `fact.zone` is `undefined`, so it always fell back
    to generic `'permanents'` regardless of the real destination zone (e.g.
    a hypothetical `to:'Graveyard', types:{has:['Creature']}}` fact would
    render "creature permanents" instead of "creature cards"). No currently-
    authored fact exercises this (both of summon-bahamut's converted facts
    have no `types`/`cmc` constraint), so it wasn't visibly broken yet, but
    would have silently misrendered the first migrated fact that does carry
    one. Fixed by adding a local `effectiveZone(fact: ZoneFact)` — a small
    stable duplicate of `synergy.ts`'s own (unexported) private
    `effectiveZone`, same "small duplicate rather than widen the engine
    import" trade this file already uses for `typeBits`/`ZONE_NOUN` — and
    using it at that call site instead of raw `fact.zone`. Added a
    dedicated test (`to`-only fact with `types.has` → asserts "creature
    cards", would have been "creature permanents" pre-fix).
  - **Real regression found and fixed, NOT part of this file at all**:
    `server/utils/functionalModelPool.ts`'s own `isV2Shaped()` — a 4th, until
    now unknown-to-engine local copy of the same predicate `engine`'s own
    notes document fixing in 3 places (`scripts/{verify-synergy,
    find-synergies,compute-weights}.mjs`) — still only checked `'zone' in f
    || 'event' in f`. Since summon-bahamut's two converted facts have
    neither key anymore (only `to`/`from`), the pool's `.every()` check
    failed for the WHOLE card, `loadCardSynergy` returned `null`, and the
    live Facts tab regressed to "Not yet migrated to v2 synergy.json." —
    confirmed via a real Playwright screenshot before the fix. This is the
    file `server/api/card/[set]/[number].ts` (in-lane) actually calls for
    both its prod and dev code paths, so it's what the browser really sees,
    not just an internal helper. Fixed by widening the same `.every()`
    predicate to also accept `'to' in f || 'from' in f`, mirroring exactly
    what `engine` already did to its own 3 copies. Restarted the dev server
    fresh (server-side file — same documented stale-HMR gotcha as
    always) and reconfirmed live: fin/1's Facts tab now shows "Facts 13"
    (was "Not yet migrated...") with all 13 rows rendering correctly.
  - Verified live via throwaway Playwright scripts (repo-root temp files,
    deleted after — module resolution needs `node_modules` on an ancestor
    path): fin/1's 13-row Facts table — `self-battlefield` → label "Enters
    the battlefield", notes "self" (no redundant to/from noise);
    `self-sacrifice-graveyard` → label "Dies", notes "self" (same); the two
    `mega-flare-you`/`mega-flare-opp` SINK facts unaffected, still "Battlefield
    presence" / "yours"/"other" (sinks never get `to`/`from`, untouched by
    design). fin/196 (A Realm Reborn) — a genuinely still-unmigrated card
    with a bare-`zone` source fact — renders unchanged ("Battlefield
    presence" / "self"), confirming no regression pool-wide.
    `npx vitest run app/lib/factConditions.test.ts app/lib/factOrder.test.ts`
    30/30 pass (6 new: 2 updated stale fixtures for the real current
    `self-battlefield`/`self-sacrifice-graveyard` on-disk shape — the old
    tests still asserted the pre-rework bare-`zone` shape and stale id — plus
    4 new cases covering non-redundant `from`, sink-untouched,
    legacy-bare-`zone`-untouched, and the `effectiveZone` noun fix).
    `npx vue-tsc --noEmit -p .` exit 0.
  - **Contract gap to flag for orchestrator**: `synergy.ts`'s own private
    `effectiveZone` is NOT exported (confirmed via grep — no `export`
    keyword) despite the task brief's phrasing implying it might be
    ("...(if exported)"). Not blocking — this file already had an
    established "small stable local duplicate" convention for exactly this
    kind of single small engine-internal helper (`typeBits`/`ZONE_NOUN`), so
    a local `effectiveZone` mirror here was the right call either way — but
    worth `engine` knowing a second consumer (this file) now depends on the
    exact same `zone ?? to` derivation staying in sync if that private
    function's own logic ever changes shape.
  - **Not a `card-schema.md` mismatch** — the contract's existing "generated
    output" framing (`synergy.json`/`trace.json` shapes) was accurate
    throughout; the regression was a local, un-flagged 4th duplicate of a
    predicate `engine`'s own rework already knew to widen elsewhere, not a
    stale contract description.

- 2026-09-10 (even later): `app/lib/factConditions.ts`'s omitted-`controller`
  case ("either player") now emits NOTHING in the notes column, matching
  `recipientPhrase`'s existing omitted-`recipient` treatment fixed earlier
  the same day — was previously the literal phrase "either player's".
  `controllerPhrase(side: Side)` narrowed to take a real `Side` only (no
  more `undefined` branch); the call site in `factConditions()` changed
  from unconditional `bits.push(controllerPhrase(fact.controller))` to an
  `else if (fact.controller)` guard alongside the existing `isSelfReferencing`
  branch — so a genuinely either-player fact contributes zero bits for this
  dimension instead of a neutral placeholder. Updated the 5 test
  expectations in `factConditions.test.ts` that depended on the old
  "either player's · ..." prefix (destroy-nonland, types.hasAny, counterType
  weird-case, cmc/power/toughness/amount/name stat-check) to drop that
  prefix entirely; all 19 tests still pass. Verified live via Playwright
  against the running dev server (`/app/card/fin/1` Summon: Bahamut's
  "Dying → nonland permanent" row, and a second real-pool example,
  `/app/card/fin/9` Battle Menu — its `destroy`/pump/token sink+source facts
  that never set `controller` — both render with the controller dimension
  fully absent now; "yours"/"other" still show correctly wherever
  `controller` actually is set). No contract mismatch found — this was
  purely a card-owned presentation file, `card-schema.md` wasn't implicated.

- 2026-09-10 (later still): Removed the Facts tab's small link-icon glyph
  entirely per explicit instruction — coverage is now complete (every fact
  links to either a body oracle-text span via `isFactAnnotated` or the
  header name via `isHeaderLinkedFact`), so the icon was on every row and no
  longer distinguished anything. Kept the underlying link BEHAVIOR, moved
  onto the row's own label `<span>` instead of a dedicated icon element.
  - `app/pages/app/card/[set]/[number].vue`: deleted the icon-slot `<span>`
    + two conditional `<Icon name="lucide:link-2">` elements from each Facts
    row. New helpers next to `factLabel`: `factLinkTitle(fact)` (returns
    'Linked to card text' for `isFactAnnotated`, 'Linked to the card name
    above — click to jump to it' for `isHeaderLinkedFact`, else
    `undefined`), `onFactLabelEnter`/`onFactLabelLeave` (set/clear
    `headerHighlightIndex` — only when `isHeaderLinkedFact`, no-op
    otherwise) and `onFactLabelClick` (calls the existing
    `scrollToHeaderName(factFaceIndex(fact))` — only when
    `isHeaderLinkedFact`). The label `<span>` itself now carries
    `:title="factLinkTitle(...)"`, `:class="{ 'cursor-pointer':
    isHeaderLinkedFact(...) }"`, and the three handlers above wired to
    `@mouseenter`/`@mouseleave`/`@click`. A body-linked fact's own
    cross-highlight (hovering it highlights its oracle-text span, and vice
    versa) needed NO new wiring at all — it already came from the row's own
    pre-existing `<tr>` `@mouseenter="hoveredFactKey = factKey(row.fact)"`/
    `@mouseleave` handlers, untouched; only the header-linked case's EXTRA
    behavior (flash+scroll+tooltip on the header name, not just the row
    background) needed to move off the deleted icon onto the label.
  - `isFactAnnotated`/`isHeaderLinkedFact`/`headerHighlightIndex`/
    `scrollToHeaderName`/`factFaceIndex` themselves are all UNCHANGED —
    this was purely a "where does the interaction attach in the DOM"
    change, not a logic change.
  - Verified live: killed the already-running dev server and started a
    fresh one (per this project's own documented stale-HMR gotcha), then
    ran throwaway Playwright scripts (repo-root temp files, deleted after —
    `node_modules` resolution needs them inside the tree) against
    localhost:3000. fin/1: zero `lucide:link-2` icons found anywhere in the
    DOM (explicit locator + full DOM scan, both 0); every one of its 12
    fact rows now carries a real `title` on its label span (7 "Linked to
    card text", 5 "Linked to the card name above..." — matches
    `isFactAnnotated`/`isHeaderLinkedFact` exactly, no untitled/unlinked
    row). Hovering a header-linked label ("Cast a spell") flashes "Summon:
    Bahamut" with `bg-blue-400/20`; clicking it pops the real header
    tooltip (confirmed via `.fixed.z-20` element text: "cast a spell—enters
    the battlefield—battlefield presence—counters—dying"). Hovering a
    body-linked label ("Graveyard presence") highlights the matching oracle
    span ("Sacrifice after IV") with `bg-surface/60`. fin/221 (Garland,
    Knight of Cornelia // Chaos, the Endless): front-face self fact
    ("Battlefield presence") hover highlights "Garland, Knight of
    Cornelia"; back-face self fact ("Library presence") hover highlights
    "Chaos, the Endless" independently, and clicking it pops a tooltip
    scoped to just that back-face fact ("library presence") — confirmed the
    icon removal didn't disturb per-face routing.
  - `npx vue-tsc --noEmit -p .`: exit 0, clean.
  - No contract mismatch found against `.claude/contracts/card-schema.md` —
    pure app/-side display simplification, no engine-owned shape touched.

- 2026-09-10 (later): Hidden the Facts tab's value/weight column (`ValueBar`
  1-5 dots) per explicit request — display-only toggle, data/component both
  kept. `app/pages/app/card/[set]/[number].vue`: new top-level
  `const SHOW_FACT_VALUE_COLUMN = false` (script setup, near the top);
  the `<td><ValueBar :value="row.fact.value" /></td>` cell now has
  `v-if="SHOW_FACT_VALUE_COLUMN"` and the group-header row's `colspan`
  became `:colspan="SHOW_FACT_VALUE_COLUMN ? 4 : 3"` so a multi-face card's
  section header still spans exactly the visible column count. Flip the
  const back to `true` to restore — no other change needed, nothing deleted.
  - Context: a parallel `engine` task is introducing `-1` as a valid
    `Weight` meaning "not yet reviewed" (distinct from a real 1-5 magnitude)
    on some hand-authored self facts. Checked every other `ValueBar` call
    site (`grep -rn ValueBar app/`): exactly one other exists,
    `FunctionalModelText.vue`'s own hover tooltip (shown on hovering an
    annotated oracle-text phrase, AND — since the header-name self-fact
    feature landed earlier the same day — on hovering a self-linked face
    heading). That usage is NOT hidden by this task, so it needed its own
    -1 safety: fixed `ValueBar.vue` itself (not the call site) with a small
    `isRealValue = (v) => typeof v === 'number' && v > 0` guard, used in all
    three places the raw `value` prop was read (title, per-dot fill class,
    text overlay) — a `-1` (or `0`) now renders as a neutral empty bar +
    "—" text/title, same as the existing "no value at all" (`undefined`)
    case, instead of a nonsensical "value -1/5" title with 0 dots filled by
    coincidence of the `n <= value` comparison (which happened to already
    produce 0 filled dots for -1, but the title/text overlay would have
    shown the literal "-1"). This is a real behavior change to the shared
    component, not just the hidden column — deliberate per the task's own
    instruction to fix it at whichever call site makes sense.
  - Verified live: restarted the dev server (was not running at task start;
    started fresh rather than risk stale HMR per this project's own
    documented gotcha — see the 2026-09-09 part 5 entry below). Screenshot
    of fin/1's Facts tab: table rows now show only 3 columns (role icon,
    label, conditions) — confirmed via a throwaway Playwright DOM query too
    (`tbody tr td` count 4 → 3, the `ValueBar` `<td>` renders as a
    `<!--v-if-->` comment). Screenshot of the header self-fact tooltip
    (hovering "Summon: Bahamut") still shows real ValueBar dots correctly
    (4-5 filled) for its existing real 1-5 values — that surface is
    deliberately untouched/still visible, confirmed working. No card in
    the corpus currently carries a real `-1` yet (checked
    `summon-bahamut/synergy.json`, the card the parallel engine task is
    actively editing — all `value` fields still 1-5 as of this check), so
    the -1 fallback itself couldn't be exercised end-to-end live; verified
    by direct code reading instead (`isRealValue(-1)` is `false` by
    construction).
  - `npx vue-tsc --noEmit -p .`: exit 0, clean.
  - No contract mismatch found against `.claude/contracts/card-schema.md`
    — pure app/-side display change, `Fact.value`'s own shape/range
    (including the new `-1` sentinel) is engine-owned and untouched here.


Scoped working memory for the `card` specialist. Update before finishing
any task: decisions made, open questions, current state worth resuming
from. This is what makes a fresh respawn cheap — don't rely on transcript
resume alone (session transcripts are swept after ~30 days).

## Decisions

- 2026-09-10 (layout fix, follow-up to the self-fact-header-linking work
  below): removed the page-level `<h1>{{ card.name }}</h1>` from
  `app/pages/app/card/[set]/[number].vue` entirely (it duplicated the name
  already shown right above the mana cost/type line/oracle text, inside
  `FunctionalModelText.vue`'s own per-face heading) — per explicit
  correction, the self-fact underline+tooltip feature (`headerFaceFacts`)
  moved to anchor on THAT lower heading instead of the removed one.
  - `FunctionalModelText.vue`: new optional props `selfFacts?: Map<number,
    AnnotatedFactRef[]>` (keyed 0 front/only, 1 back — same `factFaceIndex`
    convention the page already used) and `headerHighlightIndex?: number |
    null`. Each face's own `<span>{{ face.name }}</span>` heading, when that
    face has any entries in `selfFacts`, now gets the identical dashed blue
    underline + `bg-blue-400/20` highlight class + hover behavior — reusing
    this component's OWN existing `show()`/`hide()` tooltip machinery (same
    floating Teleport already rendering the body-phrase tooltips) rather
    than duplicating a second copy, by constructing a synthetic
    `AnnotatedSegment` (`{ text: face.name, facts: selfFacts.get(fi) }`) and
    passing it to `show()` on `@mouseenter`. This also means hovering a
    self-fact-linked face name now naturally emits the same `hover` event
    body-phrase hovers already do, cross-highlighting the matching Facts
    table row too — a bonus consistency win, not separately requested but
    matches the existing "same tooltip content/behavior" convention.
    New `faceNameEls` template-ref array + `defineExpose({ scrollToFace
    (index) {...} })` (`scrollIntoView` + pop the tooltip + auto-hide after
    1600ms) replaces the page's own former `headerNameEls`/
    `setHeaderNameEl`/`scrollToHeaderName` DOM-reaching — the page now calls
    `functionalModelTextRef.value?.scrollToFace(faceIndex)` via a plain
    template ref onto the component instance instead.
  - `app/pages/app/card/[set]/[number].vue`: deleted the `<h1>` block, its
    dedicated Teleport tooltip, and all its now-dead backing state
    (`headerHovered`, `headerTooltipEl`, `headerTipX`/`headerTipY`,
    `showHeaderTooltip`/`hideHeaderTooltip`, `headerPositionRequestId`,
    `headerNameEls`/`setHeaderNameEl`, `headerNameParts`) — along with the
    now-unused `nextTick`/`computePosition`/`offset`/`flip`/`shift`/`size`/
    `ComponentPublicInstance` imports. Kept `headerFaceFacts` (the actual
    per-face self-fact data, now passed to `FunctionalModelText` as
    `:self-facts`) and `headerHighlightIndex` (now passed down as
    `:header-highlight-index`) unchanged — both are still shared with the
    Facts table's own header-linked row icon
    (`isHeaderLinkedFact`/`scrollToHeaderName`), just re-plumbed to the new
    location. `deckQty`'s "×N copies in your deck" badge (previously
    sitting next to the name in the removed `<h1>`) moved to the top
    nav row instead, beside "← Back to graph" — a plain `<div class="flex
    items-center gap-3">` wrapper keeps the row's existing `justify-between`
    (Back to graph+qty on the left, Previous/#N/Next on the right) intact.
  - Verified live (Playwright, throwaway scripts run from inside the repo
    root — `node_modules` resolution — deleted after) against the already-
    running dev server: fin/1 — only one `<h1>` left on the page at all
    (the app-shell's own "MtG Synergy Map", unrelated), "Summon: Bahamut"
    directly above the oracle text now carries the underline, hover pops
    the same 5-fact tooltip (Cast a spell/Enters the battlefield/Battlefield
    presence/LORE counters on itself/Dying — same set `headerFaceFacts`
    already produced before this move; see the entry below for why this is
    5, not the task's originally-quoted 7, an unrelated pre-existing/
    upstream-data reason, not a regression from this move). Facts table's
    header-linked row icon still correctly flashes (`bg-blue-400/20`) the
    heading on hover and, on click, scrolls to it + pops its tooltip.
    fin/221 (Garland, Knight of Cornelia // Chaos, the Endless): both face
    headings render independently — front face's own heading shows its 2
    front self facts (Battlefield/Graveyard presence), back face's own
    heading shows its 1 back self fact (Library presence) — never the
    combined/front title, confirming the per-face anchor survived the move
    to the new component.
  - `npx vue-tsc --noEmit -p .`: exit 0, clean.
  - No contract mismatch found against `.claude/contracts/card-schema.md` —
    pure app/-side (card page + `FunctionalModelText.vue`) change, no
    engine-owned shape touched.

- 2026-09-10 (correction to the immediately-preceding "(Card Name) in notes
  column" entry below — same-day misunderstanding, now reverted+replaced):
  the user actually wanted a self-referencing baseline fact (no natural
  oracle-text span — `isSelfReferencing`, e.g. fin/1's "Cast a spell") to
  get the SAME underline+hover-tooltip annotation treatment
  `annotateOracleText`/`FunctionalModelText.vue` already give a real
  produce/consume fact, just anchored to the CARD'S OWN NAME in the page
  header instead of a body phrase — not a parenthetical string in the notes
  column. Implemented:
  - Reverted `factConditions.ts`'s `cardName` param entirely — self-branch
    is back to pushing the literal `'self'` unconditionally, matching its
    state before that prior entry's task. `isSelfReferencing` is now
    `export`ed (the page needs the same test). Reverted the 3 affected
    `factConditions.test.ts` cases back to asserting `'self'`, dropped the
    now-nonexistent "with a cardName given" case.
  - Page (`app/pages/app/card/[set]/[number].vue`): notes-column call site
    back to `factConditions(row.fact)` (no second arg). Replaced the old
    `factCardName(row)` helper (deleted) with a lower-level `factFaceIndex
    (fact: Fact): number` (0 front/only, 1 back) that `isMainFaceFact` now
    also builds on — same rule, refactored to be usable off a raw `Fact`,
    not just a `FactRow`. New `headerFaceFacts` computed: every
    self-referencing fact that has NO real annotation anywhere
    (`!isFactAnnotated`, i.e. `annotateOracleText` never matched its
    `sourceText`/`highlight` against any face) grouped by `factFaceIndex`
    into `AnnotatedFactRef[]` (same shape `annotateOracleText` itself
    produces, built the identical way: `describeFact` for `description`,
    fact's own `id`/`role`/`value`/`sourceText`). `headerNameParts` maps
    that onto each real `annotatedFaces` entry (falls back to one plain
    unannotated entry off `card.value.name` when there's no synergy data at
    all). Header `<h1>` now renders `headerNameParts` per-face instead of
    the raw `card.name` string, with a real dashed-underline span (same
    Tailwind classes `FunctionalModelText.vue` uses) + a small self-
    contained floating-ui tooltip (own `computePosition`/`offset`/`flip`/
    `shift`/`size` copy, not a shared component — deliberate, see the code
    comment: single header phrase vs. a whole paragraph of segments, only
    the VISUAL result needs to match, which it does — same role-icon +
    bare-description + `ValueBar` tooltip content as the oracle-text one).
  - **Bug found and fixed along the way**: `factFaceIndex`'s pre-existing
    fallback heuristic (`mainFaceFactKeys.has(...)` — "does this fact have a
    real oracle-text match on face 0") was previously only ever consulted
    when `isMultiFace` was already true (`factRowGroups`'s single-face
    branch short-circuits before calling `isMainFaceFact` at all) — so this
    path had never actually been exercised on a single-face card. Reusing
    it unconditionally for `headerFaceFacts` exposed it: for a fact with NO
    match anywhere (exactly `headerFaceFacts`'s target population), the
    heuristic returns "not front" → index 1 → silently dropped on a
    single-faced card (`annotatedFaces` has no index 1 at all, its own
    self-cast/self-enters/etc. facts rendered zero underline). Fixed by
    short-circuiting `factFaceIndex` to always return 0 when
    `annotatedFaces.value.length <= 1`, before consulting `face`/the
    heuristic — multi-face behavior (only path this function previously
    ran on) is bit-for-bit unchanged.
  - Verified live (Playwright, throwaway script run from a temp copy INSIDE
    the repo root — module resolution needs `node_modules` on an ancestor
    path, deleted after) against the already-running dev server: fin/1's
    header "Summon: Bahamut" is now underlined, tooltip lists all 5 real
    unmatched self facts (Cast a spell, Enters the battlefield, Battlefield
    presence, LORE counters on itself, Dying — the concurrent engine-agent
    session had added 2 more self facts than existed when this was scoped;
    the generic `isSelfReferencing`+`isFactAnnotated` logic picked them up
    with no hardcoding either way) with none of them double-linked (the 2
    self facts that DO have a real inline body link — sacrifice-graveyard/
    sacrifice, both anchored to "Sacrifice after IV" — correctly excluded
    from the header tooltip). Notes column back to literal "self" for all 7
    self-referencing rows, zero "(Card Name)" strings anywhere. fin/221
    (Garland, Knight of Cornelia // Chaos, the Endless): front face's own
    name gets the underline+tooltip for its 2 front self facts (Battlefield/
    Graveyard presence), the BACK face's own name independently gets it for
    its 1 back-face self fact (Library presence) — never the front name or
    a combined title, confirming the face-index fix didn't disturb the
    already-correct multi-face `fact.face`-driven path.
  - Flag for whoever authors self-baseline facts next (engine-side,
    `functional-model/cards/summon-bahamut/synergy.json` currently, not
    this agent's file to edit): `self-battlefield`'s `sourceText` is
    `"Flying (Summon: Bahamut is itself a flying creature permanent on your
    battlefield)."` — the parenthetical explanation is baked INTO
    `sourceText` itself, so `annotateOracleText`'s own `oracleText.indexOf
    (sourceText)` never matches (only the bare `"Flying"` is real printed
    text) even though `highlight: "Flying"` looks like it should link. Net
    effect observed live: that fact falls through to the header annotation
    instead of getends its own real "Flying" inline link — not wrong
    exactly (the header treatment is a strict superset fallback, so nothing
    is lost), but likely not what that fact's own author intended; probably
    wants its `sourceText` trimmed to just `"Flying"` (or the parenthetical
    moved to a separate field) so it gets the tighter, more precise inline
    link like `self-sacrifice`/`self-sacrifice-graveyard` (whose `sourceText`
    is the plain, literal `"Sacrifice after IV."`, no parenthetical, and
    DOES match) already do.
  - `npx vitest run app/lib/factConditions.test.ts app/lib/factOrder.test.ts`
    (25/25 pass), `npm run typecheck` (exit 0, no errors). No contract
    mismatch found against `.claude/contracts/card-schema.md` — pure
    app/-side (card page + its own lib) change, no engine-owned shape
    touched (`AnnotatedFactRef`/`annotateOracleText` themselves untouched,
    just consumed the same way `FunctionalModelText.vue` already does).

- 2026-09-10 (follow-up refinement to the "self" notes behavior from the
  `factConditions.ts` rewrite): self-referencing facts (`subject`/`target`
  literally `'self'`) now show the card's OWN name in parens in the Facts
  tab notes column instead of the literal word "self" — e.g. fin/1's "Cast
  a spell" reads "(Summon: Bahamut)". Implementation: `factConditions()`
  (`app/lib/factConditions.ts`) gained an optional second param
  `cardName?: string`; the self-branch pushes `` `(${cardName})` `` when
  given, else still falls back to the literal word "self" (kept so
  existing/future tests that don't care about this branch don't all need a
  second arg). The actual name resolution lives in the PAGE
  (`app/pages/app/card/[set]/[number].vue`'s new `factCardName(row)`
  helper), not in `factConditions.ts` itself — that file stays free of any
  `AnnotatedFace`/face-grouping concept, matching its own "dependency-free
  of Vue/page-level state" design note. `factCardName` reuses the
  page's existing `isMainFaceFact(row)` (same per-row main/other decision
  the Facts table's own multi-face grouping already makes) to pick
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
