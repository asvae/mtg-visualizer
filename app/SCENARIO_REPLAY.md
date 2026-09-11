# Scenario replay (`components/ScenarioReplay.vue`, `components/ScenarioReplayTrace.vue`, `lib/scenarioReplay.ts`)

## Why this exists

Every functional-model card carries a `trace.json` — a flat call log
(`LogEntry[]`) produced by running its `scenarios.ts` through
`functional-model/harness.ts`'s `runScenario` (see `functional-model/README.md`
and `ENGINE_DESIGN.md` for what generates this data; this doc only covers the
frontend that plays it back). Before this feature, the card detail page's
Scenarios tab (`TraceViewer.vue`, now deleted) just dumped that log as a flat
table — readable, but you couldn't see the board it was describing.

`ScenarioReplay.vue` reconstructs and animates the actual board (zones, life,
tapped state, counters, keyword badges) step by step from that same log, so a
reviewer can watch a card's ability actually play out instead of reading prose
about it. One `ScenarioReplayTrace` per recorded scenario; `ScenarioReplay` is
just the list wrapper plus one shared cross-scenario concern (filler card
images — see below).

Built and tuned against one card first (`fin/58`, Jill, Shiva's Dominant //
Shiva, Warden of Ice — a DFC with an ETB, an activated transform ability, and
a 3-chapter Saga on the back face) before any rollout to other cards. **Not
yet wired up beyond this one card being the one everyone's tested against —
the component itself has no per-card special-casing, so pointing any other
card's `traces` at it should work as-is, but that rollout hasn't been done.**

## Where the data comes from

- `server/api/card/[set]/[number].ts` returns `functionalModel.traces`, each
  a `{ scenario: { setup, action, result, raw }, log }`. `raw` is the
  scenario's own original `you`/`opponents`/`life` input (harness.ts's
  `Scenario` type) — added specifically for this feature (`TraceResult.scenario.raw`
  in `functional-model/harness.ts`) because the log alone never states the
  STARTING board (every filler card `setupPlayer` manufactures) — only
  mutations get logged. Regenerating `trace.json` for all cards
  (`npx vite-node functional-model/scripts/run-scenarios.mjs`) was required
  once after that harness.ts change.
- `[set]/[number].vue` passes `traces`, the real card's own `images` (front/back,
  Scryfall), and its real printed `keywords` down into `<ScenarioReplay>`.

## `app/lib/scenarioReplay.ts` — pure replay logic, no Vue

This is the part worth reading first; the components are mostly template
plumbing over what this file computes.

- **`replayTrace(trace)`** — the core function. Seeds a starting board via
  `seedPlayerCards`/`initialCards` (mirrors `harness.ts`'s `setupPlayer`
  exactly: same names, same zones, same order — a filler card is identified
  purely by name, e.g. `you-creature-token-0`, `opp0-hand-2`), then replays
  `trace.log` entry by entry, switching on `LogEntry.fn` to mutate zone/tapped/
  counters/life/keywords. Returns one `ReplaySnapshot` per step (index 0 =
  before anything happened), so the component just indexes into this array
  as a slider/step counter moves — no incremental state, no re-derivation.
  Pure and deterministic: same trace always replays the same way, safe to
  `computed()`-memoize per trace (and the component does).
- **DFC canonicalization** — a transforming card's `trigger`/`activate`/`cast`/
  `enters` log entries name whichever face is CURRENTLY active (Jill →
  Shiva after the transform), but `instanceId` (present on all four) stays
  fixed across the transform. `ensureSelf` uses it to collapse both face-names
  onto one chip (`ReplayCard.name` stays the original front name as a stable
  key; `faceName` carries whatever the log just reported, for display and to
  drive the flip animation).
- **Known blind spots** (documented in the file's own header comment, not
  fixed — both rare, both just collapse distinct objects onto one chip):
  a `createToken` batch making more than one token of the same name at once,
  and `duplicateLegendaryEnters`. Neither is disambiguable by name alone from
  the log as it exists today.
- **`entryRefs(entry)`** — loose "what did this step touch" extraction (any of
  `target`/`card`/`player`/`controller`/`source`/`equipment`/`token` fields)
  used ONLY for card-chip highlighting. **Do not reuse this for life
  highlighting** — that was a real bug (see below): plenty of non-life-
  changing entries (`addMana`, `drawCard`, batch `move`/`sacrifice`, `discard`,
  ...) carry a `player` field and would falsely light up the life badge. Life
  highlighting instead compares `prevLife[owner] !== snapshot.life[owner]`
  directly — the same check already used to decide whether to render the
  "(+/-N)" delta text.
