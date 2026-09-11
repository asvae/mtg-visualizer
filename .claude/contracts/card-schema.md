# Contract: Engine ↔ Card boundary

Owner of source: **engine** agent. Owner of generated/served output:
**card** agent. If this file drifts from either side's real shape, whoever
noticed says so to the orchestrator — don't silently patch around a stale
contract.

## Per-card functional model (source, `engine` agent owns)

`functional-model/cards/<slug>/`:
- `definition.ts` — exports a `CardDefinition` (see
  `functional-model/card.ts`): `effects: Effect[]`, optional named
  `triggers`, `staticAbilities`, `modal` effect. Data-first — logic lives
  in `Effect` objects the shared `resolveCard()` interpreter dispatches on
  by `kind`, not per-card classes. A `Computed` function or `custom.run` is
  the only escape hatch and is opaque to synergy matching — narrow use only.
- `scenarios.ts` — exports `scenarios: Scenario[]` (see `harness.ts`), or
  `runEngineScenarios(): TraceResult[]` for the real-engine-piloted path
  (see `engine-trace.ts`).

## Generated output (card agent reads/presents, doesn't hand-author)

- `synergy.json` — from `functional-model/synergy.ts`'s
  `findInteractionsForCard`, source/sink facts.
- `trace.json` — `TraceResult[]`, see
  `.claude/contracts/state-event-format.md` for its shape.
- `progress.json` — review/tagging progress state.

## Served shape (card agent owns, `server/api/_cardShaping.ts`)

- `ScryfallCard` / `CardFace` / `ImageUris` interfaces in
  `server/api/_cardShaping.ts` — the live Scryfall-derived shape.
- `minimalCard()` — shrinks a `ScryfallCard` to what the graph/card UI
  actually reads.
- Card identity key across the whole app is **Scryfall name**, not
  `oracle_id` — confirmed 0 collisions across full history. Don't
  re-propose re-keying.

## Fact-to-oracle-text pointers (`annotations`) — 2026-09-11 rework, DONE (updated same day, see below)

`Fact.annotations: [AnnotationRef, ...AnnotationRef[]]` (`functional-model/
synergy.ts`) replaces the old live-recomputed `AnnotatedSegment[][]`
segment-tree design. Both engine and card sides are done for
summon-bahamut (fin/1) — scope was deliberately limited to that one card; a
pool-wide regen is a separate, later decision. `AnnotatedSegment`/
`AnnotatedFactRef`/`annotateOracleText` are confirmed unreferenced anywhere
under `app/`/`server/` and have been deleted outright from `synergy.ts`.

- **`AnnotationRef` shape — two variants**: `{ target: 'oracle', line:
  number, start: number, end: number }` (line 0-indexed within the OWNING
  FACE's own real `oracleText.split('\n')`, Scryfall's own paragraph
  breaks; `start`/`end` character offsets WITHIN THAT LINE ONLY, half-open
  — slice via `oracleText.split('\n')[line]!.slice(start, end)`), or (NEW,
  2026-09-11 later same day) `{ target: 'typeLine', start: number, end:
  number }` — offsets directly into the OWNING FACE's own real, single-line
  `typeLine` string (`CardDefinition.typeLine`/`.backFace.typeLine`) — no
  `line` field at all (a type line has no paragraph structure). Which face
  owns a fact is `Fact.face` (`'front'`/`'back'`/omitted = the only face on
  a single-faced card). The `typeLine` variant exists for a fact whose real
  textual basis genuinely isn't in the ability text at all — a baseline
  "this creature was cast as a creature spell" claim is true because of
  what's printed on the TYPE line, not the oracle-text body (Summon:
  Bahamut's own `self-cast`/`self-enters`).
