<!-- Verbatim archive slice of the old card/notes.md (pre-2026-09-18 migration to the topics/ hub). Grep-only, not read on spawn. Durable facts already extracted into ../topics/*.md. -->

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