- **Board layout** (`CARD_LAYOUT`, `ZONE_PADDING`, `ZONE_GAP`, `ZONE_ORDER`,
  `computeZoneRects`, `boardHeight`) — a zone's box is sized to what it
  actually holds THIS STEP, not a fixed guess: `Battlefield` always reserves
  a 2-slot minimum (`ZONE_ORDER`'s `minSlots`), every other zone only takes
  up space once non-empty, and zones pack left-to-right in `ZONE_ORDER`'s
  fixed sequence, skipping any that's at 0 slots. A card's `(x, y)` is a pure
  function of `(zone, index within zone, current per-owner zone widths)` —
  the component binds this straight to CSS `left`/`top` with a `transition`,
  so a card changing zones (or a zone box resizing as its count changes)
  animates by sliding, no FLIP/JS-measured animation needed.
- **`CARD_LAYOUT`** is the one place chip pixel size lives
  (`{ width, height, gap, labelHeight }`, currently `90×126`, ~2.24× the
  original `40×56` baseline). `ScenarioReplayTrace.vue`'s template has to
  match it by hand in a couple of Tailwind arbitrary-value classes (the
  image/flip/placeholder chip's `h-[…px] w-[…px]`) since those aren't bound
  reactively to this constant — bump both together.

## Components

- **`ScenarioReplay.vue`** — thin per-trace loop, plus the one thing worth
  sharing across every scenario on the page: resolving real images for
  non-self filler that's still a real named thing (basic lands via the
  existing `/api/cards/by-names`; named tokens like Treasure/Hero via
  `/api/tokens/by-key`, a small endpoint added for this feature — see
  `functional-model/tokens.ts`'s `TOKENS` map for what it's keyed on). Both
  resolved once per unique name across every scenario the page has, merged
  into one `name -> image url` map (`fillerImages`), passed down. Everything
  else in `setupPlayer`'s filler (a nameless `you-creature-token-0`, etc.)
  has no real identity to fetch an image for and stays a placeholder chip
  (`placeholderLabel` — a 2-letter zone-type abbreviation).
- **`ScenarioReplayTrace.vue`** — one scenario: play/pause/step controls, the
  scenario's own `raw` fields as a small table, per-owner board (one column
  per role from `playerRoles`, `you` always last), and the flat log table
  (click a row to jump to that step; auto-scrolls to the current step via
  `logRows` refs + `scrollIntoView`). `read:*`-prefixed log entries are
  filtered out before replay/display — they're the harness's own
  introspection calls (`hasSubtype`, etc.), not real game events.
  - Card chip: real image when available (`imagesFor` — self's own art, or a
    resolved filler image), else a placeholder; tap state as a 90° rotation;
    a DFC flip via `perspective`/`backface-visibility` (own `<style scoped>`
    block, `.flip-outer`/`.flip-inner.flipped`/`.flip-face.back`) driven by
    whether `card.faceName` is set; counters badge; keyword-icon badges (see
    below) top-left, only for keywords we actually have an icon for.
  - Highlight/pop/life-delta styling is intentionally soft (`border-warn`
    + a light `ring`/`bg` tint, `duration-300` color transitions, a small
    `life-pop` scale-bounce on the life number itself) — an earlier, punchier
    version got explicit feedback to tone it down.
  - Zone boxes are tinted per zone (`ZONE_COLOR`, keyed by `ZoneType`) with
    low-opacity `border`/`bg` utility pairs — subtle by design (also given
    explicit feedback after an earlier pass was too strong); Exile is
    deliberately a muted dark purple rather than red (a red Exile box read as
    an error/danger state, not a zone).
  - The log table caps at a fixed height (`max-h-36`, ~5 rows) with
    `overflow-y-auto` and a `sticky` header, rather than growing to fit the
    whole log — a 13+ step scenario would otherwise push the board itself
    off-screen.

## Keyword-ability icons (`lib/abilityIconPaths.ts`, `components/AbilityIcon.vue`)

A card chip shows small badge icons for keyword abilities (Flying, Trample,
Unblockable, ...) — both a card's own printed keywords (`cardKeywords` prop,
`Scryfall`'s `card.keywords`) and any granted mid-scenario (`grantKeyword` log
entries — `fin/58`'s own Mesmerize chapter grants Unblockable this way).

**These are an original hand-drawn SVG set, not sourced from any existing
product.** Worth recording why, since the obvious move — reuse whatever
MTG client already draws these — was tried first and specifically rejected:

- Keyrune / the "mana" font (keyrune.andrewgioia.com, same author) cover only
  set-expansion and mana-cost symbols. No ability-keyword icons exist there.
- Scryfall's own symbol API (already this codebase's source for mana/set
  symbols — see `ManaSymbol.vue`) has no equivalent for ability keywords.