- **`annotations` is REQUIRED, minimum one entry** (2026-09-11, later same
  day — was optional at first landing) — every fact must carry at least
  one real annotation; a fact with nothing real to anchor to doesn't
  belong in the model at all (fold or drop it, don't fake one). Enforced
  by `functional-model/scripts/annotation-coverage.mjs`
  (`ANNOTATED_CARD_SLUGS` allowlist — today just `summon-bahamut`), wired
  into `verify-synergy.mjs`'s exit code and a standalone
  `annotation-coverage.test.ts` (`npm run test`).
- **Computed ONCE, offline, and baked into `synergy.json`** —
  `functional-model/scripts/compute-annotations.mjs`, from each fact's own
  entry in a NEW, never-served, per-card `cards/<slug>/
  annotations-authoring.json` (`sourceText`/`highlight`/`anchor`,
  positionally aligned with that same card's `synergy.json` `source`/
  `sink` arrays — index-based, not id-keyed, since `Fact.id` is also gone)
  matched against the card's real Scryfall oracle text
  (`data/<set>/<set>_scryfall.json`) or real `typeLine` (straight off the
  already-imported `CardDefinition`, no extra data source). Never
  recomputed live server-side anymore. As of this writing only
  `cards/summon-bahamut/synergy.json`/`annotations-authoring.json` exist —
  a pool-wide regen is a separate, later decision.
- **`sourceText`/`highlight`/`anchor` are NOT on the served `Fact` shape at
  all anymore** (2026-09-11, later same day — they WERE directly on `Fact`
  at first landing; moved out once `annotations` itself became the
  required, real anchor, since the literal string is fully re-derivable by
  slicing `oracleText`/`typeLine` at the baked pointer — storing it twice
  was pure duplication). `curl localhost:3000/api/card/fin/1`'s
  `functionalModel.synergy` facts must NOT contain `sourceText`/`highlight`
  once `card` agent's own serving layer is updated to match (see the
  action items below) — only `annotations` + the real semantic fields
  (`role`, `event`/`zone`/`to`/`from`, `value`, `controller`, `subject`,
  `face`, constraints).
- **New `EventFact.zoneFrom`/`.zoneTo` fields** (2026-09-11, later same
  day; extended twice more the same day) — purely descriptive, spelling
  out the real zone movement a bare event tag otherwise leaves implicit.
  Standing rule: every real zone (Battlefield, Graveyard, Hand, Library,
  Exile, Command, ...) is a legitimate value when actually known; the
  Stack is the one deliberate exception, never assigned on either side
  (treated as invisible/skip-through — CR 601 casting moves a card
  THROUGH it, and no fact anywhere sinks on "is on the stack"). Today on
  this card: `self-dies`/`destroy-nonland` (`zoneFrom:'Battlefield'`,
  `zoneTo:'Graveyard'`, CR 700.4 — both ends fixed), `self-enters`
  (`zoneTo:'Battlefield'` only — origin varies/is-the-invisible-Stack),
  `self-cast` (`zoneFrom:'Hand'` only — destination IS the invisible
  Stack). Deliberately NOT named `from`/`to` (would misclassify as a
  `ZoneFact`) — NOT consulted by any matcher, purely informational.
  `card` agent: these WILL now appear on served facts for summon-bahamut;
  check `app/lib/factConditions.ts`'s `HANDLED_OR_LABEL_KEYS` (or
  equivalent Facts-table "what's already shown vs. what's an unhandled
  condition" allowlist) renders/ignores them sensibly rather than showing
  them as a mystery unhandled field.
- **New `EventFact.targeted?: boolean` field** (2026-09-11, later same day
  again) — purely descriptive, distinguishes a real CR 601.2c targeted
  choice ("destroy up to one target...", real hexproof/protection rules
  can matter) from an unconditional broadcast to everyone/everything a
  `target`/`recipient` bucket names ("...to each opponent", no choice).
  Only ever set (`true` or explicit `false`) when the fact's
  `target`/`recipient` names a real bucket of more-than-one possible
  candidate; omitted (not `false`) when the fact's only real subject is
  `'self'`/singular `you` (no bucket to have chosen among or broadcast to
  at all) — omission there means "not applicable," not "unreviewed." On
  this card: `destroy-act`/`destroy-nonland` → `true`; `chapter-iv-damage`
  → `false`; every other EventFact omits it. NOT consulted by
  `factsInteract`, NOT added to `themeOf` — purely informational, same
  category as `zoneFrom`/`zoneTo`. `card` agent: will appear on served
  facts for summon-bahamut; same allowlist check as `zoneFrom`/`zoneTo` —
  no rendering/exposure required yet, just don't let it show up as a
  mystery unhandled field.