- Forge's checked-out source and a shallow clone of Cockatrice (both
  open-source MTG engines/clients) were checked for a reusable icon asset —
  neither ships one (Forge's keyword data is plain-text tokenscript, no
  images; Cockatrice's tree has no keyword-icon-named files).
- MTG Arena's client draws these, but isn't installed here, and even where
  installed its internal UI asset bundles are proprietary client assets —
  outside what Wizards' Fan Content Policy licenses for reuse in a separate
  tool (that policy covers card art/names in fan content, not redistributing
  an extracted client's UI icons). A fan wiki mirror of the same Arena
  artwork doesn't change that. This is the same reasoning that already
  distinguishes Scryfall's sanctioned card-image API (used here) from
  scraping some other proprietary asset source — the two aren't the same
  kind of thing just because both are technically "MTG-related and someone
  owns the copyright."

Given no legitimately reusable source existed, `abilityIconPaths.ts` is a small
(~17 keyword) set of original generic pictograms (a shield, a lightning
bolt, an eye, ...) — deliberately generic shapes, not a copy of any specific
product's glyph. `AbilityIcon.vue` just looks up a keyword's path data and
renders it as an inline `<svg>`; `ABILITY_ICON_NAMES` lets a caller check "do
we have an icon for this" before rendering a badge (an icon-less keyword,
e.g. `Legendary`, is silently skipped rather than showing an empty badge).

Reviewed in Storybook first (`AbilityIcon.stories.ts` — `AllKeywords` grid,
`AtBadgeSize` at the actual 10px-in-a-corner render size, `UnknownKeyword` to
confirm the no-icon case is silent) before being wired into the real replay
chips, per explicit request ("first implement it in storybook... let me take
a look" → approved → "Add to these replay cards").

### Real, QUERY-TIME continuous keyword grants (2026-09-12, ENGINE_GAPS.md gap #14)

A printed keyword and a `grantKeyword` log entry are both DISCRETE — some
event/mutation genuinely happened, real trace.json evidence exists for it.
A continuous grant (613 — "Dion, Bahamut's Dominant and other Knights you
control have flying, during your turn"; `functional-model/card.ts`'s own
`CardDefinition.continuousKeywordGrants`) is different: it's a live,
QUERY-TIME fact re-evaluated off current board/turn state
(`functional-model/state.ts`'s `effectiveKeywords`), true or false depending
on the moment, never an event. There is no `fn:'grantKeyword'`-shaped log
entry to represent "the grant is active right now" — a scenario can only
prove it fired with a one-off manual `read:hasKeyword` query at a single
instant (see e.g. `dion-bahamut-s-dominant-.../scenarios.ts`'s own comment),
and even that only ever names the granting permanent itself, never every
OTHER permanent (a Knight token) it might also cover.

So this can't be shown the way every other keyword source is — `card`
(server-side) serves the granting card's own real `continuousKeywordGrants`
(front, then back face) as declarative data (`functionalModel.continuousKeywordGrants`,
`server/api/card/[set]/[number].ts`), and `ScenarioReplayTrace.vue`'s own
`continuousGrantedKeywords(card)` recalculates it FRESH, per board chip, per
snapshot, at render time — cross-referencing the grant's own
`onlyDuringYourTurn`/`includeSelf`/`subtype` fields against that snapshot's
real `activePlayer` and each chip's own `owner`/subtype (subtype resolved via
`functional-model/tokens.ts`'s `TOKENS` registry for a named token creature —
see that function's own doc comment for what a real bystander creature still
can't match, and why `equippedBySelf` isn't wired up yet either). This is
what makes the icon genuinely toggle on/off as the pilot steps through turns
(present on your turn, gone on an opponent's), rather than being baked in
permanently either way — the same "recalculated on read, never cached"
treatment `state.ts`'s own `effectivePT`/`effectiveKeywords` already give
this class of ability engine-side, just re-derived independently here since
engine has no connection to this rendering layer at all (see
`.claude/contracts/card-schema.md`'s "Engine has no connection to card/UI"
rule).

## Known bugs fixed here (worth knowing if something looks similar again)

- **Spurious life highlight**: the life badge's highlight was originally
  bound to the same generic `entryRefs(entry).has(owner)` used for card-chip
  highlighting. Since many non-life-changing log entries carry a `player`
  field (`addMana`, `drawCard`, batch `move`/`sacrifice`, `discard`, ...), the
  life badge lit up on steps that never touched life. Fixed by comparing
  actual life values between steps instead (see `entryRefs` bullet above).

## Not yet done

- Rollout to cards other than `fin/58` — deliberately deferred by request
  ("work out one card, then apply it everywhere"). The component has no
  `fin/58`-specific logic, so this should mostly be "point other cards'
  `traces` at it and spot-check," not a rewrite — but hasn't been tried.