- **SUPERSEDED same day, later still: `ZoneFact`/`EventFact` merged into
  ONE `Fact` interface** (user-approved architecture shift) —
  `zoneFrom`/`zoneTo` above are GONE, replaced by real `from`/`to`
  directly (a merged fact can now carry `event` and `to`/`from` at once,
  e.g. `{event:'dies', from:'Battlefield', to:'Graveyard', ...}`, ONE
  object where there used to be two). **The legacy `zone` field is also
  now folded into `to`** — `mega-flare-you` (the one sink fact on this
  card) changed from `zone:'Battlefield'` to `to:'Battlefield'`. `card`
  agent action items:
  - `app/lib/factConditions.ts`'s `HANDLED_OR_LABEL_KEYS` still lists
    `zoneFrom`/`zoneTo` — harmless (unused strings in a Set), but can be
    dropped in a future pass; `zone`/`to`/`from` are already in that same
    set, no new key needed for the rename itself.
  - `isZoneFact`/`isEventFact` (`functional-model/synergy.ts`) are no
    longer type-narrowing guards (`fact is ZoneFact`/`fact is EventFact`)
    — both are now plain `boolean`-returning classifiers, since
    `ZoneFact`/`EventFact` are themselves now just type ALIASES for
    `Fact` (kept only so this file's own `import type { ZoneFact }`
    keeps compiling unchanged — no edit needed here, but don't rely on
    either function narrowing a `Fact` to a narrower shape anymore, there
    isn't one).
  - A single fact can now satisfy BOTH `isZoneFact` and `isEventFact` at
    once (e.g. the merged `dies` fact above) — was structurally
    impossible before. If any card-side code assumed "never both,"
    check it (this file's own grep of `app/lib/factConditions.ts` found
    no such assumption — it already reads whichever fields are present,
    doesn't branch on exclusivity).
  - **Real interactions changed for this card** (documented in full,
    including a real before/after `find-synergies.mjs` diff, in
    `functional-model/SYNERGY_DESIGN.md`'s "Fact unification" section) —
    not a card-agent action item, just useful context if the Interactions
    panel for fin/1 looks different: `self-dies`/`destroy-nonland` no
    longer match the 11 real EventFact `event:'dies'` sinks pool-wide,
    `self-enters` no longer matches the 2 real EventFact
    `event:'entersBattlefield'` sinks — both now match real ZONE-shaped
    Graveyard/Battlefield-presence sinks instead. This is accepted,
    tracked, user-approved; not a bug to fix on the card side.
- **New `event:'pump'` vocabulary + new `Constraints.attacking?: boolean`
  field** (2026-09-11, later same day again) — `pump` is a deliberately
  GENERIC catch-all for a real P/T-boost effect (no amount/duration/
  permanence sub-fields), applied to 4 real fin/1-10 cards: Adelbert
  Steiner (self), Ambrosia Whiteheart (self), Auron's Inspiration (real
  `target: {types:{has:['Creature']}, attacking:true}` — "Attacking
  creatures get +2/+0," symmetric across both players, no controller
  restriction), Battle Menu (`target:{types:{has:['Creature']}}`,
  `targeted:true`). `describeFact` needed no new branch — its existing
  generic event fallback already renders `event:'pump'` as bare `pump`.
  `Constraints.attacking` is REAL, honest, self-documenting data but is
  **NOT yet consulted by `satisfiesConstraints`** — it's genuine live
  combat state (508.1), not a static `CardDefinition` property, and
  `StaticAttrs`/`resolveSubject` only ever resolve off a `CardDefinition`/
  `TokenLike`, never live engine state — same class of "documented but
  currently inert for matching" field as `targeted`/the `types`-on-event-
  facts limitation already noted above. `card` agent action item: `app/lib/
  factConditions.ts`'s `constraintPhrases` is a hardcoded field list
  (`types`/`cmc`/`power`/`toughness`/`amount`/`name`) — does NOT render
  `attacking` yet. Not a required fix (this field isn't wired to matching
  either, so it's low-priority), but if the card page's own notes/
  conditions column should ever surface "attacking creatures" for Auron's
  Inspiration's own pump fact, that's the function to extend.
- **`buildAnnotatedCard`'s served shape must change** (`server/api/card/
  [set]/[number].ts`, card-owned — engine did not touch this file): drop
  the `annotateOracleText(f.oracleText, allFacts)` call and its
  `oracleLines: AnnotatedSegment[][]` output field entirely. Each face
  should instead serve its real oracle text UNTOUCHED —
  `{ name, manaCost, colorIndicator?, typeLine, oracleText: string,
  power?, toughness? }` (`oracleText` raw, with real `\n`s, not
  pre-split). `app/types.ts`'s `AnnotatedFace`/`AnnotatedCard` need the
  matching type update (`oracleLines` → `oracleText: string`). Whatever
  step turns a card's on-disk `synergy.json` facts into the served
  `functionalModel.synergy` payload (`loadCardSynergy` or wherever that
  lives) must also make sure `sourceText`/`highlight` never leak through —
  they won't be present in a freshly-regenerated `synergy.json` going
  forward, but double-check nothing reads them off a served `Fact` object
  for anything other than annotation computation (engine-side, confirmed
  none do outside `synergy.ts`/`compute-annotations.mjs`).
- **`FunctionalModelText.vue` (card-owned) needs a rewrite** to consume
  `oracleText: string` + each visible fact's own `annotations` directly,
  instead of the pre-built segment tree — i.e. it becomes the thing that
  splits `oracleText` on `\n` and slices out highlighted spans per line,
  using each fact's `annotations[].start`/`.end` against
  `annotations[].line`, rather than receiving pre-split runs. Only the
  `target: 'oracle'` variant is relevant here (a `typeLine`-anchored fact
  has nothing to highlight inline in the oracle-text view).
- **`app/pages/app/card/[set]/[number].vue`'s Facts-table row hover
  `title` currently reads `row.fact.sourceText` directly (around line
  919)** — this field won't be served anymore, so this needs to derive the
  same full-sentence text from `oracleText` + the fact's own first
  `annotations` entry instead (e.g. slice the whole line
  `annotations[0].line` points at, for an `'oracle'`-targeted fact; the
  whole `typeLine` string for a `'typeLine'`-targeted one).
- **`Fact.id` has been removed entirely** (2026-09-11) — user's call:
  facts are short enough now under the annotations model that stable
  cross-regen identity isn't needed. The identity convention is now:
  `role` + `describeFact(fact)`'s own rendered label + the fact's first
  real `annotations` entry (stringified) — NOT `sourceText` (also gone,
  see above) — `synergy.ts`'s own private `factIdentity()` mirrors this
  engine-side (used for `InteractionMatch.theirFactId`). `card` agent must
  update its own `factKey()` (`app/pages/app/card/[set]/[number].vue`,
  `app/components/FunctionalModelText.vue`) to the SAME new tuple (drop
  both the `fact.id ??` branch AND the `sourceText` reference, replace
  with `fact.annotations[0]`), and drop the `fact.id ??` branch from
  `openFactDebugModal`'s modal title. `server/api/graph-links.ts`'s own
  `sourceKey`/`sinkKey` construction (`group.fact.id`) and
  `app/lib/graphRenderer.ts`'s doc-comment mention of `fact.id` also need
  updating to match — see the `engine` agent's own handoff notes for the
  exact call sites.

## What each side must not assume

- `card` agent must not assume anything about `Effect` kinds or
  `resolveCard()` internals beyond what's in `synergy.json`/`trace.json` —
  if presenting a fact requires reading `definition.ts` directly, that's a
  sign the generated output is missing something; flag it for `engine`
  rather than reaching into `functional-model/*` yourself.
- `engine` agent must not assume how `synergy.json`/`trace.json` get
  rendered — UI presentation concerns (grouping, labels, collapse/expand)
  belong to `card`.

**Engine has no connection to card/UI, full stop.** Logging or similar
instrumentation baked into engine code is fine; engine code being
imported and executed by a UI component, or engine changing anything
under `app/`/`server/api/`, is not. Known current violation:
`describeFact`/`constraintBits` (label-templating logic) live in
engine-owned `functional-model/synergy.ts` but are imported and called
directly by the card page component at render time — that's backwards
from this rule and should eventually move to card-owned code (engine
would keep owning the raw `Fact`/`Constraints` vocabulary those functions
read, just not the templating itself). Not urgent, but don't add more
engine-owned functions to that import going forward.
