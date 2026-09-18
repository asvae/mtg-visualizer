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
- `progress.json` — review/tagging progress state. Includes
  `textCoverageAudited: boolean` and `knownGaps: string[]` — hand-maintained
  by whichever agent last touched this card's facts, so treat them as
  advisory, not guaranteed-accurate (a card's own facts can change without
  someone remembering to update these two fields — confirmed stale on
  `ashe-princess-of-dalmasca`, 2026-09-15, see below).

### `factsTextCoverage` (informational, engine-computed, 2026-09-15)

A REAL, computed signal — genuinely different from (and stronger than)
"every fact has an annotation" (`scripts/annotation-coverage.mjs`'s own
check, which is blind to whether the CARD'S OWN FULL ORACLE TEXT has a
substantial clause with no fact/annotation pointing at it at all).
`functional-model/scripts/text-coverage.mjs` (`computeTextCoverage`) unions
every real `{target:'oracle', ...}` annotation span onto a card's own real
oracle text, per face, and reports:
- `ratio` — fraction of real (non-reminder-text, non-punctuation) characters
  covered by at least one fact's annotation.
- `gaps` — every real, substantial (20+ real characters after stripping a
  leading "<ability name/Saga chapter/modal bullet> — " label, since this
  pool's own narrow-per-clause annotation convention deliberately never
  anchors those) contiguous uncovered span, as `{face, line, start, end,
  text}`.

Run via `npx vite-node functional-model/scripts/verify-text-coverage.mjs
[--threshold=0.85] [slug...]` — **informational only, never a hard-fail**
(real, honest partial coverage is a normal, expected state for most of this
pool — a 2026-09-15 whole-pool run found 246/300 v2-shaped cards below the
default 85% threshold, almost entirely cards whose own `progress.json`
never claimed full coverage in the first place, not a mass discovery of
stale metadata). Not wired into `npm run test`/CI for that reason; a
per-card `card` agent UI surfacing this (a "facts may be incomplete" badge,
e.g.) should treat a LOW ratio as "worth a human glance," never as a defect
to auto-fix.

**Real motivating case**: `ashe-princess-of-dalmasca` (fin/7) — its own
`progress.json` claimed `textCoverageAudited: true`/`knownGaps: []`, but
`computeTextCoverage` found two real, substantial, genuinely uncovered
clauses ("look at the top five cards of your library" and "Put the rest on
the bottom of your library in a random order" — both plausibly inert for
synergy purposes, a same-zone Library reposition with no external hook, but
real oracle text nonetheless with zero fact/annotation pointing at them).
Reset to `textCoverageAudited: false` with a real `knownGaps` entry
recording this finding — see that card's own `progress.json`.

### `annotatedNonFactSpans` (annotation taxonomy, 2026-09-16)

A new, OPTIONAL `progress.json` field — real oracle-text spans that ARE
accounted for but deliberately carry no `Fact`/`AnnotationRef` at all
(`Fact.annotations`'s own hard invariant is "must back a real Fact," which
these spans by definition don't satisfy). Shape:

```ts
annotatedNonFactSpans?: Array<{
  target: 'oracle' | 'typeLine'; // only 'oracle' does anything today — see below
  line?: number; // required when target:'oracle' (oracle text is multi-line); irrelevant for typeLine
  start: number;
  end: number;
  face?: 'front' | 'back'; // defaults to 'front', same convention Fact.face already uses
  kind: 'definition-path' | 'rules' | 'lore';
  note: string; // free text — what this span maps to / why it's fact-less
}>
```

- **`definition-path`** — maps to something real in `CardDefinition` (an
  `Effect`/`Trigger`/field), whether or not it produces a discrete `Fact`.
  The motivating case: `ultima-origin-of-oblivion`'s own blight-counter
  consequence clause — real, mechanically-enforced
  (`CounterConditionalGrant`/`hasCounterConditionalLandTypeLoss` etc.,
  `functional-model/ENGINE_GAPS.md`'s own "Counter-conditional continuous
  effects" entry) but deliberately fact-less.
- **`rules`** — real, accepted, currently-unmodeled rules text (an actual
  gap something a future recognizer/engine pass could still close) —
  distinct from `definition-path` (nothing backs it yet).
- **`lore`** — flavor/non-mechanical text that will never need modeling.
  Expected to be rare-to-empty for this pool in practice — real Magic
  flavor text lives in Scryfall's separate `flavor_text` field, not
  `oracle_text`, so genuine non-mechanical prose essentially never appears
  in the text this whole coverage mechanism scans.

All three `kind` values are computationally IDENTICAL as far as
`computeTextCoverage` is concerned — a span in any of the three buckets
simply stops counting as a coverage `gap`. The 3-way split is for human/
reviewer legibility (why is this fact-less), not something the pass/fail
math distinguishes; don't expect `card-status.ts`'s classifier (or
anything else) to treat one `kind` differently from another.

`functional-model/scripts/text-coverage.mjs`'s `computeTextCoverage` takes
this array as an optional third argument, marking each span covered via
the exact same per-line loop a real `Fact.annotations` entry already gets
— `ratio`/`gaps` treat a `nonFactAnnotations` entry and a real Fact's own
annotation identically. `functional-model/scripts/compute-card-status.mjs`
and `verify-text-coverage.mjs` both now read a card's own `progress.json`
(read-only — neither script writes to it) and thread this field through;
`card-status.ts`'s own `classifyCardStatus` needed NO changes at all (it
only ever reads `textCoverage.gaps.length`).

**Populate opportunistically, not via a pool-wide retroactive audit** —
same incremental, as-you-touch-a-card discipline `knownGaps` itself
already follows. `ultima-origin-of-oblivion` is the first real entry
(confirmed flips `green` in a regenerated `data/fin/fin_card_status.json`).

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
  (`role`, `event`/`zone`/`to`/`from`, `controller`, `subject`,
  `face`, constraints). **`value` is no longer one of them — see its own
  dated entry near the end of this file (2026-09-14): removed from the
  `Fact` type entirely, not merely deprecated.**
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

## Parser-derived facts (`Fact.provenance`) — 2026-09-13, `PRD_AUTOMATED_AUTHORING.md` wiring

`functional-model/recognizers/` (two real recognizers at first —
`instant-sorcery-resolves-to-graveyard`, `permanent-enters-battlefield-normally`
— **both now RETIRED** (the latter 2026-09-14, the former the same day,
third instance of this exact pattern — see this file's own dated entries
further down: "a normal permanent's self-cast/self-entersBattlefield fact
pair is no longer hand/parser-authored `Fact` data at all" and "a normal
Instant/Sorcery's self-cast-from-Hand/self-graveyard fact pair is no longer
hand/parser-authored `Fact` data at all") — see
`functional-model/PRD_AUTOMATED_AUTHORING.md`) is now wired into real
per-card generated data via `functional-model/scripts/apply-recognizers.mjs`.
Real, checked-in `cards/<slug>/synergy.json` files now carry a mix of
hand-authored facts (unmarked, as always) and parser-derived facts —
**same `Fact` shape either way**, no fork of the vocabulary.

- **New optional field: `Fact.provenance?: { origin: 'parser'; rule: string }`**
  (`synergy.ts`) — present ONLY on a fact a recognizer produced; absent
  entirely on every hand-authored fact (there is still no explicit
  `origin: 'agent'` marker — absence IS the agent-authored signal). `rule`
  names which recognizer produced it — today's real, still-active catalog
  is `destroy-effect-structural`, `drawCard-effect-structural`,
  `saga-lore-and-sacrifice-structural`, `dies-trigger-structural`,
  `lifegain-trigger-structural`, `dealDamage-effect-structural`,
  `putCounter-broadcast-structural`, `attacks-trigger-structural`,
  `putCounterTarget-effect-structural`, `addMana-effect-structural`,
  `putCounterSelf-effect-structural`, `putCounterMagnitude-clause-structural`
  (the last 2 added 2026-09-14, closing Aerith Gainsborough's own last 2
  unprovenanced facts — see `functional-model/PRD_AUTOMATED_AUTHORING.md`'s
  own dated entry)
  (`instant-sorcery-resolves-to-graveyard`/
  `permanent-enters-battlefield-normally` can no longer appear on any fact
  — both retired, see below) — a plain `string` on the `Fact` type itself,
  not a closed union, since `synergy.ts` deliberately doesn't import from
  `recognizers/`; the exhaustive catalog lives in that directory's own
  `RecognizerId`).
- **Purely informational, same bucket as `targeted`/`untilEndOfTurn`/
  `costReductionPerControlled`** — not consulted by `factsInteract`, not
  added to `themeOf`. A parser fact interacts/matches identically to a
  hand-authored one with the same shape; `provenance` never changes
  matching behavior, only who gets credit for having authored the claim.
- **PRD's own acceptance criteria for the `card` side, not yet built**:
  a Facts-tab show/hide toggle for parser-derived facts, and — when
  shown — a small provenance detail (which rule) per row. Until that
  toggle exists, a parser fact will render exactly like any other fact
  (same `describeFact`/`annotations` path — recognizers already produce
  real `Fact.annotations`, computed as a byproduct of the match itself, so
  there is nothing missing for a parser fact to render normally today).
  Per-card human review scope is meant to narrow to agent-authored facts
  only (PRD's Design section) — not implemented on the card side yet
  either; `progress.json`'s `review` field is untouched by this wiring
  pass (still means what it always meant).
- **Real state as of this wiring**: 202 real pool cards' `synergy.json`
  gained new parser-derived facts (435 facts total, additive only — every
  pre-existing hand-authored fact byte-for-byte unchanged, `progress.json`
  untouched anywhere). Two specific cards the user asked to inspect
  personally: `zack-fair` and `ultima` BOTH end up with **zero** new
  parser facts and zero diff at all — both recognizers correctly decline
  them (Zack Fair's own "enters with a counter" is a real CR 614.12
  replacement effect the permanent-recognizer's own criteria excludes on
  purpose; Ultima's own "exile ... including this card" is a real
  self-referential override the instant/sorcery-recognizer declines under)
  — see `PRD_AUTOMATED_AUTHORING.md`'s "Prototype findings" section for
  the full reasoning trail on both; this wiring pass did not change either
  card, on purpose, and did not touch Ultima's own pre-existing (arguably
  wrong, per that same section) hand-authored self-graveyard fact either.
- **`scripts/verify-synergy.mjs` got one small, principled behavior
  change** alongside this wiring: a `provenance.origin === 'parser'` fact
  that has no supporting trace evidence is now a soft NOTE, not a hard
  FAIL (still visible in the report, never silently dropped) — see that
  script's own inline comment at both evidence-check sites for the full
  rationale (in short: many real cards' own `scenarios.ts` only ever
  exercise that card's own distinguishing ability and never bother casting
  it from hand first, which is a pre-existing scenario-coverage gap, not a
  wrong parser verdict, and this PRD's own Design section already
  supersedes any hard trace-verification gate for a parser fact). Every
  hand-authored fact's own hard-failure bar is completely unchanged.
- **Not done in this pass, explicitly out of scope**: the Facts-tab
  toggle/provenance-detail UI, narrowing per-card review scope to exclude
  parser facts, and the separate "rule review" lane for auditing the
  recognizer catalog itself — all still open PRD acceptance criteria,
  `card`-owned (the first two) or not-yet-designed (the third).
- **Third recognizer wired (2026-09-13)**: `destroy-effect-structural`
  (reads a face's structured `Effect[]`, not oracle text) is now also wired
  into `apply-recognizers.mjs` — same `rule` string on `Fact.provenance`,
  no new served-shape field. At the time this bullet was written,
  `summon-bahamut` (fin/1) itself got NO new provenance-tagged fact from
  this recognizer (dedup against its own already-identical hand-authored
  `event:'destroy'` fact left it untouched/unprovenanced) — **superseded by
  the dedup-retagging bullet immediately below; left here only as a
  historical record of that specific pass, not current behavior.**
- **Dedup-match retagging (2026-09-13, follow-up pass; simplified again
  2026-09-14 — see below, this bullet is a historical record of the FIRST
  version of this behavior, not current)** — the "already-covered, leaves
  it untouched/unprovenanced" behavior described above (and in
  `apply-recognizers.mjs`'s own pre-existing `coreKey` dedup) is gone. When
  a recognizer's derived fact dedups against an ALREADY hand-authored fact
  that has no `provenance` yet, that existing fact was RETAGGED IN PLACE:
  same `Fact.provenance` shape, plus a `FactProvenance.note?: string`
  documenting that it predates the recognizer, every other field
  (`value`/`annotations`/`controller`) left byte-for-byte untouched.
- **Dedup-match retagging simplified (2026-09-14)** — the conservative
  preserve-and-note behavior above is retired outright, not kept as an
  option, per an explicit design decision: `value` is deprecated pool-wide
  (not consulted by anything that actually matches/interacts facts) and a
  recognizer's own `annotations` being broader/narrower/differently-placed
  than a hand-authored span was never a real conflict either (`coreKey`
  already excludes `annotations` from the match test for that exact
  reason). A `coreKey` match now uniformly REPLACES the existing fact's
  `value`/`annotations` with the recognizer's own freshly-computed ones and
  sets a bare `provenance: { origin: 'parser', rule }` — no distinction
  anymore between a fresh recognizer-originated fact and a `coreKey` match
  against a previously hand-authored (or previously retagged) one.
  `FactProvenance.note` has been removed from the type entirely (confirmed
  unread anywhere under `app/`/`server/` first). Still a genuine decline,
  never merged: anything that makes `coreKey` itself not match in the first
  place (a different `target`/`subject`/zone shape, etc.) — unaffected by
  this change, `coreKey`'s own computation is unchanged.
  `cards/summon-bahamut/synergy.json`'s `dealDamage-effect-structural` fact
  is the concrete example: `value` changed from its old hand-authored `5`
  to the recognizer's own fixed `1` (previously preserved, now
  overwritten). Pool-wide re-run: 98 files changed, 231 existing facts
  retagged (187 of which previously carried a now-removed `note`), 0 hard
  failures, confirmed idempotent across 3 consecutive runs (`grep -rl
  '"note"' cards/*/synergy.json` → 0 matches). See
  `PRD_AUTOMATED_AUTHORING.md`'s "Dedup-match retagging simplified
  (2026-09-14)" section for the full breakdown.
- **Real bug found+fixed alongside this same pass, `card`-owned file**:
  `server/api/recognizer-source/[rule].get.ts`'s hand-kept `RECOGNIZER_IDS`
  runtime array had not been widened to include `'destroy-effect-
  structural'` when that recognizer was wired, even though the engine-owned
  `RecognizerId` type it mirrors already had it — every `destroy`-fact
  provenance popover 404'd until this was fixed (one array literal, `engine`
  fixed it directly since it was blocking this same pass's own live-browser
  verification; flagged here since the file is `card`-owned).
- **Fourth recognizer added (2026-09-13): `drawCard-effect-structural`** —
  same structural-Effect-reading approach as `destroy-effect-structural`
  (see `functional-model/recognizers/drawCard-effect-structural.ts`'s own
  module doc comment and `PRD_AUTOMATED_AUTHORING.md`'s new section for the
  full reasoning trail), now reading `kind: 'drawCard'` `Effect`s instead of
  `kind: 'destroy'`. Same served `Fact` shape, no new field —
  `Fact.provenance.rule` is now one of 4 strings. `RECOGNIZER_IDS` in
  `server/api/recognizer-source/[rule].get.ts` was updated ALONGSIDE this
  wiring pass this time (not as a follow-up fix) specifically to avoid
  repeating the exact `destroy-effect-structural` 404 above — confirmed via
  live-browser hover on `/app/card/fin/1`'s own "Card draw" row: the
  provenance popover returns the real recognizer source, no 404.
  `summon-bahamut` (fin/1)'s own chapter III `drawCard` fact is now
  provenance-tagged (retagged in place — its own real `value: 4` untouched).
- **Real, narrow fix alongside this pass, `functional-model/scripts/
  apply-recognizers.mjs`** (engine-owned, not a `card`-side change, noted
  here only because it affects what a served `Fact.provenance` can now
  cover pool-wide): the dedup/retag path's `existingByKey` lookup used to
  assume at most one existing fact could ever share a bare `coreKey` — real,
  false for `qiqirn-merchant` (2 genuinely different `event:'drawCard'`
  facts reducing to the same key) and `matoya-archon-elder` (2 facts
  sharing a key that are NOT the same real claim — one anchored to its real
  ability text, one to its own reminder-text parenthesis). Fixed to store a
  `Fact[]` per key, requiring an exact `annotations` match to disambiguate
  whenever more than one candidate shares a key (falls back to the
  single-candidate behavior, unchanged, when only one exists) — see that
  script's own updated header comment for the full reasoning and the
  matoya-archon-elder case that forced the annotation-match requirement (a
  naive "first unprovenanced candidate" policy was tried and reverted after
  it non-idempotently retagged the wrong fact on a second run).
- **Fifth recognizer added (2026-09-13): `saga-lore-and-sacrifice-
  structural`** — genuinely different input shape from the other two
  structural recognizers: reads a face's own `typeLine` + named
  `triggers` (never `Effect[]` shapes, never oracle text at all — see
  `functional-model/recognizers/saga-lore-and-sacrifice-structural.ts`'s
  own module doc comment and `PRD_AUTOMATED_AUTHORING.md`'s new section
  for the full reasoning trail), mirroring the real engine's own
  `functional-model/saga.ts` derivation. Produces an unconditional
  `putCounter`(LORE)/self fact for every real Saga, PLUS a conditional
  `sacrifice`+`dies` self-pair (declined whenever the Saga's own final
  chapter has any `kind:'custom'` effect — see that file's doc comment for
  the real per-card reasoning, including two deliberate divergences from
  existing hand-authored data: `summon-leviathan` and `crystal-fragments-
  summon-alexander`). Same served `Fact` shape, no new field —
  `Fact.provenance.rule` is now one of 5 strings. `RECOGNIZER_IDS` in
  `server/api/recognizer-source/[rule].get.ts` was updated ALONGSIDE this
  wiring pass (not a follow-up fix) — confirmed via live-browser hover on
  `/app/card/fin/1`'s "Counters"/"Sacrifice"/"Dies" rows (200, not a 404)
  and on `/app/card/fin/58` (Jill, Shiva's Dominant // Shiva, Warden of
  Ice)'s back face, which correctly shows only the "Counters" row
  provenance-tagged (no sacrifice/dies row at all — the lore-only, real
  transform-back outcome). `summon-bahamut` (fin/1)'s own `putCounter`/
  `sacrifice`/`dies` facts are now all 3 provenance-tagged (retagged in
  place — their own real legacy `-1`/`-1`/`1` values untouched).
- **Duplicate-fact handling moved from each recognizer to one shared
  runner-level pass, and generalized (2026-09-13, follow-up)** — 3 of the 5
  structural/text recognizers used to each keep their own bespoke per-face
  `seen` Set (exact `JSON.stringify(fact)` match, `annotations` included);
  that's gone now, replaced by `apply-recognizers.mjs`'s own
  `mergeRecognizedFactsByIdentity` (fresh recognizer output, grouped by the
  same reduced identity `coreKey` already uses) plus a second, narrower
  existing-on-disk self-heal (`mergeSameRuleExistingFacts`, for a pool
  already retagged by a PRIOR run before this generalization existed). Net
  effect, real and intentional: **`Fact.annotations` can now legitimately
  have length > 1 where two genuinely different real clauses assert the
  identical claim** — first real, checked-in example is `qiqirn-merchant`
  (fin/65)'s own `event:'drawCard'` fact, unioning its `cantrip` ability's
  span and its `bigDraw` ability's span into one fact (previously served as
  2 separate `drawCard` facts). Confirmed via live `/api/card/fin/65` —
  `functionalModel.synergy` now serves exactly one `drawCard` fact with a
  2-entry `annotations` array. Pool-wide re-run confirmed this is the ONLY
  card whose on-disk `synergy.json` changed as a result (idempotent, 2
  further runs write 0 files).
  - `card`-side spot-check done as part of this same pass (engine-owned
    check, not a fix): `FunctionalModelText.vue`'s own inline oracle-text
    highlighting already iterates a fact's FULL `annotations` array (`for
    (const ann of f.annotations ?? [])`, both the `'oracle'` and `'typeLine'`
    branches), so it already highlights BOTH real spans correctly for a
    merged fact like this one — no gap there.
  - **Real, narrow gap found, NOT fixed (out of scope for this pass,
    flagged for `card`)**: the Facts-table row's own hover tooltip
    (`factSourceText`, `app/pages/app/card/[set]/[number].vue` around line
    616) and its `factKey` (same file, ~line 335) both only ever read
    `fact.annotations?.[0]` — for `qiqirn-merchant`'s own merged fact this
    means the row tooltip shows only the `cantrip` ability's own line text,
    never surfacing the `bigDraw` ability's own second span at all. Every
    fact before this pass had at most one real annotation, so this was
    never previously reachable; now that a merged fact can carry more than
    one, `card` may want `factSourceText` to represent all of them (e.g.
    joined text, or the row's own key not silently ignoring later entries).

## `destroy` implies `dies` at MATCH time — no more companion `dies` fact (2026-09-16)

Real user-reported authoring-time redundancy, fixed: `destroy-effect-
structural.ts`/`destroyProgram-effect-structural.ts` used to emit TWO
source facts for one destroy effect — `{event:'destroy', target, targeted:
true}` (the ACT) AND `{event:'dies', from:'Battlefield', to:'Graveyard',
target, targeted:true}` (the CONSEQUENCE), both anchored to the IDENTICAL
annotation span (confirmed on `battle-menu`/fin-9). CR 700.4: a destroy
that actually resolves against a real target necessarily kills it, so the
second fact said nothing the first didn't already imply — pure
duplication, not new information. **Both recognizers now emit ONLY the
`destroy` fact; the paired `dies` fact is gone, on-disk AND from the
recognizer's own output.** 9 real affected cards had their stale on-disk
`dies` companion fact removed by hand (scoped `apply-recognizers.mjs` is
additive-only, so it can't retract a fact its own recognizer used to emit):
`battle-menu`, `dion-bahamut-s-dominant-bahamut-warden-of-light`,
`fate-of-the-sun-cryst`, `summon-bahamut`, `ultima`, `coliseum-behemoth`,
`lunatic-pandora`, `sephiroth-s-intervention`,
`sidequest-hunt-the-mark-yiazmat-ultimate-mark`.

**The matching capability is NOT lost — it moved to `synergy.ts`'s
`factsInteract` instead of living as a second authored fact.** A
`destroy`-event SOURCE fact now directly satisfies:
- a ZONE-shaped presence/arrival want naming the Graveyard specifically
  (`to:'Graveyard'`, e.g. Ardyn the Usurper's own `types:{has:['Creature']}`
  want), checked against the destroy's own guaranteed `target.types.has`
  (conservative — a `hasAny`/`not`-only or absent target guarantees no
  SPECIFIC type, so it only satisfies an UNCONSTRAINED graveyard want).
- an EVENT-shaped `event:'dies'` want with its own `target` type filter
  (Al Bhed Salvagers/Jenova Ancient Calamity/G'raha Tia's own real shapes),
  same guaranteed-type check.
- an EVENT-shaped `event:'dies', target:'self'` want ("when THIS creature
  dies") — a WEAKER, "could this destroy legally target the wanting card"
  compatibility check (`satisfiesConstraints` against the wanting card's
  own static attrs), not a guarantee — mirrors the same check
  `factsInteract`'s general event-matching branch already makes for any
  OTHER event kind's own `target` filter against a `target:'self'` want.
  Declines (never vacuously matches) when the destroy has NO `target`
  filter at all — an unrestricted "destroy target permanent" does not
  imply every self-dies want in the pool.
- Declines (returns false) for any want carrying a `cmc`/`power`/
  `toughness`/`name`/`amount` constraint — no real pool sink needs more
  than `types` on a graveyard-arrival want today; grow only if one does.

Verified via a real, full-pool `find-synergies.mjs` before/after diff
(`(producer, wanter)` card-pair level, not just line-count): **zero real
card-pairs lost any edge** — every match the old `dies` fact used to
provide is still produced (either via the widened `destroy` match, or
because the pair already had another edge and the removed line was a pure
duplicate label). The diff also shows real, intended NEW matches this
widening closes for the first time: Ardyn the Usurper, Al Bhed Salvagers,
Jenova Ancient Calamity, and G'raha Tia now correctly receive edges from
every real destroy-effect card whose own `target` filter admits their
type, which the old shape-partitioned matcher (zone-shaped facts never
matched event-shaped wants, `SYNERGY_DESIGN.md`'s own "Fact unification"
section) never allowed even when both the `destroy` AND `dies` facts
existed side by side.

**`card` agent**: no served-shape change — `destroy`-shaped facts already
render/serve exactly as before (`describeFact`'s own `destroy` label is
unchanged). The only visible difference is that a destroy-effect card's
own Facts tab now shows ONE row for its destroy effect instead of two
near-identical rows (`destroy` + `dies`) pointing at the same oracle-text
span — a strict readability improvement, not a data-shape change to
handle. `data/fin/fin_card_status.json` regenerated after this change:
`0` cards changed status/reasons (the removed fact's own annotation span
was already covered by the surviving `destroy` fact, so text-coverage
percentages are unaffected).

## `Fact.triggeredBy` (causal link, 2026-09-16)

New, optional `Fact.triggeredBy?: string` (`functional-model/synergy.ts`) —
names the `Trigger.name` that produced this effect fact, when the effect
came from a trigger at all. Purely informational, same bucket as
`targeted`/`untilEndOfTurn`/`costReductionPerControlled` (not consulted by
`factsInteract`, not added to `themeOf`).

- Only set when the producing effect's own `structural-effects.ts`
  `EffectOccurrence.from.kind === 'trigger'` — an activated-ability-sourced
  or top-level (bare `effects: []`, no `triggers` wrapper) effect never
  gets a value, by design; most facts today still have none at all.
- A card can carry multiple independent trigger groups (2+ distinct
  `triggeredBy` values) — each is its own separate cause→effects cluster,
  never cross-linked.
- Not (yet) a full causal graph: this only links an effect fact back to
  the trigger that fired it, never effect-enables-effect chains. That
  bigger `causedBy` graph is a deliberately separate, still-deferred
  follow-up (waiting on the `program-ast-walker.ts` maturing further).
- `card` consumes it in the Facts tab: hovering a fact with a real
  `triggeredBy` value highlights every other visible fact sharing that
  same value (a second, distinct shade from the hovered row itself) —
  see `app/components/CardDetailTabs.vue`'s `factsByTrigger`/
  `triggerSiblingKeys`.
- Population is still partial as of this writing — only
  `entersBattlefield-self-trigger-structural.ts` sets it so far, and
  backfilling it onto already-recognized facts is a separate, in-progress
  effort (`apply-recognizers.mjs` won't rewrite an existing fact's other
  fields on a coreKey match by default). **Superseded same day, later —
  see below**: a "widen populate" pass (same 2026-09-16) subsequently
  added `triggeredBy` population to ~20 more recognizer files (`dealDamage-
  effect-structural.ts` and every other file whose own module comment cites
  "causal-links 'widen populate' pass"), plus a dedicated
  `apply-recognizers.mjs` backfill branch that syncs `triggeredBy` onto an
  already-on-disk fact on a `coreKey` match even when every other field
  already agreed (the one deliberate exception to that script's own
  "additive only" rule, since this field is purely informational and
  always re-derivable) — population is much broader than "only one
  recognizer" now, though still not exhaustive across the whole catalog.
- **SOURCE-only — architecture correction, 2026-09-16, later still (real
  user-reported issue, `cloudbound-moogle`'s own `moveSearchLibrary`
  sink fact the motivating case)**: `triggeredBy` must NEVER be set on a
  `role:'sink'` fact, full stop, no exceptions. A SINK fact represents a
  structural precondition/"want" (e.g. "this tutor only works if the
  library actually has a matching card in it") — a derivative fact about
  what a source's own target constraint requires to exist, never itself a
  caused EFFECT. Only a SOURCE fact (the actual effect that fired) is
  something a trigger can be said to have CAUSED. The "widen populate"
  pass above had briefly set `triggeredBy` on sink facts too (including a
  now-retired "harmless grouping tag" rationale on the SINK that IS a
  trigger-condition fact itself, e.g. `entersBattlefield-self-trigger-
  structural.ts`, and a now-retired "only set a group sink's own
  `triggeredBy` when every effect in the group agrees" mechanism on
  `grantKeywordAll-effect-structural.ts`/`pumpAllCreaturesYouControl-
  effect-structural.ts`) — all removed; every recognizer that ever emitted
  a sink-side `triggeredBy` had its emission (and, where the ONLY reason
  for the surrounding plumbing was feeding a sink, the plumbing itself)
  deleted. 84 real on-disk cards (102 sink facts total) had a stale
  on-disk `triggeredBy` from before this correction, migrated via a
  one-off pass (`apply-recognizers.mjs`'s own retag path is additive-only
  and won't clear an existing field, so this needed a separate script, not
  a pool-wide recognizer re-run) — `progress.json` `review:'human'` was
  reset to `'ai'` on the 3 affected cards that still had it
  (`check-verified-regressions.mjs` catches this automatically; confirmed
  live). SOURCE facts are completely unaffected by this correction — every
  SOURCE-side `triggeredBy` populated by the widen-populate pass above is
  untouched.

## `Fact.value` removed from the schema entirely (2026-09-14)

Not a further step in the "deprecated pool-wide" status this field already
had (this file previously already said `value` was "not consulted by
anything that actually matches/interacts facts") — a hard, explicit user
instruction to wipe it out of the project completely: "let's remove value
from everything (edges, facts, etc). No -1, no nothing."

- `Fact.value`/`Weight`/`factTotal()`/`InteractionMatch.theirTotal`
  (`functional-model/synergy.ts`) are all gone. A served `Fact` (both the
  raw `synergy.json` source/sink arrays AND `InteractionGroup.fact`) never
  carries a `value` key anymore — confirmed via a pool-wide grep, zero
  remaining `"value"` keys under any fact object in any
  `cards/<slug>/synergy.json`.
- `functional-model/scripts/compute-weights.mjs` (whose entire job was
  computing/writing this field) is deleted outright, not gutted-and-kept.
- Every recognizer in `functional-model/recognizers/` stopped emitting
  `value` on facts it produces; `apply-recognizers.mjs`'s dedup/retag logic
  (which already excluded `value` from its `coreKey` identity comparison)
  no longer reads or writes `.value` anywhere.
- `theirTotal`'s only real consumer, `server/api/card/[set]/[number].ts`'s
  own `dedupMatchesByCard`, now keeps the FIRST-encountered duplicate match
  per card instead of the highest-`theirTotal` one when collapsing
  per-fact matches down to one gallery entry per related card — a benign,
  arbitrary-tiebreak change (`theirTotal` was never part of the served
  payload either way, so nothing client-visible changes). `card` agent:
  if a future pass wants a MORE meaningful tiebreak than "first
  encountered," that's a fresh design decision, not a restoration of the
  old `value`-based one.
- **`card`-owned UI cleanup done directly by `engine` this same pass** (small,
  mechanical, forced by the type removal — flagged here rather than done
  silently): `app/components/ValueBar.vue` deleted (its only two call
  sites — `app/components/FunctionalModelText.vue`'s hover tooltip and
  `app/pages/app/card/[set]/[number].vue`'s Facts-table column — were both
  already display-disabled or about to become dead code); the Facts-table's
  `SHOW_FACT_VALUE_COLUMN` flag, its `<td>`, and the value-aware `colspan`
  branch are gone too, not just toggled off.
- **New (2026-09-14): printed Lifelink is no longer a hand-authored
  `Fact` at all.** 11 real pool cards used to carry an explicit
  `{event:'lifegain', controller:'you'}` SOURCE fact whose entire basis was
  a literal restatement of the card's own printed Lifelink keyword (no
  separate lifegain ability text) — dropped pool-wide. Real synergy-
  matching coverage doesn't regress: `synergy.ts`'s `findInteractionsForCard`
  now synthesizes the equivalent fact at MATCH TIME (`hasPrintedLifelink`/
  `syntheticLifelinkFact`) for any card with printed Lifelink (front or
  back face) that doesn't already declare a real one of its own (Battle
  Menu's own genuinely separate "Item — you gain 4 life" mode is
  unaffected, still its own real declared fact). This synthetic fact is
  NEVER written to any `synergy.json` and deliberately has NO
  `annotations` (there's no authored oracle-text span to point at — the
  keyword itself is the anchor, and `synergy.ts` has no access to a card's
  real Scryfall oracle text to compute one) — safe because nothing in
  `factsInteract`/`themeOf`/`describeFact` dereferences `annotations` for
  a bare event fact like this, and nothing in served UI renders an
  `InteractionGroup.fact`'s `annotations` as visible text (only
  `group.description`, itself a `describeFact()` string, and
  `group.matches` are ever shown — checked directly against
  `app/pages/app/card/[set]/[number].vue`). **Known, deliberate
  consequence**: these 11 cards' own Facts tab (fed from raw `synergy.json`,
  NOT from this synthesized-at-match-time path) no longer shows a
  "lifegain" row at all — intended, not a regression: the point was
  removing the redundant row, and the printed "Lifelink" keyword is still
  visible elsewhere on the card display.
- **Confirmed discrepancy, flagged, NOT silently resolved**: the task that
  drove this removal named `cecil-dark-knight-cecil-redeemed-paladin` as
  one of 5 "genuine, no Lifelink keyword at all" cards to leave untouched —
  but its own `definition.ts` `backFace` (`Cecil, Redeemed Paladin`)
  DOES declare `keywords: ['Lifelink']`, with no other lifegain-producing
  ability anywhere on that face. Its `{event:'lifegain', ..., face:'back'}`
  fact is, on inspection, the exact same redundant-restatement shape as the
  11 that WERE dropped. Left untouched per the explicit literal instruction
  ("do NOT touch these 5"), not auto-corrected — a human should decide
  whether to fold it into the same removal in a follow-up.
- **PARKED (2026-09-14, later same day), by explicit user decision — not
  removed.** The `hasPrintedLifelink`/`syntheticLifelinkFact` match-time
  synthesis described in the two bullets above is being reconsidered and
  may come back later; `synergy.ts` keeps both functions in place as
  dead/draft code but the injection itself is now a hard no-op behind
  `const LIFELINK_SYNTHETIC_FACT_ENABLED = false`. The 12 real cards this
  used to cover (the 11 above plus Cecil, Redeemed Paladin's own back-face
  fact, folded in as part of this same restoration) have their own
  explicit `{event:'lifegain', controller:'you', ...}` SOURCE fact back in
  `synergy.json` (same shape as before, minus `value` — that field stays
  permanently gone project-wide, unrelated to this reversal). The paired
  `synergy.test.ts` describe block is `describe.skip`, not deleted, ready
  to re-enable alongside the flag. The OTHER two synthetic patterns
  (`isNormalPermanent`/`isNormalInstantOrSorcery`) are NOT part of this
  decision and remain fully active.

- **New (2026-09-14): a normal permanent's self-`cast`/self-
  `entersBattlefield` fact pair is no longer hand/parser-authored `Fact`
  data at all — same pattern the Lifelink removal above already
  established, applied to `permanent-enters-battlefield-normally`
  (`functional-model/recognizers/`) instead of a printed keyword.** 210
  real pool cards used to carry an explicit, parser-derived
  (`provenance.rule: 'permanent-enters-battlefield-normally'`) `{event:
  'cast', from:'Hand', target:'self'}` + `{event:'entersBattlefield',
  to:'Battlefield', controller:'you', subject:'self', target:'self'}` pair
  — a literal restatement of "this is a normal permanent," confirmed
  (pool-wide field scan, all 420 tagged facts) to carry no case with any
  extra real constraint beyond that canonical shape. Dropped pool-wide.
  Real synergy-matching coverage doesn't regress: `synergy.ts`'s
  `findInteractionsForCard` now synthesizes the equivalent pair at MATCH
  TIME (`isNormalPermanent`/`syntheticCastFact`/
  `syntheticEntersBattlefieldFact`) for any non-token permanent (Creature/
  Artifact/Enchantment/Planeswalker/Battle — a Land is played, not cast,
  same exclusion the retired recognizer used) that doesn't already declare
  a real self-cast/self-entersBattlefield fact of its own. Same "never
  written to any `synergy.json`, no `annotations`" treatment the synthetic
  Lifelink fact already gets, same reasons.
  - **The recognizer file itself is deleted**
    (`functional-model/recognizers/permanent-enters-battlefield-normally.ts`),
    not kept inert — its whole scope was producing these two facts.
    Removed from `apply-recognizers.mjs`'s `RECOGNIZERS` list and from
    `recognizers/types.ts`'s `RecognizerId` union (a fact carrying this
    `provenance.rule` string can no longer exist anywhere in the pool).
    `server/api/recognizer-source/[rule].get.ts`'s hand-kept
    `RECOGNIZER_IDS` mirror was updated to match by `engine` directly (same
    "small, mechanical, blocking, card-owned file" precedent the
    `destroy-effect-structural` miss earlier in this file already
    established) — `card`/`server` should still double check nothing else
    hand-lists this rule id (a concurrent, in-flight `server/api/
    recognizers/index.get.ts` edit at the time of this pass still has a
    stale `'permanent-enters-battlefield-normally'` display-label entry;
    engine left it alone since that file was mid-edit by another session,
    but it's now a dead label for a rule that can never appear on a served
    fact again).
  - **One deliberate, known, small broadening this removal can't avoid**:
    the retired recognizer used to DECLINE this pair for a card whose own
    oracle text describes its own entrance as modified (enters tapped/with
    a counter/as a copy/face down, CR 614.12) — a distinction
    `isNormalPermanent` can no longer make, since `CardDefinition` has no
    structured "enters tapped" field anywhere (confirmed: the 3 real pool
    cards with this shape — `tonberry`, `shambling-cie-th`, `elixir` — all
    model it as an ordinary `onEnter` trigger effect tapping/counter-ing a
    pool-filtered candidate, a shape structurally IDENTICAL to a
    genuinely different card's own ETB trigger targeting something else
    entirely, e.g. `cloudbound-moogle`/`ice-flan`). These 3 cards (plus 17
    more that simply predate `apply-recognizers.mjs` ever running on them —
    either a not-yet-migrated empty `synergy.json`, or a real card outside
    that script's own oracle-text lookup, e.g. the historical-sets sweep;
    all 17 confirmed ordinary permanents by direct inspection, nothing
    entering abnormally) now get the synthetic pair for the first time.
    Not a correctness regression — the CAST/ENTERS events are still
    literally true either way, only the optional `tapped` field (which the
    old recognizer never set either) is left unconstrained rather than
    unclaimed — but a real, visible behavior change from before this pass,
    flagged here rather than silently absorbed into "removed the redundant
    fact" framing. See `functional-model/synergy.ts`'s `isNormalPermanent`
    doc comment for the full reasoning.
  - **Genuine special case confirmed kept, unaffected by this change**:
    `zack-fair`'s own hand-authored "enters with a +1/+1 counter" pair (CR
    614.12, no `provenance` tag — the recognizer always declined it) is
    untouched (nothing to strip, no `provenance.rule` tag on it) and never
    gets a synthetic duplicate layered on top (`findInteractionsForCard`'s
    own "already declared" skip, same as a card with its own real lifegain
    ability skips the synthetic Lifelink fact). No OTHER genuine special
    case was found among the 210 recognizer-tagged cards — every one was
    either the exact canonical shape or a harmless schema-drift variant
    (a stale pre-`subject`-field `entersBattlefield`, or a redundant
    explicit `controller:'you'` on `cast` that `effectiveController`
    already derives for free).
  - **Known, accepted card-side consequence, same shape as the Lifelink
    one above**: these 210 cards' own Facts tab no longer shows "Cast a
    spell"/"Enters the battlefield" rows for this pair at all (fed from raw
    `synergy.json`, not the synthesized-at-match-time path) — intended, not
    a regression. Live-verified via a running dev server against
    `fin/87` (Ahriman): `functionalModel.synergy.source` no longer lists
    `cast`/`entersBattlefield`, while the Interactions tab and
    `/api/graph-links` both still show a real, populated
    `entersBattlefield` produce group/edge (127 matches / 261 real "enters
    the battlefield" edges touching Ahriman alone) via the synthesized
    fact — the Interactions/graph path was unaffected by the removal.

- **New (2026-09-14, same day, third instance of this exact pattern): a
  normal Instant/Sorcery's self-`cast`-from-Hand/self-graveyard fact pair
  is no longer hand/parser-authored `Fact` data at all** — same pattern
  the Lifelink and normal-permanent removals above already established,
  applied to `instant-sorcery-resolves-to-graveyard`
  (`functional-model/recognizers/`) instead. 62 real pool cards used to
  carry an explicit, parser-derived (`provenance.rule:
  'instant-sorcery-resolves-to-graveyard'`) `{event:'cast', from:'Hand',
  target:'self'}` + `{to:'Graveyard', controller:'you', subject:'self'}`
  pair — a literal restatement of "this is a normal Instant/Sorcery,"
  confirmed (pool-wide field scan, all 124 tagged facts) to carry no case
  with any extra real constraint beyond that canonical shape. Dropped
  pool-wide. Real synergy-matching coverage doesn't regress: `synergy.ts`'s
  `findInteractionsForCard` now synthesizes the equivalent pair at MATCH
  TIME (`isNormalInstantOrSorcery`/`syntheticCastFact` — reused verbatim
  from the normal-permanent case, since the CAST half is the byte-identical
  real fact either way — `/syntheticInstantSorceryGraveyardFact`) for any
  non-Adventure Instant/Sorcery that doesn't already declare a real
  self-cast-from-Hand/self-graveyard fact of its own. Same "never written
  to any `synergy.json`, no `annotations`" treatment the synthetic
  Lifelink/normal-permanent facts already get, same reasons.
  - **The recognizer file itself is deleted**
    (`functional-model/recognizers/instant-sorcery-resolves-to-
    graveyard.ts`), not kept inert — its whole scope was producing these
    two facts. Removed from `apply-recognizers.mjs`'s `RECOGNIZERS` list
    and from `recognizers/types.ts`'s `RecognizerId` union (a fact carrying
    this `provenance.rule` string can no longer exist anywhere in the
    pool). `server/api/recognizer-source/[rule].get.ts`'s hand-kept
    `RECOGNIZER_IDS` mirror was updated to match by `engine` directly, same
    "small, mechanical, blocking, card-owned file" precedent the
    `destroy-effect-structural` miss/`permanent-enters-battlefield-normally`
    removal already established. **Not yet checked/fixed**: `server/api/
    recognizers/index.get.ts`'s own separate, hand-kept `TITLES` display-
    label map still has a `'instant-sorcery-resolves-to-graveyard'` entry —
    non-blocking (that map is a plain `Record<string,string>`, not typed
    against `RecognizerId`, so it compiles fine either way) but now a dead
    label for a rule that can never appear on a served fact again, same
    situation the `permanent-enters-battlefield-normally` removal flagged
    for that file at the time (since resolved — that stale entry is gone
    from `TITLES` today); `card`/`ui` should clean up the new one the same
    way when next touching that file.
    `recognizers/recognizers.test.ts` (the dedicated test file for both
    original text-only prototype recognizers, "Recognizer A"/"Recognizer
    B") is ALSO deleted outright, not left with an inert comment-only body
    — Recognizer B's own retirement had already reduced this file to "one
    real describe block (A) plus one retirement comment (B)"; retiring A
    too would have left zero actual tests, which Vitest hard-fails on
    ("No test suite found in file") rather than silently skipping. The
    equivalent describe block in `functional-model/synergy.test.ts` (see
    below) is the durable, still-executing record of this recognizer's own
    real accept/decline cases.
  - **One deliberate, known, small broadening this removal can't avoid**:
    the retired recognizer used to DECLINE this pair for a card whose own
    oracle text names a genuinely self-referential exile/shuffle override
    ("including/exile/shuffle this card/spell") — a distinction
    `isNormalInstantOrSorcery` can no longer make, since `CardDefinition`
    carries no oracle text at all (`synergy.ts` has no access to a card's
    real Scryfall body text to check for this). Checked directly
    (2026-09-14): the ONLY real pool card the retired recognizer ever
    declined for this reason, `ultima`, already carries its own
    hand-authored (untagged, no `provenance`) self-cast/self-graveyard fact
    pair regardless — the recognizer's own module doc comment already
    called this "a likely-latent gap in that specific hand-authored card,
    not something this recognizer should replicate," so `ultima` keeping
    that pair (now via the "already declared, skip the synthetic
    duplicate" guard) is not a new regression, just the same pre-existing
    state under a new mechanism.
  - **Genuine special case confirmed kept, unaffected by this change**:
    Adventure instant/sorcery halves (CR 715.3d — exiled, not put into the
    graveyard, on resolution; every real Adventure half in this pool prints
    "Adventure" as a literal typeLine subtype) are still excluded by a
    structural typeLine check `isNormalInstantOrSorcery` reuses verbatim
    from the retired recognizer's own `isAdventure` — confirmed none of the
    5 real FIN Town//Adventure cards' own Adventure halves gain this pair.
    Flashback/"cast from a graveyard" cards (`auron-s-inspiration`,
    `from-father-to-son`, `dreams-of-laguna`, `retrieve-the-esper`, and
    siblings) are deliberately NOT treated as a special case, matching the
    retired recognizer's own explicit reasoning: their normal cast-from-
    Hand resolution still goes to the graveyard exactly like any other
    Instant/Sorcery, so they correctly keep BOTH their own genuinely
    distinct, separately-authored `{event:'cast', from:'Graveyard', ...}` +
    `{to:'Exile', ...}` Flashback-recast facts (real, card-specific data)
    AND the synthetic normal-Hand-cast/graveyard pair — the synthetic-fact
    "already declared" dedup guard checks `from: 'Hand'` specifically
    (narrower than the normal-permanent case's own check) for exactly this
    reason, so a Flashback card's own real `from: 'Graveyard'` fact can
    never wrongly suppress the synthetic `from: 'Hand'` one. **Not directly
    observable via `findInteractionsForCard`'s own group output** (a
    `from`-only fact is genuinely zone-shaped but has no resolvable
    `effectiveZone`, so `factsInteract` always returns `false` for it,
    regardless of whether the dedup guard fired correctly or wrongly —
    same structural blind spot `synergy.test.ts`'s own normal-permanent
    describe block already documents for its own cast fact) — verified by
    direct code inspection instead, and via the real pool
    (`auron-s-inspiration`/`from-father-to-son` genuinely keep their own
    distinct `from: 'Graveyard'` fact after the strip, confirmed directly).
  - **`functional-model/scripts/verify-synergy.mjs` also updated** — its
    reverse "every produce-relevant ACTION must be explained" check reads
    each card's raw on-disk `source` array directly (no visibility into
    `synergy.ts`'s own match-time synthesis), and `harness.ts`'s scenario
    runner naturally logs a real `{fn:'move', from:'stack', to:'Graveyard'}`
    trace entry for nearly every plain Instant/Sorcery scenario — so
    stripping the stored fact pool-wide surfaced ~20 brand-new soft notes
    before this fix (confirmed via a before/after comparison scoped to all
    62 affected cards). Added `isNormalInstantOrSorceryGraveyardMove` (same
    structural mirror of `isNormalInstantOrSorcery`, same "note-not-fail,
    now correctly suppressed" treatment the file's own `moveTo`-to-Exile
    promotion comment already established for an analogous case) to that
    reverse check. Reverified after the fix: the scoped 62-card comparison
    and the FULL pool's own before/after output are now byte-identical.
  - **Known, accepted card-side consequence, same shape as the Lifelink/
    normal-permanent ones above**: these 62 cards' own Facts tab no longer
    shows "Cast a spell"/"graveyard presence" rows for this pair at all
    (fed from raw `synergy.json`, not the synthesized-at-match-time path)
    — intended, not a regression.
  - **Live-verified, not just JSON-level** (per standing convention):
    started a real `nuxt dev` instance (a different port — another
    session already held :3000), curled `/api/card/fin/5` (Aerith Rescue
    Mission, one of the 62 stripped cards) — `functionalModel.synergy
    .source` no longer lists `cast`/the bare graveyard fact, but
    `interactions` still shows a real, populated synthesized `{to:
    'Graveyard', subject:'self'}` source group (13 matches), and
    `/api/graph-links?set=fin` shows 176 total edges touching Aerith
    Rescue Mission, 13 of them graveyard-presence edges via the
    synthesized fact. Dev server stopped after (confirmed port free); a
    DIFFERENT, unrelated `nuxt dev` process on :3000 was already running
    under some other session — left alone, not mine.

- **New recognizers (2026-09-14, fin/3-10 mechanization pass)**: 6 more
  wired into the real pipeline, `Fact.provenance.rule` is now one of 20
  strings — `ptFormula-scalingPump-structural`, `digReveal-effect-
  structural`, `flashback-alternateCost-structural`, `gainLife-effect-
  structural`, `landfall-trigger-structural`, `triggerDoubling-
  selfAndAttachedEquipment-structural` — plus `destroy-effect-structural`
  extended to also emit a paired SINK fact (only when its own `target`
  narrows to a real type filter). See `functional-model/
  PRD_AUTOMATED_AUTHORING.md`'s own dated section for the full per-
  recognizer whole-pool-check reasoning and the real declines (token
  creation, "fixed pump," Cloud's own search-for-Equipment `validType`
  divergence) left hand-authored on purpose. `card`/`server` action items:
  same as every prior recognizer addition — `server/api/recognizer-source/
  [rule].get.ts`'s `RECOGNIZER_IDS` and `functional-model/recognizers/
  types.ts`'s `RecognizerId` union both updated this pass (not left as a
  follow-up miss); `server/api/recognizers/index.get.ts`'s `TITLES` map
  was NOT updated for these 6 (that map already falls back to a
  title-cased id when absent, same as most existing recognizers).
- `card` agent must not assume anything about `Effect` kinds or
  `resolveCard()` internals beyond what's in `synergy.json`/`trace.json` —
  if presenting a fact requires reading `definition.ts` directly, that's a
  sign the generated output is missing something; flag it for `engine`
  rather than reaching into `functional-model/*` yourself.
- `engine` agent must not assume how `synergy.json`/`trace.json` get
  rendered — UI presentation concerns (grouping, labels, collapse/expand)
  belong to `card`.

## Per-card dashboard status (`data/fin/fin_card_status.json`) — 2026-09-16

A NEW, separate, pool-wide generated artifact — not part of a single
card's own `functional-model/cards/<slug>/` output above, but built from
the exact same per-card sources (`definition.ts`, `synergy.json`, real
Scryfall oracle text, plus `progress.json`'s own `review`/`reviewCaveat`
fields, see below). `{ generatedAt, set, cards: [{ number, name, status:
'verified'|'uncertain'|'re-review'|'green'|'yellow'|'orange'|'red'|'gray',
reasons: string[] }] }`
— one entry per in-scope FIN card, for a future set-scoped dashboard page
(not yet built — `ui`/`card`'s own follow-up). Regenerate via `npm run
card-status`; treat the file as "as of `generatedAt`," not a
guaranteed-current baseline. See `scripts/AI_FACT_ELIMINATION_PROCESS.md`'s
own "Per-card dashboard status" section for the full bucket-definition
writeup and `functional-model/card-status.ts`'s own header for the
classifier itself. Whoever builds the dashboard page should read this file
directly (or wrap it in a thin `server/api/` route if live-without-a-rebuild
freshness turns out to matter more than the current "regenerate on demand"
model) rather than re-deriving the classification client-side.

**`verified` (2026-09-16)** — a NARROWING of `green`, not a 7th/parallel
bucket: a card that would otherwise be `green` (every fact recognizer-
derived, 0 real text-coverage gaps) AND whose own `progress.json` has
`review: 'human'` gets `verified` instead — a human has actually reviewed
this card's already-complete facts, a step beyond mere automated
completeness. `yellow`/`orange`/`red`/`gray` are never upgraded this way
even if `review` happens to be `'human'` on such a card (e.g. a stale
review predating a since-changed fact — see this project's own
review-status-reset convention, which resets `review` back to `'ai'` on
any authored-content change, so a genuine `'human'` value here always
describes the CURRENT content). UI color: bright/lime `#84cc16` ("Verified"),
distinct from plain green's `#22c55e`.

**`uncertain` (2026-09-17)** — ALSO a narrowing of `green`, not a separate
top-level bucket, and checked BEFORE the `verified` upgrade above (so it
wins even over an already-`human`-reviewed card): a card that would
otherwise be `green` (or `verified`) AND whose own `progress.json` carries
a non-empty, free-text `reviewCaveat` field gets `uncertain` instead. A
`reviewCaveat` is a human (or an agent acting on a human's explicit
direction) recording one SPECIFIC, real conceptual gap that can't
currently be modeled as a `Fact` at all — deliberately NOT a text-coverage
gap (those are already `yellow`/`orange`, and the oracle text here can
already be 100% annotation-covered) but a missing piece of Fact
*vocabulary* itself. Motivating card: Cloud, Midgar Mercenary (fin/10) —
its trigger-doubling static is fully covered by 2 real, recognizer-derived
sink facts for the doubling's own PRECONDITION, but there is no generic
"this card has/grants a triggered ability" Fact category to model the
doubling EFFECT itself as a produce/consume graph relation; its
`progress.json`'s own `reviewCaveat` documents exactly this. A caveat is a
STRONGER, more specific signal than plain `review: 'human'` (it names the
exact remaining gap rather than just confirming cleanliness), which is why
it wins over `verified` when both are present on the same card.
Deliberately does NOT apply to `yellow`/`orange`/`red`/`gray` — same
"only narrows an otherwise-green outcome" discipline `verified` already
established: a caveat's claim ("as good as it gets right now, modulo this
one known gap") is only meaningful once the card has reached full
mechanical completeness on the ordinary track; on a yellow/orange/red/gray
card there's still a real, ordinary, actionable ALREADY-named gap
(uncovered span / unprovenanced fact / unsupported construct / no
authoring at all), and consulting the caveat there would mask or
misrepresent that. A `reviewCaveat` present on such a card is simply
ignored by the classifier (never changes the bucket either direction) —
the field itself may still be present in `progress.json` as a human's own
note-to-self, it just has no classification effect until the card earns
its way to green/verified first. Not a UI-editable field (same as
`knownGaps`/`annotatedNonFactSpans` — hand/agent-authored directly into
`progress.json`, no input control anywhere). UI color: blue `#3b82f6`
("Uncertain"), distinct from all other bucket colors.

**`re-review` (2026-09-17)** — ALSO a narrowing of `green`, not a separate
top-level bucket, but checked BEFORE both `uncertain` and `verified` above
(so it wins over both on the same card — see the priority rationale below):
a card that would otherwise be `green` AND whose own `progress.json` has
`review: 'regression'` gets `re-review` instead. `review: 'regression'` is
written by exactly ONE code path in the whole pool — the "Verified-snapshot
regression guard" section below's own `check-verified-regressions.mjs`
auto-reset: this card WAS `review: 'human'`-confirmed at some point (a real
`verified-snapshot.json` exists) but its content has since drifted from
that confirmed baseline. This is the whole point of the 3-value `review`
field (`'ai' | 'human' | 'regression'`, see that section below): a card
that regresses from a genuine human confirmation must never collapse to
the same bucket/value as a card nobody has ever reviewed — both used to
read as plain `'ai'`/`green` with no way to tell them apart, which is
exactly the gap this bucket closes. Deliberately distinct from a manual
"Unconfirm" (which always writes plain `'ai'` regardless of prior value,
untouched by this change — a deliberate human un-confirm is a different
signal than an automatic drift-detection); a fresh human confirm on a
`re-review`/`regression` card transitions it straight back to
`verified`/`'human'`, same as confirming a plain `green`/`'ai'` card.
**Priority vs `uncertain`**: `re-review` wins when a card could arguably
satisfy both (once `'human'`-reviewed with a caveat noted, then drifted) —
a caveat's "you already know about this one static gap, nothing else is
wrong" claim is no longer trustworthy once the content has demonstrably
changed since a human last looked at ANY of it; the broader "go look
again" signal subsumes the narrower, now-potentially-stale one. Deliberately
does NOT apply to `yellow`/`orange`/`red`/`gray` — same "only narrows an
otherwise-green outcome" discipline `verified`/`uncertain` already
established: a card that's regressed all the way to a real, ordinary
coverage gap is already correctly flagged by that gap itself, and layering
`re-review` on top would be noise, not signal. UI color: light/sky blue
`#7dd3fc` ("Re-review"), deliberately a much lighter shade than
`uncertain`'s own more saturated `#3b82f6` so the two read as visually
distinct at a glance, not a shade variation of the same signal.

**`re-review` is now its own real 6th color on the shared display axis
(2026-09-18) — no longer folded into plain `blue`.** `functional-model/
engine-status.ts` and `functional-model/sink-derivation-status.ts` both
independently grew this exact same `re-review` state for their own axes
(a human `'confirm'` whose underlying inputs — ENGINE_GAPS.md prose/cited
test files for Features, predicate source/corpus manifest for Predicates —
have since drifted), generalizing the SAME mechanism this section already
describes (`check-verified-regressions.mjs`'s fingerprint-based drift
detection) rather than inventing a separate one; see those two axes' own
contract docs for the fingerprint mechanics. `functional-model/
card-status.ts`'s `cardStatusColor` now maps FIN's own `re-review` bucket
directly onto this shared `re-review` color instead of dropping it to plain
`blue` — see this section's own earlier text below (the "Display-axis
translation" bullet immediately following) for the corrected mapping; the
OLD `blue`-fold behavior was explicitly flagged at the time as a
placeholder pending a real 6th color existing anywhere on the shared axis,
which is now the case. `cardStatusBaseline` is UNCHANGED — a `re-review`
card's baseline still folds to `blue` (the underlying fact-authoring
completeness hasn't regressed, only the human confirmation on top of it
has gone stale).

**Display-axis translation to gray/purple/blue/yellow/green (2026-09-18)**
— the 8-bucket classification above is unchanged and remains the real
per-card fact-authoring answer (still what `app/lib/cardStatus.ts`'s
Facts-tab strip and `CardDetailTabs.vue` read via the per-card
`GET /api/card/:set/:number` route's own `cardStatus` field). Separately,
`GET /api/card-status/:set` (the batch route feeding `/app/engine/cards`
(route renamed from `/app/engine/sets`, 2026-09-18, later same day)
only) now ALSO serves a `baseline: 'gray'|'purple'|'blue'` and
`color: 'gray'|'purple'|'blue'|'yellow'|'green'|'re-review'` field per entry
(the `'re-review'` value added 2026-09-18, see the bullet immediately above
this one) — `functional-model/card-status.ts`'s own `cardStatusBaseline`/
`cardStatusColor` functions, a pure translation layer over the 8 buckets
(see that pair's own doc comment for the full bucket-by-bucket fold). This
puts `/app/engine/cards` on the SAME shared 6-state axis
`/app/engine/predicates` (`GET /api/sink-derivations`) and
`/app/engine/features` (`GET /api/engine-status`) already use, replacing
that tab's previous bespoke 8-color scheme — this is now the ONE shared
status axis across Predicates/Features/Sets. The checked-in
`data/fin/fin_card_status.json` snapshot's own on-disk schema is untouched
by this — the translation is applied at serve time only, in
`server/api/card-status/[set].get.ts`'s own `withDisplayColor`.

**Correction, 2026-09-18, later still**: this section used to additionally
claim it "supersedes an earlier plan detail (never committed to any file)"
for the not-yet-built FDN authoring pipeline's own `pipeline-status.json`
scheme. That claim was wrong — the plan in question (Workstream 4 of the
approved sink-only-synergy-model experiment plan) IS a real, current,
committed-to-disk plan, and was explicitly re-dispatched by name after
this section was written. FDN's own `pipeline-status.json` axis is real,
separate, and intentional — see "FDN authoring-pipeline status
(`pipeline-status.json`)" below for its real shape. It is NOT superseded
by the shared axis described in this section; the two coexist, answering
genuinely different questions (this section: FIN fact-verification
confidence; that section: FDN authoring-PIPELINE-STAGE). The one real
naming overlap between them (FDN's own renamed `purple` status,
deliberately reusing this axis's own color vocabulary for "schema support
only, unverified" rather than coining a synonym) is a value-naming
consistency choice only, not a type/logic merge — see that section's own
note for the full reasoning.

**Policy, documented not enforced for PRODUCTION MATCHING (2026-09-18,
narrowed same day — see the real review-action gate immediately below)**:
`gray`/`purple` (below `blue`) are meant to be treated as prohibited for
any real/production SYNERGY-MATCHING decision anywhere in the app, except
within verification/review work itself — same "pretend it doesn't exist"
policy `functional-model/sink-derivation-status.ts`'s own "Real-matching
usability gate" section already enforces FOR REAL on its own axis (rejecting
`gray`/`purple` from contributing to a live `match-sink.ts` match). No
equivalent gate exists for THAT kind of consumption today because nothing
real consumes it for a production MATCHING decision yet (FIN's own live
synergy graph never reads `card-status.ts` at all; no real FDN pipeline
exists yet) — whoever builds that real consumer should add a real gate
then, mirroring `sink-derivation-status.ts`'s shape, per `card-status.ts`'s
own "## Policy" comment section.

**Real, enforced gate DOES now exist for the REVIEW-ACTION side of this axis
(2026-09-18)**: confirm/reject is meaningless on a `gray`/`purple` card —
"was this card's fact-authoring ever actually claimed complete" is a
precondition for "a human confirmed it," same rule
`.claude/contracts/engine-status-schema.md`/
`sink-derivation-status-schema.md` now state for their own axes.
`POST /api/card/review-status` (`server/api/card/review-status.ts`) now
refuses (400) a `field: 'review'`, `reviewed: true` request (the Confirm /
"Confirm (Uncertain)" actions — there is no separate "reject" verdict on
this axis, only Confirm/Unconfirm/"Confirm (Uncertain)") unless the card's
CURRENT (pre-write) `cardStatusBaseline` is `blue` — computed live via the
same single-card `functional-model/scripts/compute-one-card-status.mjs`
subprocess `server/api/card/[set]/[number].ts`'s own per-request `cardStatus`
badge already spawns. Unconfirm (`reviewed: false`) is NEVER gated — always
succeeds, same "un-reviewing needs no precondition" posture the other two
axes' `verdict: null` clear path already has. Structurally this can never
reject an ALREADY-legitimately-`verified`/`uncertain`/`re-review` card
(`classifyCardStatus`'s own priority order makes those buckets unreachable
unless the card is independently green-quality already — see this file's
own classifier section above), so this gate only ever blocks a genuinely
new/premature confirm attempt on a card that hasn't earned full coverage
yet; it cannot un-verify an already-correctly-verified card.
`CardDetailTabs.vue`'s Confirm/"Confirm (Uncertain)" buttons now hide
unless the card's own live `cardStatus.status` maps (`cardStatusBaseline`)
to `blue` (2026-09-18) — Unconfirm stays ungated always, same precedent
as Predicates/Features' "Clear review". The server-side 400 remains as
defense in depth (the review-status endpoint is still reachable
directly, and the `*-reviews.json`-equivalent state is hand-editable).

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

## Verified-snapshot regression guard (`card`-owned, 2026-09-16)

A hard, PHYSICAL (deep-equality, never AI/semantic-judgment) diff guard
against a human-reviewed card's facts silently drifting away from what
was actually confirmed — the moment a human flips a card's FACTS review
`'ai'` -> `'human'` is "this is perfect, protect it," and this mechanism
makes that permanent rather than advisory.

- **Capture, `server/api/card/review-status.ts`** — on a REAL `field ===
  'review'` transition (the CURRENT on-disk value is read first; a no-op
  re-POST of an already-`'human'` value does NOT re-snapshot, matching
  this route's other existing "only on real change" checks), that card's
  CURRENT `synergy.json` is read and written, synchronously, as part of
  the same request, to a NEW checked-in file:
  `functional-model/cards/<slug>/verified-snapshot.json`:
  ```ts
  {
    capturedAt: string; // ISO timestamp
    facts: { source: Fact[]; sink: Fact[] }; // synergy.json's own real top-level shape — NOT a flat "facts" array
    annotatedNonFactSpans?: AnnotatedNonFactSpan[]; // from progress.json, only when present there
  }
  ```
  Re-reviewing after a real fix (`'ai'` -> `'human'` again, on the SAME
  card, later) re-baselines this snapshot too — same "always re-snapshot
  on confirm, not just the first time" behavior the pre-existing
  `oracleTextSnapshot` field already has. A malformed/missing
  `synergy.json` at capture time skips the snapshot rather than failing
  the whole review-status write (this card just isn't covered by the
  guard until it's valid and re-reviewed).
- **Check, `functional-model/scripts/check-verified-regressions.mjs`** —
  plain `node` (no TS import, no vite-node/tsx needed), no slug filter,
  always whole-pool. Globs every real `verified-snapshot.json`, loads that
  card's CURRENT `synergy.json`/`progress.json`, and deep-compares:
  `source`/`sink` arrays are compared **index-aligned and
  order-sensitive** (a reorder is a real regression per this project's
  "Facts stay text-ordered" convention, never silently absorbed as a
  no-op); `annotatedNonFactSpans` the same way. A mismatch prints a
  readable per-card report (which index added/removed/changed, old vs new
  JSON for a changed entry). Exit code 1 if anything mismatched anywhere
  in the pool, 0 if every snapshot still matches.
- **Auto-reset, physical enforcement of the pre-existing "review resets on
  change" rule** — if a mismatched card's `progress.json` `review` is
  STILL `'human'`, the check script both flags it more severely in its
  output AND writes `review: 'regression'` back to that card's
  `progress.json` itself, right there, no human judgment call needed (see
  this section's own "Retroactive `'regression'` correction" bullet below
  for why it's this THIRD value now, not plain `'ai'`). A mismatch on a
  card already `'ai'` (reset by something else, or never was `'human'`) is
  a plain, non-severe mismatch report, no double-reset.
- **Wired into `apply-recognizers.mjs`** as an automatic last step of
  every run, full pool regardless of what slugs that run itself was
  scoped to (this diffing is nearly free next to real engine execution) —
  also runnable standalone, documented in
  `functional-model/CARD_RESULTS_QUICKSTART.md`.
- **Pure diff primitives** (`deepEqual`/`diffFactList`/`diffSnapshot`,
  exported from the same `.mjs` file) are unit-tested directly —
  `functional-model/check-verified-regressions.test.ts` — same "the
  checker itself has real teeth" precedent `annotation-coverage.test.ts`
  already established.
- **Not a `synergy.json`/`progress.json` schema change** — `verified-
  snapshot.json` is a wholly new, separate on-disk file; no existing
  consumer of either of those two files needs to change.
- Backfilled 2026-09-16 for the 5 real pool cards that were already
  `review: 'human'` before this mechanism existed (confirmed before
  authoring: their CURRENT on-disk `synergy.json` is the reviewed
  baseline) — `aerith-rescue-mission`, `dwarven-castle-guard`,
  `moogles-valor`, `the-crystal-s-chosen`, `summon-bahamut`.
- **Retroactive `'regression'` correction, 2026-09-17** (`re-review`-bucket
  rollout): before this task, the auto-reset above wrote plain `'ai'`
  (its OLD behavior) — `aerith-rescue-mission` and `moogles-valor` had
  already been silently reset that way on a real, confirmed mismatch
  against their own `verified-snapshot.json`, indistinguishable at the
  time from a card nobody ever reviewed. Corrected in place to
  `'regression'` (their `progress.json`'s own `notes` document the
  correction) since both genuinely match that definition — a real prior
  human confirm plus a real detected drift since, only ever left at
  `'ai'` as a stale artifact of the OLD behavior. Two other named
  candidates were checked and NOT touched: `summon-bahamut`/`ultima-
  origin-of-oblivion` were still `review: 'human'` with NO current
  mismatch (never actually drifted, correctly untouched), and `ashe-
  princess-of-dalmasca` had, by the time of this check, already been
  independently re-confirmed to a fresh, non-drifted `review: 'human'`
  by concurrent work elsewhere in the pool (also correctly left alone).
  `dwarven-castle-guard` needed no manual correction — a concurrent
  recognizer-pool change during this same task ran the (already-updated)
  auto-reset script live and it wrote `'regression'` on its own, the
  intended real-world behavior of the fix, not a special case.

## `dies-trigger-structural.ts` is now SINK-only — its companion SOURCE fact removed as a real over-claim (2026-09-17)

Real, twice-repeated user correction, motivating card `aerith-gainsborough`
(fin/4): `dies-trigger-structural.ts` used to emit TWO facts per
self-referential "When/Whenever `<self>` dies" trigger — the trigger's own
firing PRECONDITION (a SINK, `{event:'dies', target:'self'}`, kept,
unchanged) and a SOURCE fact asserting the SAME dying from the CONSEQUENCE
side (`{event:'dies', from:'Battlefield', to:'Graveyard', controller:'you',
subject:'self', target:'self'}`, **removed**).

**Why the SOURCE half was a real over-claim, not a legitimate consequence
fact** — this is genuinely different from `destroy-effect-structural.ts`'s
own real `dies`-implying match (the section immediately above this one, 2026
-09-16): a `destroy` effect is an ACT this card's own resolution performs,
and CR 700.4/704.5g make its target's death a CERTAIN follow-through the
instant that destroy actually resolves against something — a genuine
consequence, always eligible once the act happens. A self-referential
"When/Whenever `<self>` dies" trigger's own SINK, by contrast, is not an act
this card performs at all — it is a PRECONDITION the card merely reacts to
if some wholly separate cause (combat, an opponent's removal, an unrelated
state-based action) happens to kill it. Nothing about a card carrying this
trigger makes that card any more or less likely to actually die than a
plain vanilla creature with no dies-trigger whatsoever, so the removed
SOURCE fact was granting a real, matchable "this card produces a Graveyard
arrival" claim (and the cross-card synergy edges that claim produced) as an
ARBITRARY byproduct of an unrelated ability's own text existing on the
card — a plain vanilla creature with the identical real chance of dying
got no such fact at all, purely because it happened not to also carry a
self-dies trigger.

**Real, disclosed edge losses — checked via a full-pool `find-synergies
.mjs` before/after diff, not assumed**: of the 7 real pool cards that had
this SOURCE fact (`aerith-gainsborough`, `dwarven-castle-guard`,
`undercity-dire-rat`, `magic-pot`, `ancient-adamantoise`,
`vincent-valentine-galian-beast`'s own back face,
`garland-knight-of-cornelia-chaos-the-endless`'s own back face):
- **4 lose ZERO real cross-card edges** (`magic-pot`, `ancient-adamantoise`,
  `vincent-valentine-galian-beast`, `garland-knight-of-cornelia-chaos-the-
  endless`) — each ALREADY carries its own separate, hand-authored
  `{zone:'Graveyard', subject:'self'}` fact (on the front face, for the two
  transforming cards — `face` is purely a rendering hint `synergy.ts`'s
  matcher never consults, so a front-face fact's `subject:'self'` resolves
  the exact same top-level `CardDefinition` type line the back-face
  recognizer fact would have) — confirmed identical wanter sets for both
  facts before removal, so only a duplicate label line (`dies` vs.
  `graveyard presence`) disappears per pair, never a real edge.
- **3 lose real edges** (`aerith-gainsborough`, `dwarven-castle-guard`,
  `undercity-dire-rat` — none had any other Graveyard-arrival source fact)
  — each loses the identical 21-real-card set: Ardyn the Usurper,
  Cantankerous Keepers, Cloud of Darkness, Deadly Embrace, Eden Seat of the
  Sanctum, Elixir, Emet-Selch Unsundered, Evil Reawakened, Exdeath Void
  Warlock (x2 — two separate real sink facts on that card independently
  matched), Fight On!, Golbez Crystal Collector, Gran Pulse Ochu, Ignis
  Scientia, Joshua Phoenix's Dominant, Magic Pot, Qutrub Forayer, Rydia's
  Return, Sin Spira's Punishment, The Final Days, Thranduil Sindarin Liege,
  Vanille Cheerful l'Cie.
- Zero new matches gained anywhere in the pool (a pure removal, no matcher
  widening accompanied it this time — see "Not built this pass" below).

**Not built this pass, flagged as a real, separate, much bigger scope
question**: a MORE GENERAL "any creature could die" synthetic match-time
fact (mirroring `synergy.ts`'s own `isNormalPermanent`/`syntheticCastFact`/
`syntheticEntersBattlefieldFact`/`isNormalInstantOrSorcery`/
`syntheticInstantSorceryGraveyardFact` family) would recover the 3 real
losses above (and extend the same claim to every OTHER creature in the pool
that has no dies-trigger at all, correctly closing the asymmetry this
whole section describes). Deliberately NOT built here: every existing
member of that synthetic-fact family represents an UNCONDITIONAL,
100%-certain-given-only-the-type-line default (a normal permanent's cast
always happens from hand; a normal Instant/Sorcery always resolves to its
owner's graveyard) — "a creature dies" is not that kind of fact at all, it
is conditional on gameplay that may never happen, for EVERY creature
equally. Building it would be a genuinely new "possible, not certain"
fact-vocabulary category, and — because it would apply pool-wide to every
creature, not just 7 cards — a much bigger graph-density change than this
task's own scope (every creature in the pool would newly connect to every
Graveyard-payoff card). Recommended as a real, worthwhile follow-up
decision, not built unilaterally.

**Verification**: `npx tsc --noEmit` clean (0 errors). `npx vitest run
functional-model` 1017/1022 (5 skipped, unrelated) —
`dies-trigger-structural.test.ts` rewritten to a single-entry
`expectedFacts` (SINK only). `scripts/verify-synergy.mjs` — 7 affected
slugs + full pool (320 checked): 0 hard failures either way. 6 of the 7
affected cards' `progress.json` were already `review:'ai'` (a documenting
note added to each, no reset needed); `dwarven-castle-guard` was
`review:'human'` — `check-verified-regressions.mjs` (plain `node`, NOT
`vite-node` — the latter silently produced no output/exit 0 for this
particular script in this session, a real tooling quirk worth remembering)
correctly auto-reset it to `review:'regression'` (see this file's own
stale-doc correction on that mechanism, immediately above). `data/fin/
fin_card_status.json` regenerated (`npm run card-status`) — `dwarven-
castle-guard`'s own entry now reads `status:'re-review'` with an accurate
reason string.

**`card` agent**: no served-shape change — `dies`-shaped facts already
render/serve exactly as before (`describeFact`'s own `dies` label is
unchanged, still produced by the surviving SINK fact and, for the 4
no-real-loss cards, the surviving separate `zone:'Graveyard'` fact). The
only visible difference on a card page is that the 3 real-loss cards' own
Facts tab no longer shows a SOURCE row claiming "dies" as something the
card itself produces (it never should have) — a strict accuracy
improvement, and the 21 real cross-card synergy edges those 3 cards used
to show on the graph are genuinely gone, not a rendering artifact to chase
down as a bug.

## "Confirm (Uncertain)" real UI action for `reviewCaveat` — full snapshot/regression-guard parity (2026-09-17)

Prior to this, `progress.json.reviewCaveat` (the `uncertain`-bucket field
documented above) was ONLY hand/agent-authored directly into `progress.json`
— no UI control existed to set it, and it never participated in the
verified-snapshot regression guard the way a plain `review:'human'` confirm
does. This closes that gap: **uncertain is handled identically to a plain
verified confirm for every purpose that matters — same `review:'human'`
write, same snapshot capture/re-baseline, same regression-guard
participation** — the caveat is purely an additional annotation on an
otherwise ordinary review pass, never a separate/weaker kind of confirm.

- **`POST /api/card/review-status` request body widened**: `{ name: string,
  field: 'review' | 'scenariosReview' | 'interactionsReview', reviewed:
  boolean, set?: string, number?: string, reviewCaveat?: string }` — the new
  `reviewCaveat` key is only ever meaningful for `field:'review'` +
  `reviewed:true`; ignored entirely for the other two axes and for
  `reviewed:false` (Unconfirm leaves an existing `reviewCaveat` on disk
  untouched, same "un-reviewing doesn't erase evidence of prior review"
  reasoning `oracleTextSnapshot` already follows).
  - Non-empty (trimmed) `reviewCaveat` → written to
    `progress.json.reviewCaveat`, `review` still set to `'human'` (an
    "Uncertain confirm" IS a real review pass, not a weaker one).
  - Omitted/empty on a **plain** confirm (the pre-existing button, body
    simply has no `reviewCaveat` key) → if the card previously had one, it
    is **cleared**. Decided this is correct after checking both real
    consumers directly: `functional-model/card-status.ts`'s
    `classifyCardStatus` and `functional-model/scripts/
    check-verified-regressions.mjs` both only ever READ `reviewCaveat`
    (never write it, never diff it as part of the verified-snapshot
    regression check) — clearing it here has no knock-on effect on either,
    confirmed by direct source inspection before deciding, not assumed.
- **Response body widened to match**: `{ [field]: <new value>, reviewCaveat?:
  string | null }` — the `reviewCaveat` key is only present when
  `field:'review'` (`null` when absent, matching this route's other
  "explicit null over undefined" convention), so the caller can reconcile
  local state (e.g. pre-fill a later "Confirm (Uncertain)" prompt) without a
  second round trip.
- **Verified-snapshot capture condition WIDENED, `server/api/card/
  review-status.ts`** — ground-truth-checked directly against the real code
  (not assumed from an earlier description): the capture used to fire ONLY
  on a genuine `previousFieldValue !== 'human'` transition (a real ai/
  regression → human confirm), never on re-confirming a card already at
  `'human'`. Now ALSO fires whenever `reviewCaveat` itself changes
  (`caveatChanged` — added, edited, or cleared) even when `review` was
  already `'human'` going in: an "Uncertain confirm" click on an
  already-verified card, or a plain confirm that clears a stale caveat off
  an already-uncertain one, is exactly the moment a human is deliberately
  re-affirming (or downgrading the confidence of) this exact review right
  now — the same underlying event a fresh ai→human transition already
  re-baselines for, just without the `review` value itself moving. A true
  no-op re-POST (same `reviewed:true`, same caveat text, `review` already
  `'human'`) still correctly skips the snapshot, unchanged.
- **`FunctionalModelData.reviewCaveat: string | null`** (`server/api/card/
  [set]/[number].ts`) — newly served, both the dev (live `progress.json`
  read) and production (`fmBundle.ts`/`build-fm-bundle.mjs`) branches. Lets
  the card page pre-fill its "Confirm (Uncertain)" prompt with whatever's
  already on file.
- **Real, pre-existing gap found and fixed alongside this, `scripts/
  build-fm-bundle.mjs`**: the production bundle builder's own
  `classifyCardStatus` call never threaded `reviewCaveat` through at all
  (only `review`) — meaning a card could NEVER classify as `uncertain` via
  the production bundle path, only via the dev-live or pool-batch
  (`compute-card-status.mjs`/`card-status-batch.mjs`) paths, which both
  already did this correctly. Fixed (`reviewCaveat` now read off
  `progress.json` and passed into `classifyCardStatus`, plus carried on the
  bundle entry itself as `FmBundleEntry.reviewCaveat?: string`) — this was a
  real latent bug predating this task, not something this task's own new
  UI path introduced. **Not yet regenerated**: `data/functional-model/
  fm-bundle.json` itself still reflects the old (buggy) computation as of
  this writing — regenerating now would also bake in unrelated, currently
  in-flight uncommitted card edits from concurrent sessions, so left for the
  next normal "regenerate, commit" pass rather than done here.
- **UI, `CardDetailTabs.vue`**: a third button, "Confirm (Uncertain)", next
  to the existing Confirm/Unconfirm toggle in the Facts row — always a
  forced confirm (never a toggle, even on an already-`human` card),
  `window.prompt()`-based caveat entry (pre-filled with the card's current
  caveat if any; cancelling does nothing; a real but empty-after-trim
  submission is treated as a plain confirm, per explicit design decision —
  an "uncertain confirm with no reason" isn't a real state). Deliberately
  its own small button rather than a widened `ReviewStatusBadge` variant
  (that component's `ReviewStatus` vocabulary is shared with the unrelated
  keywords page) — the actual 3-way visual readout instead reuses the
  EXISTING fact-authoring-status square next to the Facts tab label
  (`cardStatus`/`CARD_STATUS_META`, already distinguishes `uncertain` from
  `verified` from every other bucket), now made same-tab-reactive to this
  action (and the plain Confirm/Unconfirm one) via a new local
  `cardStatusOverride`, mirroring `app/pages/app/status/index.vue`'s own
  pre-existing green↔verified optimistic-overlay pattern — extended here to
  the full green/verified/uncertain triad and widened on that status-grid
  page too (`useReviewStatusBus.ts`'s `ReviewStatusChange` gained an optional
  `reviewCaveat` field so a "Confirm (Uncertain)" click on the card page
  correctly narrows to `uncertain` there too, not just to `verified`).
- **Live-verified against the real dev server** (see `card` agent's own
  notes.md for the full transcript): `POST /api/card/review-status` with a
  real caveat on `cloud-midgar-mercenary` (fin/10, already-real
  `uncertain`-bucket card, `review` was `'ai'` going in) → `review:'human'`,
  `reviewCaveat` written, `verified-snapshot.json` created,
  `/api/card/fin/10`'s live `cardStatus.status` reads `uncertain`. A second
  POST with a DIFFERENT caveat text (card already `'human'`) → snapshot
  `capturedAt` re-baselined (proves the widened condition). A third,
  identical POST → `capturedAt` unchanged (proves the no-op-skip still
  works). A plain confirm (no `reviewCaveat` key) → caveat cleared,
  `cardStatus.status` → `verified`, snapshot re-baselined again (caveat
  changed from set → cleared). Re-adding a caveat → back to `uncertain`.
  Regression guard: hand-perturbed `synergy.json`'s one fact, ran
  `check-verified-regressions.mjs` → flagged the mismatch and auto-reset
  `review:'human'` → `review:'regression'` exactly as it does for a plain
  verified card, live `cardStatus.status` → `re-review`. All scratch edits
  (`synergy.json` perturbation, `progress.json`, `verified-snapshot.json`)
  reverted immediately after, confirmed byte-identical to the pre-test
  on-disk state.

## FDN authoring-pipeline status (`pipeline-status.json`) — scaffolding only, 2026-09-18

New, separate from every FIN-facing schema above — a genuinely different
axis for a genuinely different (not-yet-built) pipeline: the FDN sink-only-
synergy-model experiment's two-tier authoring pipeline (approved plan,
Workstream 4). Per-card file, `functional-model/fdn-cards/<slug>/pipeline-
status.json` (moved out of `functional-model/cards/<slug>/`, later the
same day — see the "FDN wired into..." section below) — **not** a reuse of
`progress.json` (that tracks fact-quality
AUDITING of already-authored facts; this tracks how far along the
authoring PIPELINE ITSELF is, before any Fact/sink authoring has started).
Type + pure decision logic: `functional-model/pipeline-status.ts`
(`PipelineStatus`/`PipelineStatusFile`, `pipelineStatusFromGateResult`,
`applyPipelineReview`, `assertPipelineStatusInvariants`,
`readPipelineStatus`). Deterministic schema-validation gate a future
authoring script calls to decide `blue` vs. `purple` vs. hard-fail:
`functional-model/scripts/validate-card-definition.mjs`
(`validateCardDefinition`, reusable) + `validate-card-definition-cli.mjs`
(CLI wrapper — see both files' own header comments for the full design:
a real vocabulary walk over `Effect`/combinator `kind`s via `card.ts`'s own
`synergyTags`/`combinator.ts`'s own `walkProgram` — both already-exhaustive
real dispatchers, reused rather than a hand-maintained "known kinds" list
— run BEFORE a real, scoped `tsc --noEmit`).

5 real states: `gray`/`purple`/`blue`/`yellow`/`green` (`*(no folder at
all)*` is the real "not started" case — absence, not a 6th computed
value; see `readPipelineStatus`). **Naming history, 2026-09-18, later
same day**: originally named `red` per the plan's own literal wording,
briefly renamed to `incomplete` per a first user ruling (broadening its
meaning from "engine-capacity gap only" to "blocked, needs additional
info from the engine or another system"), then renamed again to `purple`
per that same user's immediate follow-up correction — reusing the SHARED
axis's own "schema support only, unverified" color rather than coining a
second synonym for the same underlying concept on a different axis. This
is a pure naming-consistency choice, not a fold into the shared axis's
own type/computation — `pipeline-status.ts` remains its own separate
module/file, tracking a genuinely different question (see the correction
note above this section). `purple` is reserved specifically for a
genuine, detected engine-capacity/vocabulary gap
(`failureKind:'capacity-gap'` on the gate's own return value — a
deliberately narrower, lower-level diagnostic string than the broader
`purple` status name it backs) — `pipelineStatusFromGateResult` THROWS
rather than ever writing any status for a `failureKind:'other'` (doesn't
compile / malformed shape / import failure) gate result; a caller must
catch that throw and hard-fail/flag it separately, never fold it into
`purple`. `gray`/`purple`/`blue`/`yellow`/`green` was the complete 5-state
list for this axis as of this section's own writing — **superseded,
2026-09-18, later same day**: a 6th, `re-review`, was added after all — see
the "FDN pipeline-status review action..." section below for why (a
computed-at-read-time-only drift signal, never itself a stored value, same
shape the OTHER two axes' own 6th `re-review` state already has).

**Nothing in this section is wired to anything real yet** (STALE, as of
2026-09-18, later same day — see the "FDN wired into..." and "FDN
pipeline-status review action..." sections below for what's real now: 10
real FDN card folders exist, and Workstream 5's own review-action backend
— `POST /api/fdn-cards/:slug/review` — is built; only its actual UI
buttons remain a `card`-agent task) — no FDN card folder exists, no
authoring script calls `pipelineStatusFromGateResult` yet, and Workstream 5
(the review UI — `card` agent, "Ok"/"Not ok" buttons writing `green`/
`yellow` via `applyPipelineReview`) is a separate, not-yet-started task.
This section exists now specifically so `card` doesn't have to read
`functional-model/pipeline-status.ts`'s source directly once that task
starts.

**Resolved, 2026-09-18** (was previously flagged here as an unresolved
conflict against this same file's earlier "Display-axis translation..."
section's own since-corrected "supersedes..." claim — see that section's
own correction note above): FDN's `pipeline-status.json` axis is a real,
separate, intentional axis, kept distinct from the shared `card-status.ts`
axis per explicit user ruling — not folded into it. The one naming overlap
(`purple`) is deliberate value-vocabulary reuse, described above, not a
type/logic merge.

## FDN wired into `/app/engine/cards` (route renamed from `/app/engine/sets`) — real, not just scaffolding, 2026-09-18, later same day

The scaffolding-only status the section above described is now WIRED to a
real UI: `fdn` is selectable alongside `fin` on this tab, showing whatever
real cards live under `functional-model/fdn-cards/<slug>/` (10 as of this
writing, moved out of `functional-model/cards/` — see that directory's own
new `README.md` — into this dedicated sibling directory; `functional-model/
pipeline-status.ts`'s `readPipelineStatus` and `functional-model/scripts/
validate-card-definition-cli.mjs` both updated to match).

- **`GET /api/card-status/sets`**: now also reports `fdn` — real, dev-only
  availability check (`data/cards.db` has ≥1 row with `set_code='fdn'`,
  same `node:sqlite` `DatabaseSync` pattern `prep-card-context.mjs` uses).
  `fin`'s own discovery rule (a checked-in `data/<set>/<set>_scryfall.json`)
  is completely unchanged — two explicit, separate branches, not one
  generalized rule (see that route's own header for the full "why").
- **`GET /api/card-status/:set`**: gained a real, explicit `fdn` branch,
  checked BEFORE the pre-existing `fin`-only dev/production split. Queries
  `data/cards.db` for `set_code='fdn'` rows, filtered to the real 291-card
  main Foundations set (Scryfall's own `booster:true` field — the raw
  `set_code='fdn'` table has 771 rows total, since every later showcase/
  manafoil/starter-collection/beginner-box/set-extension reprint shares the
  same set code; `booster:true` is the one field that actually isolates
  the real draftable set, confirmed empirically against Scryfall's own
  "Foundations · 291 cards" listing), Basic Lands excluded too (same
  convention FIN's own `inScope` filter already uses) — ~271 real in-scope
  cards. Canonical row per name: `is_normal DESC, released_at DESC`, same
  tiebreak `scripts/sync-card-db.mjs`'s own `idx_cards_name_pick`
  documents), then per card resolves its slug and calls
  `readPipelineStatus(slug)` — no folder/file at all is the real, common,
  NOT-an-error "not started" case (most of the ~271 in-scope fdn cards are
  in this state; only the 10 authored ones aren't).
  `CardStatusPageEntry.status` is now `CardStatusBucket | PipelineStatus` —
  for an `fdn` entry it's populated DIRECTLY from the pipeline axis
  (`gray`/`purple`/`blue`/`yellow`/`green`, already display-color-shaped,
  no 8-bucket fold needed) and `reasons` comes from the pipeline status's
  own `reasons` array — a `card` consumer must treat this field as opaque
  per-set display data, never assume it's always one of FIN's 8 buckets. A
  new optional `CardStatusPageEntry.slug?: string` is set ONLY on `fdn`
  entries (its `functional-model/fdn-cards/<slug>/` folder name), so a
  caller doesn't have to re-derive the slugify convention client-side.
  `fdn` is dev-only end to end (`data/cards.db` is gitignored, never
  shipped to production) — no production branch was added for it.
- **`/app/engine/cards/[set]/[[number]].vue`** (route restructured to a
  real two-segment `[set]/[[number]]` at the same time, see below): renders
  two genuinely different `STATUS_OPTIONS` vocabularies keyed on `SET`
  (FIN's fact-authoring wording vs. FDN's pipeline-stage wording) rather
  than one generalized copy — same "two real branches, not a fake
  generalization" call the API route already made. Clicking an FDN card
  does NOT mount `CardDetailTabs.vue` (that component assumes a full
  FIN-style card — Facts/synergy/scenarios — and would error on a real FDN
  card, which has none of that by design; making it FDN-aware is flagged,
  explicitly deferred, real Workstream 5 UI scope) — instead a minimal
  detail view: the card's real `definition.ts` source (via the SAME
  already-existing, generically-scoped `GET /api/engine-status/source`
  route Features/Predicates use for their own source citations — no new
  route needed) plus its pipeline `reasons`.
- **Route itself renamed `/app/engine/sets` -> `/app/engine/cards`**, and
  restructured from a single optional `[[slug]]` segment (just a collector
  number, with `SET` tracked as a client-side ref) to a real two-segment
  `[set]/[[number]]` dynamic route (`app/pages/app/engine/cards/[set]/
  [[number]].vue` + a bare `index.vue` redirecting to the last-viewed set) —
  a bare collector number became ambiguous once more than one set could be
  selected (FIN and FDN each have their own independent numbering). The
  whole page component is keyed (`definePageMeta({ key: ... })`) on `:set`
  specifically, so a set switch is a full remount while switching cards
  within the same set reuses the instance (matching every other
  `/app/engine/*` tab's own `[[slug]]` deep-linking convention).
- **`EngineConsoleTabs.vue`**: primary row reordered to Cards | Predicates
  | Features; Keywords dropped from the primary row (still reachable via a
  trailing "…" `UPopover` menu, its own route completely unchanged).
- **Dynamic browser tab titles** (`useHead({ title: computed(...) })`,
  `Engine | <Tab> | <selected entry's name>`, falling back to `Engine |
  <Tab>` with nothing selected) added to Cards/Predicates/Features (NOT
  Keywords, explicitly out of scope).

None of this touches FIN's own live production graph/matching
(`app/lib/buildGraph.ts`/`server/api/graph-links.ts`/`functional-model/
synergy.ts`) or the per-card `GET /api/card/:set/:number` route's `fin`
behavior at all.

## FDN pipeline-status review action (confirm/reject) + `re-review`/fingerprint drift, 2026-09-18, later same day

Real, wired Workstream-5 mechanism (was previously flagged in the
"scaffolding only" section above as "Workstream 5 ... a separate,
not-yet-started task") — the SAME confirm/reject + re-review shape
`engine-status`/`sink-derivation-status` already established for their own
axes, applied to this axis. See `functional-model/pipeline-status.ts`'s own
header/doc comments for the full rationale; this section is the
served/consumer-facing contract only.

**`PipelineStatus` widened to a 6th value, `re-review`** — same bright-blue
`#7dd3fc` semantics/meaning as the other two axes' own 6th value
("confirmed, then the underlying thing drifted since"), adapted here to
mean: a human confirmed `green`, then `functional-model/fdn-cards/<slug>/
definition.ts` — the one file this axis's own `blue` gate checks — changed
since. Unlike `engine-status`/`sink-derivation-status`, this axis does NOT
split a separate `Baseline`/`Color` type pair — `PipelineStatus` itself
(the single flat type this axis already had) is simply widened to include
it, since this axis never had a pre-existing baseline/overlay type split to
preserve and simplicity was the explicit design goal here. Consequence: a
STORED `pipeline-status.json`'s own `status` field never literally holds
`'re-review'` — only a computed, at-read-time value can be `'re-review'`
(`assertPipelineStatusInvariants` now throws if it ever finds a stored
`'re-review'`). `pipelineStatusFromGateResult`/`applyPipelineReview` (the
only two writers) are unchanged by this — neither can produce it.

**Fingerprint, `PipelineStatusFile.reviewedFingerprint?: string`** — set
only on a `'green'` entry: `computePipelineDefinitionFingerprint(slug)`'s
sha256 of `definition.ts`'s real current content, at the moment of
confirmation. `applyPipelineReview` itself does NOT compute this hash (kept
a pure function, no fs reads inside — the plan's own established property
of this function) — the CALLER (the review endpoint below) computes it via
`computePipelineDefinitionFingerprint` and passes it in as part of the
`'ok'` review action.

**`effectivePipelineStatus(slug, root)`** (exported from
`functional-model/pipeline-status.ts`) is the shared DISPLAY-time function
a read-only consumer should call instead of trusting a raw stored `status`
blindly — mirrors `readPipelineStatus`'s own `undefined`-for-"no folder at
all" contract (the caller decides its own "not started" fallback). For a
stored `'green'` entry it recomputes the current fingerprint and compares;
mismatch OR a missing `reviewedFingerprint` (an old, pre-fingerprint entry)
returns `'re-review'` instead of `'green'`. Every other stored status
passes through unchanged. `server/api/card-status/[set].get.ts`'s `fdn`
branch calls this (previously it read `pipeline?.status ?? 'gray'`
directly) — so `/app/engine/cards`'s FDN view reflects a drifted
`re-review` without any change on that page's own side. **NOT** used by
the review route's own confirm/reject GATING decision — see the note
below, corrected same day after this section's own first draft.

**`POST /api/fdn-cards/:slug/review`** — new endpoint, dev-only (no
production branch — `functional-model/fdn-cards/` isn't shipped to
production any more than `data/cards.db` is), mirrors
`server/api/engine-status/review.post.ts`/`server/api/sink-derivations/
review.post.ts`'s own shape, adapted to this axis's simpler one-file-per-
card storage (no separate `*-reviews.json` overlay map — the verdict is
written directly into that card's own `pipeline-status.json`):

- Request body: `{ verdict: 'ok' } | { verdict: 'not-ok', reviewNote: string }`.
  `reviewNote` is required, non-empty, for `'not-ok'` — enforced with a 400,
  same as the other two axes' own `note`-for-reject requirement.
- 404 if `functional-model/fdn-cards/<slug>/pipeline-status.json` doesn't
  exist at all (this card hasn't even entered the pipeline — nothing to
  review).
- **Gating, corrected same day (2026-09-18) from this section's own first
  draft** — 400 if a FRESH re-run of the deterministic gate
  (`functional-model/scripts/validate-card-definition-cli.mjs`, spawned as
  a real `vite-node` subprocess, same "can't dynamic-import
  `functional-model/`'s raw source tree from a bundled Nitro route"
  reasoning `server/api/card-status/[set].get.ts`'s own
  `computeAllCardStatusLive` already established) against the card's
  CURRENT `definition.ts` doesn't pass — **NOT** gated on the stored
  `pipeline-status.json`'s own `status`/`effectivePipelineStatus` (this
  section's own first-draft design). Reason for the correction: gating on
  the stored/effective status meant a card once reviewed (`yellow` or
  `green`) could never be re-reviewed the other way — reading `yellow`/
  `green`/`re-review`, never `'blue'`, `effectivePipelineStatus` would
  refuse EVERY later action forever, including "reject an already-
  confirmed card" and "confirm an already-rejected one." Re-running the
  gate fresh instead means the review route's own precondition is always
  "does the CURRENT content actually pass," independent of any prior
  review outcome — the same "baseline is always recomputed fresh from real
  content, never frozen by a prior review" property
  `engine-status`/`sink-derivations`' own review routes already have (their
  `baseline` is never mutated by a confirm/reject either). Error wording:
  `"<slug>" currently fails the schema-validation gate (<failureKind>) —
  confirm/reject is only meaningful once the card's current definition.ts
  actually passes it: <reasons>`.
- On success: builds a fresh `{status: 'blue', ...}` from that gate re-run
  (not the stale stored file) and calls `applyPipelineReview` against it
  (stamping a fresh `reviewedFingerprint` via
  `computePipelineDefinitionFingerprint` for an `'ok'` verdict), writes the
  resulting `PipelineStatusFile` back to `pipeline-status.json`, and
  returns that updated file as the JSON response body directly (not
  wrapped in `{key, color}` like the other two axes' review routes — no
  separate id/key here, the slug is already the route param, and the whole
  point of returning the file is so a UI can render the fresh `status`/
  `reasons`/`reviewNote`/`reviewedAt`/`reviewedFingerprint` without a
  second GET round-trip).
- **Naming**: `yellow` = "Rejected", `green` = "Confirmed" — the same
  labels Predicates'/Features'/Cards' own `STATUS_OPTIONS` arrays already
  use; no new synonym coined anywhere in this endpoint's own error
  messages/comments.

Request/response shape (body in, `PipelineStatusFile` out) is UNCHANGED by
the gating correction above — only the internal precondition check moved
from "trust the stored/effective status" to "re-run the real gate" — so no
consumer built against the shape documented here needs to change anything.
`effectivePipelineStatus`/`computePipelineDefinitionFingerprint` remain
real, used exports (display-time drift detection on the card-status route;
the fingerprint-stamping half of a successful review here) — only the
review route's own GATING precondition stopped using
`effectivePipelineStatus`.

## `computeCardInteractions` — card-page "Interactions" section, pure function (2026-09-18)

New: `functional-model/card-interactions.ts`'s `computeCardInteractions(definition: CardDefinition, poolDefinitions: CardDefinition[], root?: string): CardInteractionCategory[]`, where:

```ts
interface CardInteractionCategory {
  category: string;          // human-readable label, reused verbatim from `synergy.ts`'s `describeFact` vocabulary ("life gain", "dying", "counters", "damage", "card draw", "destroy", ...)
  count: number;              // === matchingCardNames.length
  matchingCardNames: string[]; // Scryfall `name`s, sorted, includes `definition.name` itself when it self-satisfies
}
```

Not wired into any route/UI yet (explicitly deferred to a follow-up dispatch, per the task that created this) — this section documents the function's own contract so the `card` agent can build a route/UI against it next: one row per category, shaped like the graph's own node display (`Lifegain [7] ⌄`), expandable to `matchingCardNames`.

**Pure, no fs/db reads of its own.** `poolDefinitions` is whatever "current scope" means for the caller — FIN's ~300 `functional-model/cards/*/definition.ts` when viewing `fin`, FDN's 10 `functional-model/fdn-cards/*/definition.ts` when viewing `fdn` (NOT deck-scoped — this app has no deck-building concept yet) — assembling that array (reading the right directory for the right set) is the CALLER's job, same "pure function over already-loaded `CardDefinition`s" split `sink-model/match-sink.ts`'s own `matchSink`/`countMatchesForSink` already establish. `root` is passed straight through to `deriveOccurrences`/`matchSink` (only a test simulating a not-yet-blue sink-derivation mechanism would ever override it — same convention those two already use).

**Self-inclusion is real and unconditional, by explicit design** — `definition` is never excluded from `poolDefinitions` internally. If `definition`'s own structurally-derived occurrences satisfy `definition`'s own derived category, `definition.name` appears in that category's own `matchingCardNames` (and `count` reflects it). A caller wanting self-matches dropped must pre-filter `poolDefinitions` itself — this function takes no stance, same convention `countMatchesForSink`'s own doc comment already states.

**How a category is derived — reuses the EXISTING sink-only matcher, does not add a second one.** Every one of `definition`'s own `deriveOccurrences(definition, root)` results (`sink-model/match-sink.ts` — already walks `effects`/`triggers[].effects`/`abilities[].effects`, `program`-AST nodes via `extractOccurrences`, the 2 baseline permanent/instant-sorcery rules, and the Saga/Crew engine-automation predicates) becomes its own category: labeled via `synergy.ts`'s own `describeFact` (a synthetic `{role:'source', ...occurrence}` wrapper — reuses the OLD paired source+sink Fact model's own categorization vocabulary rather than inventing a parallel one, per this project's own instruction), then re-run as a `SinkQuery` (`sink-model/sink-query.ts`) against every entry in `poolDefinitions` via `matchSink`. Occurrences sharing the same label are merged (their matched-name sets unioned) into one row.

**Real design investigation, NOT overclaimed — see `card-interactions.ts`'s own header comment for the full writeup, summarized here**: the task that created this function asked whether a trigger's own FIRING PRECONDITION (e.g. Ajani's Pridemate's `name:'onLifeGained'`) could be auto-derived into a matchable category ("any card with a `gainLife` effect") with no hand-curation. Checked directly against `card.ts` first: `Trigger.on` (the engine's only real, closed, auto-fired precondition vocabulary — `'enter'|'upkeep'|'endStep'|'tapLandForMana'|'attacks'|'equippedAttacks'`) has no lifegain-shaped member, and `Trigger.name` is documented, in `card.ts` itself, as a free-text label with "no SAFE general structural rule" to derive a precondition from — citing this exact trigger name as its own worked example. `recognizers/lifegain-trigger-structural.ts` already independently confirms this the hard way: it solves the identical `onLifeGained` trigger name (on 3 FIN cards) by matching literal ORACLE TEXT, never the trigger name — and FDN `CardDefinition`s carry no `oracleText` field at all, so even that fallback isn't available here. **Verdict: generic precondition-to-category auto-derivation does not hold up beyond `Trigger.on`'s closed enum** — building it anyway (even a small hand-curated name table) would re-introduce exactly the per-card curation the sink-only experiment exists to remove, just moved onto an equally-unreliable free-text field. Real, narrower consequence: Ajani's Pridemate's own derived categories under `computeCardInteractions` are `"enters the battlefield"` (baseline — it's a normal creature) and `"counters"` (its own `putCounter` trigger effect) — **not** `"Lifegain"`. Getting Ajani specifically into a lifegain-shaped category needs either the later curated per-card `SinkQuery`-authoring pipeline stage this project's plan already anticipates, or a genuine `Trigger.on` vocabulary addition (the same kind of change `'tapLandForMana'` was) — neither attempted here, flagged rather than guessed.

Tests: `functional-model/card-interactions.test.ts` — Ajani's Pridemate's own real categories (and the explicit absence of a lifegain-shaped one), self-inclusion (Ajani's own `"counters"` category, Day of Judgment's own `"destroy"` category, both against REAL FDN `CardDefinition`s), a real `gainLife`-effect-bearing card (one MOCKED `CardDefinition` — the real FDN 10-card pool has none today, only Healer's Hawk's un-walked Lifelink KEYWORD) producing a non-zero-count `"life gain"` category with self-inclusion, a card with no matchable triggers/effects (a bare mocked Land) producing `[]` rather than throwing, a real `on:'enter'` trigger (Helpful Hunter's own "draw a card" ETB) producing a real `"card draw"` category, and sort-order/count-consistency invariants.

## Sink CATALOG (shared, reviewed) (2026-09-18)

New foundational layer for the sink-only-synergy experiment — **this section is the contract, read it instead of the source**. Confirmed with the user before building: a sink is NEVER per-card/bespoke storage — a sink with only one real card wanting it is still just a catalog entry with low reuse, not a separate mechanism. This is genuinely additive: nothing in `sink-model/sink-query.ts`'s `SinkQuery` type, `synergy.ts`, or FIN's own pipeline changed shape (one real, narrow bug FIX in `match-sink.ts` did land alongside this — see "Real bug fixed" below, it only ever ADDS previously-impossible matches, verified zero regression against the full existing suite).

**No per-card sink ATTACHMENT concept exists — tried, then reverted the same day.** A per-card `sinks.json` (`functional-model/sink-attachment.ts`, `functional-model/fdn-cards/<slug>/sinks.json`) and a matching `pipeline-status.ts` `blue` redefinition were built and shipped earlier the same day this catalog landed — genuinely working, live-verified, with their own contract writeup right here. The SAME user then explicitly reversed it, in their own words: "All sinks should be auto-derivable. We don't keep artifacts/attachments/exceptions. Everything should be within the sink. I also don't need any attachment review - I'll have one review for full card. Then for sinks - the review would mostly be about proper recognition of cards that own the sink and cards selected for sink. These we can derive on-the-fly for now." `sink-attachment.ts`/its test file/both real `sinks.json` artifacts were deleted; `pipeline-status.ts`'s `blue` meaning was restored to gate-only (see that file's own header note, "`blue` redefinition, tried then reverted," for the full writeup — same posture, a real considered-and-reversed decision, not silently erased). Which cards "own" a given catalog sink, and which pool cards would be selected against it, are instead computed LIVE, every time, straight off real `CardDefinition`s — see `functional-model/card-interactions.ts`'s own "Catalog-first categorization" section below.

### 1. Sink catalog — `functional-model/sink-model/catalog/`

Mirrors the existing sink-derivation-**predicate** convention (`sink-model/predicates/<mechanism>.ts` + `.test.ts` + `.corpus.json`) as closely as the two concepts allow, per the task's own explicit "mirror the closer analog" instruction. One file trio per catalog entry:

- `catalog/<slug>.ts` — exports `query: SinkQuery` and `entry: SinkCatalogEntry`:
  ```ts
  // catalog/entry.ts
  export interface SinkCatalogEntry {
    slug: string;   // stable identity — matches the filename, and the review/attachment key
    query: SinkQuery; // today's sink Fact shape minus annotations/provenance/role/triggeredBy, PLUS its own category label
  }
  ```
- `catalog/<slug>.test.ts` — the STRUCTURAL GATE itself: real vitest cases running `matchSink(query, mockedFixture)` against MOCKED `CardDefinition` fixtures ONLY (never real cards — same confirmed project convention the sink-derivation-predicate corpus tests already use).
- `catalog/<slug>.corpus.json` — hand-authored manifest, `{ total, passing, cases: [...] }`, kept in sync by hand with the `.test.ts` file's own case count (same convention `predicates/saga.corpus.json`/`crew.corpus.json` already establish — no automated writer script exists for either).
- `catalog/index.ts` — the registry: statically imports every real entry and exports `SINK_CATALOG: SinkCatalogEntry[]`. **Deliberately NOT a hand-seeded metadata array + fs directory scan** (unlike `sink-derivation-status.ts`'s own `SINK_DERIVATION_MECHANISMS`) — a catalog entry is real the moment it's in this array (one new file + one import line to register), since the catalog is expected to grow much faster/more organically than the small, fixed set of engine-automation mechanisms that file tracks.

Real, seeded entries as of this writing (both `blue`, both demonstrated against real FDN cards below): `lifegain` (`{category:'Lifegain', event:'lifegain', controller:'you'}` — verbatim adaptation of Aerith Gainsborough's real FIN sink), `graveyard-fodder` (`{category:'Graveyard fodder', to:'Graveyard', controller:'you', types:{has:['Creature']}}` — verbatim adaptation of Fight On!'s real FIN sink).

**Real bug fixed in `match-sink.ts` alongside this (2026-09-18, found building `graveyard-fodder`'s own corpus)**: the zone-shaped matching branch in `occurrenceSatisfiesSink` only ever resolved a producer occurrence's type guarantee via a concrete SUBJECT (`resolveOccurrenceSubject` — self, or a created token's `resolvedAttrs`) — a zone-shaped occurrence with no resolvable subject but a real, guaranteed top-level `types` constraint (the shape `sacrifice`/`move`'s own `walkEffects` cases produce) could NEVER satisfy ANY type-constrained zone-shaped want, confirmed dead code before this fix. Fixed by widening `guaranteedTypes(p)` to also check `p.types?.has` (not just `p.target?.types?.has`) and reusing the SAME `satisfiesViaSubjectOrGuarantee` fallback chain the event-vs-event branch already had, now applied uniformly to the zone-shaped branch too. Verified zero regression: full `sink-model` suite (47 tests, was passing before) + full `functional-model` suite (1202 tests) both green after the fix; the fix only ever ADDS previously-impossible matches (a real "sacrifice a creature" spell can now correctly satisfy a Creature-typed graveyard-arrival sink), never removes one.

### 2. Sink catalog review axis — `functional-model/sink-catalog-status.ts`

Mirrors `sink-derivation-status.ts`'s shape (chosen as the closer analog over `pipeline-status.ts`, since both compute a LIST of entries each with their own baseline+overlay color, not a single flat per-card file):

- `gray` — listed in `SINK_CATALOG` but `<slug>.corpus.json` is missing or `total === 0` — drafted, gate not run yet.
- `purple` — a corpus manifest exists but `passing < total` — built, not fully verified.
- `blue` — `total > 0 && passing === total` — the structural gate passed for real.
- `yellow`/`green` — human review overlay (confirm/reject), stored in `functional-model/sink-catalog-reviews.json` (new, sibling to `sink-derivation-reviews.json`), only ever meaningful on top of a `blue` baseline (a stale/hand-authored review on `gray`/`purple` is silently ignored, never trusted upward).
- `re-review` — computed only, never stored: a `confirm` review whose snapshotted fingerprint (sha256 of `<slug>.ts` + `<slug>.corpus.json` content, `computeSinkCatalogFingerprint`) no longer matches the entry's CURRENT content.

Exports: `computeSinkCatalogStatus(root?)`, `computeSinkCatalogColor(slug, root?)`, `computeSinkCatalogFingerprint(slug, root?)`, `isSinkCatalogEntryUsable(slug, root?)` (cached per-root; `true` iff `blue`/`green`), `resetSinkCatalogColorCacheForTests()`. No route wired to this yet (same "scaffolding only" starting point `pipeline-status.ts`/`sink-derivation-status.ts` each had before their own review routes landed) — `ui`/`card`'s own follow-up, same shape as `GET /api/sink-derivations`.

### 3. `functional-model/card-interactions.ts` — catalog-first categorization, on-the-fly, no persistence (2026-09-18, follow-up pass to the attachment revert)

`computeCardInteractions(definition, poolDefinitions, root?)` — see this file's own earlier section above for its base contract (self-inclusion, pure, occurrence-derived fallback labeling via `describeFact`) — was extended to check EACH real `SINK_CATALOG` entry's own `query` against `definition` FIRST, via the exact same `matchSink` primitive the catalog's own corpus tests already use: `matchSink(entry.query, definition, root)`. Only entries `isSinkCatalogEntryUsable` reports usable (`blue`/`green`) are consulted — same "not-yet-verified data must not silently drive real matching" gate `sink-derivation-status.ts`'s own live-status gate already established for predicates. If `definition` itself satisfies an entry's query, that entry's own real `query.category` label (e.g. `"Lifegain"`, `"Graveyard fodder"`) becomes one of `definition`'s categories, with `count`/`matchingCardNames` computed the same self-inclusive way (every `poolDefinitions` entry, including `definition` itself, that also matches `entry.query`). The pre-existing raw occurrence-derived `describeFact` labeling is kept as a fallback, but ONLY for occurrences whose own `via` wasn't already the one that satisfied a catalog entry (`matchSink`'s own `SinkMatchResult.via` names exactly which derived occurrence matched) — so a card's occurrence never shows up labeled twice (once under a real catalog category, once again under its own raw structural label).

**Verified against the real pool, honestly, not just at the JSON level**: ran the extended function against all 10 real FDN `CardDefinition`s. `day-of-judgment` — whose own "destroy all creatures" program occurrence structurally guarantees the destroyed creatures arrive in a graveyard — now genuinely categorizes under the catalog's real `"Graveyard fodder"` label (`via: front:effects:program:destroy`) instead of its old raw `"destroy"` label. No other real FDN card matches either seeded catalog entry as a PRODUCER (`lifegain`/`graveyard-fodder` are both producer-shaped queries — "does this candidate itself cause the event" — confirmed directly: `matchSink(lifegainQuery, ajanisPridemate)` returns `false`, since Ajani's Pridemate doesn't itself have a `gainLife` effect; its `onLifeGained` trigger only REACTS to lifegain, a consumer-side signal).

**SUPERSEDED, 2026-09-18, later the same day — Ajani's Pridemate now DOES categorize under `"Lifegain"`.** The paragraph above (kept as a historical record — its reasoning about `query` being PRODUCER-shaped and `Trigger.on`'s closed enum lacking a lifegain member was correct and is unchanged) concluded there was no safe recognition path. The user corrected the conclusion, not the oracle-text constraint: oracle/printed text is still NEVER touched anywhere in `sink-model/` or `card-interactions.ts` (that stays a hard rule), but `Trigger.name` itself — a real, deliberately-authored structural field on `CardDefinition` (`card.ts`'s own doc comment: "Matches a scenario's own `trigger` field," already a genuine, intentional signal used elsewhere, not decoration) — is fine to use as a lower-stakes MATCHING/categorization signal, distinct from the higher-stakes "drive engine firing/simulation" use the standing caution was actually about.

**New mechanism: `SinkCatalogEntry.consumerTriggerNames?: string[]`** (`sink-model/catalog/entry.ts`) — a second, CONSUMER-side recognition mode alongside the producer-only `query`. A candidate satisfies a catalog entry when EITHER `matchSink(entry.query, candidate)` matches (producer) OR `matchesConsumerTriggerNames(entry.consumerTriggerNames, candidate)` matches (consumer — `sink-model/match-sink.ts`, a pure comparison of `candidate.triggers[].name`/`candidate.backFace.triggers[].name` against the entry's own declared name list; never oracle text). The `lifegain` entry now declares `consumerTriggerNames: ['onLifeGained']`. `computeCardInteractions` checks both modes for `definition` itself AND for every `poolDefinitions` candidate when building `matchingCardNames` — self-inclusion is preserved (Ajani's Pridemate appears in its own `"Lifegain"` category's `matchingCardNames` via the consumer match, with no structural producer `via` to mark "consumed," so its pre-existing `"enters the battlefield"`/`"counters"` raw categories are unaffected).

**Verified against the real pool**: `ajanisPridemate` is the ONLY one of the 10 real FDN cards with a trigger named `'onLifeGained'` — zero false-positive risk today. `matchSink(lifegainQuery, ajanisPridemate)` is still `false` (unchanged — the producer check itself was not touched); `matchesConsumerTriggerNames(['onLifeGained'], ajanisPridemate)` is `true`.

Tests: `functional-model/card-interactions.test.ts`'s former "Ajani does NOT get Lifegain" case was rewritten to assert it now DOES (self-inclusive, alongside a real producer already in the pool), plus a new case confirming a card with no matching trigger name (Serra Angel) still never gets `"Lifegain"`. `sink-model/catalog/lifegain.test.ts`/`lifegain.corpus.json` gained 4 new consumer-mode cases (matches on the real `onLifeGained` shape, declines a differently-named trigger, declines no-triggers-at-all, matches via a transforming DFC's back face) — corpus manifest now `8/8`, still `blue`.

### 4. Full chain worked example: `felidar-savior` (FDN #12) + a 5th sink-derivation predicate, `lifelink` (2026-09-18, later still)

The user's own canonical shorthand for this architecture, verified end-to-end for real: **Card (Felidar Savior) → Sink (Lifegain) → Predicate (Lifelink) → Card (Ajani's Pridemate)**.

- **New real FDN card**: `functional-model/fdn-cards/felidar-savior/definition.ts` — `{3}{W}` Creature — Cat Beast, 2/3, `keywords: ['Lifelink']`, an `onEnter` trigger ("put a +1/+1 counter on each of up to two other target creatures you control") built as `selectUpTo(you.creaturesInPlay().filter('excludeSelf'), 2, 'target', [applyToBound('target', 0, putCounter(...)), applyToBound('target', 1, putCounter(...))])` — widens `cards/venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal/definition.ts`'s own real `selectUpTo(...).filter('excludeSelf'), 1, ...` "Blessing of Light" shape from max-1/index-0-only to max-2/index-0-AND-1 (each `applyToBound` call is independently a no-op when fewer than `index + 1` creatures were actually picked — the real "UP TO two" looseness). No new combinator vocabulary needed. Passed `validate-card-definition-cli.mjs` (`ok: true`); `pipeline-status.json` written from that real result (`{status:'blue', reasons:[], computedAt}`), same shape/convention every other real FDN card's file already uses.
- **New sink-derivation predicate #5: `sink-model/predicates/lifelink.ts`** (+ `.test.ts` + `.corpus.json`, mocked `CardDefinition` fixtures + a real `state.ts` `dealDamage` engine call per corpus case, same "direct function call, not a scripted scenario" convention `saga.ts`/`crew.ts` already established) — `lifelinkProductionResult(card)` reads `card.keywords`/`card.backFace.keywords` for `'Lifelink'` (a bare, deterministic field check — `applicable` is always `true`, genuinely different from Saga's/Crew's own narrower "doesn't apply to a non-Saga/non-Vehicle card" case) and `lifelinkProductionOccurrences(card)` emits the SAME `{event:'lifegain', controller:'you'}` shape a real `gainLife` `Effect` already produces via `walkEffects`. Registered as a 5th `SINK_DERIVATION_MECHANISMS` entry (`sink-derivation-status.ts`) — real, immediately `blue` (predicate module + fully-agreeing 3/3 corpus manifest landed together, not `gray`-then-later-verified the way Saga/Crew's own history went). Wired into `match-sink.ts`'s `deriveOccurrences` the same gated way as Saga/Crew: `if (isSinkDerivationMechanismUsable('lifelink', root)) out.push(...lifelinkProductionOccurrences(card));`.
- **Real, confirmed disagreement with the OLD paired-fact model, deliberate — flagged, not silently forced**: `synergy.ts`'s own `LIFELINK_SYNTHETIC_FACT_ENABLED = false` (PARKED by explicit user decision, 2026-09-14 — see that flag's own doc comment) still governs FIN's REAL, SERVED Interactions/graph-links pipeline (`augmentPoolCards`/`findInteractionsForCard`), completely untouched by this predicate — printed Lifelink alone still does NOT synthesize a lifegain Fact there. This NEW predicate instead lives entirely in the separate sink-only/catalog PROTOTYPE matcher (`sink-model/match-sink.ts`, `card-interactions.ts` — FDN-scoped in production serving today, see `server/api/card/[set]/[number].ts`'s single `computeCardInteractions` call site inside `loadFdnFunctionalModel` only). `sink-model/match-sink.test.ts`'s own long-standing "sink D" case (imports real FIN `CardDefinition`s, including Aerith Gainsborough — who also prints Lifelink — purely as a cross-check corpus, never served output) used to assert `matchSink(lifegainSink, aerithGainsborough)` is `false`, explicitly citing the parked flag; now asserts `true`, with a rewritten comment explaining this is a deliberate, freshly-commissioned divergence for THIS matcher only, not a silent revival of the parked FIN pattern. **`synergy.ts`'s own flag was left exactly as-is** — un-parking the OLD mechanism, if it ever happens, is still its own separate decision.
- **Verified live, end-to-end**: `computeCardInteractions(ajanisPridemate, [ajanisPridemate, felidarSavior, serraAngel, healersHawk])` — Ajani's Pridemate's own `"Lifegain"` category (`count: 3`) now genuinely includes `"Felidar Savior"` AND `"Healer's Hawk"` (both via the new Lifelink predicate) alongside itself (via its own `consumerTriggerNames` match from section 3 above), correctly excluding `"Serra Angel"` (no Lifelink, no matching trigger).
- Full `functional-model` suite green (1197 passed, 5 skipped, 0 failed) and `npm run typecheck` shows the identical pre-existing error set as a clean `main` baseline (confirmed via a scoped `git stash`/re-typecheck/`stash pop` before-and-after) — zero new errors from any file this pass touched.

### 5. SUPERSEDED (2026-09-18, later still) — catalog-only, no raw fallback; served shape gained real thumbnails

Two more corrections to sections 3-4 above, both by direct user instruction:

- **The raw occurrence-derived `describeFact` fallback labeling (section 3's "kept as a fallback" claim) no longer exists at all.** The user: "let's only consider sink resources there only." `computeCardInteractions` now returns ONLY categories with a real `SINK_CATALOG` match (producer via `matchSink` or consumer via `consumerTriggerNames`) — the `describeFact`/`deriveOccurrences`/raw-`SinkQuery` fallback loop and its now-fully-dead `toSinkQuery`/`labelFor` helpers were deleted outright (confirmed nothing else imports them). Ajani's Pridemate's `"enters the battlefield"`/`"counters"` categories (real, correctly computed under the old design) are GONE — it shows only `"Lifegain"` now. A card with zero catalog-covered occurrences returns `[]` (the panel's own `v-if` length guard already handles this, no template change needed).
- **A card's own CONSUMER match no longer counts it as a match in `matchingCardNames`.** Real bug, found by the user live: Ajani's Pridemate was showing up inside its own `"Lifegain"` category's matches, despite having no `gainLife` effect — "It doesn't [have lifegain] — it's purely a sink 'whenever you gain life'." Fixed in `card-interactions.ts`: the per-candidate loop now only adds a candidate via `matchSink` (producer); `matchesConsumerTriggerNames` decides ONLY whether `definition` owns/shows the category at all, never whether a candidate is counted as a match. A card that purely consumes a sink with no producer in the pool still gets the category's row (an honest `count: 0`/`matchingCardNames: []`), never fabricated self-inclusion.
- **The served shape is no longer bare names.** `computeCardInteractions` itself stays pure/unchanged (still `matchingCardNames: string[]`, no fs/db reads) — the enrichment happens one layer up, in `server/api/card/[set]/[number].ts`'s new `enrichCardInteractions()`, which joins each name against the SAME `resolveFunctionalModelCardMeta`/`dbLookupByName` convention `loadInteractionGroups` (the FIN panel's own server-side assembly) already uses against `data/cards.db` — an FDN card is just a real printed card, so this resolves for free, no new lookup mechanism. `FunctionalModelData.cardInteractions` is now `EnrichedCardInteractionCategory[]` (`{category, count, matches: {card, self?, set?, collectorNumber?, image?}[]}`), mirrored in `app/lib/cardResponse.ts`. `CardDetailTabs.vue`'s FDN Interactions block now renders real 220px thumbnails (same visual shape as the FIN panel) instead of plain text chips, with a `ring-2 ring-primary` outline on the self match (`EnrichedCardInteractionMatch.self`, plain name-equality). The pre-existing FIN panel also picked up the same self-outline treatment for visual consistency (previously tooltip-only) — flagged to the user as a visible change to an already-shipped panel they didn't explicitly ask to touch, not yet confirmed either way.

### 6. `etb` catalog entry — real, structural ETB category (2026-09-18, later still)

**SUPERSEDED, 2026-09-18, later still — see section 8 below.** This section's own "no producer/consumer split" verdict was real, correct reasoning for the question it answered (does `on:'enter'` ever fire for another permanent — no), but turned out to be the wrong question for what this category should represent: it over-matched in production (confirmed live: Felidar Savior self-showed "ETB: 20" against the real 100-card pool, just for having an ETB trigger, with NO bounce/blink effect of its own at all). Kept verbatim below as the real investigation that preceded the correction, same "historical record, not silently erased" convention this file already follows elsewhere (see section 3's own multiple "SUPERSEDED" layers for precedent).

Motivated by a real gap the user found live: Felidar Savior (FDN #12) has a genuine ETB trigger (`triggers: [{name:'onEnter', on:'enter', effects:[...put a +1/+1 counter...]}]`) but showed NOTHING in its Interactions panel — no catalog entry covered "ETB" yet, and the catalog-only design (section 5 above) has no raw fallback to at least show "enters the battlefield" the way an earlier iteration briefly did.

**The real design question, resolved by checking the engine first, not guessing**: unlike `lifegain` (a genuine two-role relationship — the event can be caused by one card and reacted-to by a totally different one), an ETB trigger looked like it MIGHT be self-referential only, needing no producer/consumer split. Confirmed directly against the real call sites rather than assumed: `engine.ts`'s `resolveTop` fires a `Trigger.on === 'enter'` entry ONLY off the SAME permanent (`resolved.card`/`real`) that just resolved onto the battlefield; no real trigger-firing call site anywhere in this engine (`resolveTop`, `fireOnPhaseEnterTriggers`, or any other) sweeps a controller's OTHER permanents for an `'enter'`-scoped trigger the way a Soul-Warden-style "whenever ANOTHER creature enters" shape would need — that shape simply isn't representable by `on:'enter'` in this codebase today (it would need its own new `on` value, same "closed vocabulary, grow on demand" discipline the whole union already follows; no real FIN/FDN card needs it, checked). **Verdict: no producer/consumer split — "has a real `on:'enter'` trigger" is itself the whole, single, sufficient structural fact**, simultaneously the reason a card owns the "ETB" category and the reason it counts as a match, self-inclusive by construction.

**Implementation, deliberately NOT reusing the pre-existing `entersBattlefield` occurrence**: `match-sink.ts`'s `collectForFace` already derives a baseline `event:'entersBattlefield'` occurrence for virtually every normal permanent (`isNormalPermanent`, no trigger check at all) plus a second copy for the Land-with-`on:'enter'`-fallback case (`hasOnEnterTrigger`) — querying "ETB" against either would over-match almost the entire pool, conflating "is a permanent that enters" (trivial, universal) with "has a real ETB ABILITY" (meaningful only for the subset that has one). Added a NEW, dedicated occurrence instead — `hasOnEnterTrigger(face)` now ALSO (unconditionally, regardless of the `isNormalPermanent` branch above it) pushes `{event:'etb', controller:'you', subject:'self', via:...}` — purely additive, zero change to any existing `entersBattlefield`-keyed matching.

**`sink-model/catalog/etb.ts`** (+`.test.ts`, 5 mocked-fixture cases, +`.corpus.json`, 5/5): `query: {category:'ETB', event:'etb', controller:'you'}`, no `consumerTriggerNames` — genuinely single-role, per the design verdict above. Registered in `SINK_CATALOG` (`catalog/index.ts`) — 3 real entries as of this writing.

**Verified live against the real, now-100-card FDN pool** (a scratch vite-node script mirroring `list-fdn-definitions.mjs`'s own dynamic-import pattern, not a synthetic sample): 20 real cards structurally match "ETB" (Felidar Savior, Helpful Hunter, Angel of Finality, Arahbo the First Fang, Arbiter of Woe, Bigfin Bouncer, Billowing Shriekmass, Cat Collector, Celestial Armor, Cephalid Inkmage, Curator of Destinies, Dragon Trainer, Goblin Boarders, Gorehorn Raider, Guarded Heir, Gutless Plunderer, Hare Apparent, Prideful Parent, Skyknight Squire, Sun-Blessed Healer — several from the concurrent 89-card authoring batch, not just the original 11). `computeCardInteractions(felidarSavior, <full 100-card pool>)` now genuinely returns BOTH `{category:'ETB', count:20, ...}` AND `{category:'Lifegain', count:11, ...}` — previously returned neither. `card-interactions.test.ts`'s existing Helpful Hunter case (previously asserting `[]` — "no catalog entry covers 'card draw'") was updated to assert the real new `'ETB'` row instead of an empty result; a new Felidar-Savior-specific case added.

Full `functional-model` suite: 115 files, 1203 passed / 5 skipped (was 1202/5 before this pass — `sink-catalog-status.test.ts` needed 2 small assertion updates for the new registered slug/category, unrelated to any regression). `npm run typecheck`: identical pre-existing baseline error set confirmed via a scoped `git stash`/typecheck/`stash pop` before-and-after — zero new errors from any file this pass touched.

### 7. Real bug fix: predicate-derived matches no longer grant SELF-ownership of a category (2026-09-18, later still)

Real bug found live by the user, in exactly the shape section 6's own "Lifegain: 11" example already surfaced without anyone noticing: `healer-s-hawk` (FDN #142) and `felidar-savior` both self-displayed a `"Lifegain"` category on their OWN page, entirely off the `lifelink` sink-derivation predicate (section 4 above) — neither card has a real `gainLife` `Effect` anywhere on its own `definition.ts`; Lifelink's lifegain is a `state.ts`-level automatic engine side-effect of dealing damage, never something either card's own definition actually STATES. Compare `day-of-judgment`, which correctly DOES self-display `"Graveyard fodder"` — its match comes from walking its own real, directly-authored `destroy all creatures` program, a genuine explicit statement of what the card does.

**The rule, confirmed with the user**: a predicate-derived match must still count for the REVERSE direction (another card's own want correctly seeing a Lifelink creature as a real Lifegain PRODUCER in ITS OWN `matchingCardNames` — Ajani's Pridemate seeing Felidar Savior/Healer's Hawk this way is unchanged, still the whole point of the Card→Sink→Predicate→Card chain from section 4) — but SELF-ownership (whether a category appears in a card's OWN output at all) now requires a genuine DIRECT match (a real effect/trigger/program walk), never a predicate-derived one.

**Mechanism**: `ProducerOccurrence` (`sink-model/match-sink.ts`) gained a new `predicateDerived?: boolean` field, set `true` ONLY by `deriveOccurrences` itself at its 3 predicate call sites (`sagaChapterCompletionOccurrences`/`crewTapOccurrences`/`lifelinkProductionOccurrences`, each piped through a small `markPredicateDerived` helper) — never by a predicate module itself, so this stays one centralized marker rather than something each new predicate has to remember to set. `SinkMatchResult` (also `match-sink.ts`) now surfaces this too (`predicateDerived?: boolean`, alongside the pre-existing `via`) — whichever occurrence satisfied the query, its own `predicateDerived` flag rides along in the result. `card-interactions.ts`'s self-ownership gate now computes `selfDirectProducerMatch = selfProducerMatch.matched && !selfProducerMatch.predicateDerived` and requires `selfDirectProducerMatch || selfConsumerMatch` (previously just `selfProducerMatch.matched || selfConsumerMatch`) before adding a category row at all. The reverse pool-matching loop (checking every OTHER `poolDefinitions` candidate, including a predicate-derived match) and the consumer-mode ownership check (`consumerTriggerNames`) are BOTH completely unchanged — this fix is scoped exclusively to the self-ownership gate.

**Verified live against the real, now-100-card FDN pool**:
- `healer-s-hawk` self: `[]` (was `[{category:'Lifegain', count:1, matchingCardNames:["Healer's Hawk"]}]`).
- `felidar-savior` self: `[{category:'ETB', ...}]` only — `"Lifegain"` is gone (was showing both).
- `day-of-judgment` self: unchanged, still `[{category:'Graveyard fodder', ...}]` (direct program match, unaffected).
- `ajanisPridemate` w/ `[ajanisPridemate, healersHawk, felidarSavior]` in pool: unchanged, still `{category:'Lifegain', count:2, matchingCardNames:['Felidar Savior', "Healer's Hawk"]}` — the reverse direction is untouched.
- Two more real Lifelink-only cards from the 89-card scale-up batch checked the same way and confirmed to lose self-display identically, for the same reason: `sun-blessed-healer` (self: `[{category:'ETB', ...}]` only) and `guarded-heir` (self: `[{category:'ETB', ...}]` only); `sire-of-seven-deaths` (Lifelink, no other effects at all) now self-shows `[]`. No Saga/Crew card exists in the real FDN pool yet (checked directly) — nothing to verify for those two predicates today, flagged for whenever one is authored.

Tests: `functional-model/card-interactions.test.ts` gained real-card cases for `healer-s-hawk`/`felidar-savior` asserting the fixed self-ownership behavior (plus the reverse-direction Ajani's-Pridemate case staying green, unchanged). `functional-model/sink-model/match-sink.test.ts` gained a case asserting `SinkMatchResult.predicateDerived` is `true` for a lifelink-predicate match and unset for a direct `gainLife`-effect match. Full `functional-model` suite green, `npm run typecheck` clean (identical pre-existing baseline).

### 8. Real bug fix: `etb` redesigned as a genuine two-role "blink/bounce value" archetype (2026-09-18, later still — supersedes section 6)

Real bug found live by the user, same session as section 7's fix, in the SAME file territory: section 6's "no producer/consumer split" `etb` design over-matched — `felidar-savior` (FDN #12) self-showed `"ETB: 20"` on its own page purely for having a real `on:'enter'` trigger, with no bounce/blink effect of its own at all. The user's own correction: "Here only effect like return to the hand, or bounce or something similar should get etb." The real, intended concept all along is the "blink/bounce value" archetype — cards that bounce/return a permanent to hand (or blink it) paired with cards that have a valuable, repeatable ETB trigger worth re-triggering — a genuine TWO-ROLE relationship, the exact same shape as `lifegain`, not a single self-referential fact.

**Producer/consumer split, mirroring `lifegain`'s own shape exactly**:
- **Producer** (`etb.ts`'s own `query`, now `{category:'ETB', event:'bounce', controller:'you'}`) — a real, NEW `event:'bounce'` `ProducerOccurrence`, added to `match-sink.ts`'s `walkEffects`'s `case 'move'`: fires when a `move` effect's own `from` includes `'Battlefield'` AND `to === 'Hand'` — a card is only ever a genuine PERMANENT (CR 110.1) while it's actually on the battlefield, so this shape can never be confused with a graveyard-recursion effect (`from:'Graveyard', to:'Hand'` — Vampire Soulcaller/Inspiration from Beyond, FDN, correctly do NOT match). The real, motivating producer is Bigfin Bouncer (FDN): `{kind:'move', owner:'opponents', from:'Battlefield', to:'Hand', validType:'creature', target:true}`. Deliberately scoped to bounce-to-hand only, NOT blink (exile-then-return) — checked directly, no real card in this pool models "exile, then return to the battlefield" as a single structural shape at all; a real, separate, documented future gap, not guessed at.
- **Consumer** (`SinkCatalogEntry.consumerTriggerOn?: Array<Trigger['on']>`, `sink-model/catalog/entry.ts`, checked via `sink-model/match-sink.ts`'s new `matchesConsumerTriggerOn`) — a NEW sibling mechanism to `consumerTriggerNames`, checking the engine's own real CLOSED `Trigger.on` enum (`card.ts`) instead of the free-text `Trigger.name` field — genuinely SAFER than `consumerTriggerNames` (zero name-collision risk: `on:'enter'` means exactly one real, auto-fired thing, always). `etb` declares `consumerTriggerOn: ['enter']` — this is the one part of the original section-6 design that was already correct and is kept as-is: a card with a real `on:'enter'` trigger OWNS the "ETB" category (it's the thing worth re-triggering), even though it doesn't itself produce the bounce/blink effect.

**The old, now-dead `event:'etb'` occurrence** (`collectForFace`'s `hasOnEnterTrigger` push, section 6's own implementation) was DELETED outright, not left unused-in-place — nothing else in the repo referenced it once `etb.ts`'s query stopped pointing at it (confirmed by grep before removing, same "dead code removed, not left as a second silent way back in" discipline section 5's `toSinkQuery`/`labelFor` deletion already established).

**`card-interactions.ts`'s self-ownership gate** (section 7 above) now also consults `matchesConsumerTriggerOn(entry.consumerTriggerOn, definition)` alongside `matchesConsumerTriggerNames`, either sufficient for `selfConsumerMatch`. The reverse pool-matching loop is completely unaffected — a producer match (`matchSink(entry.query, candidate)`) is the only thing that ever counts as a match, exactly like `lifegain`/Ajani's Pridemate; a pure-consumer card (Felidar Savior/Helpful Hunter, real `on:'enter'` triggers with no bounce effect of their own) owns the "ETB" row but is never counted among its own matches. A card that's BOTH (Bigfin Bouncer — it has its own real `on:'enter'` trigger that fires ITS bounce effect) counts as its own match via the producer path, same as any other category.

**Verified live against the real, now-100-card FDN pool** (the same full-pool scratch script used for section 6's own original verification):
- `felidar-savior`: `[{category:'ETB', count:1, matchingCardNames:['Bigfin Bouncer']}]` — down from the real, confirmed `count:20` bug, and correctly excludes itself (no bounce effect of its own).
- `bigfin-bouncer` self: `[{category:'ETB', count:1, matchingCardNames:['Bigfin Bouncer']}]` — genuinely counts as its own match (producer AND consumer).
- `healer-s-hawk`/`ajanisPridemate`/`day-of-judgment` full-pool results re-checked in the same pass and confirmed unaffected by this change (section 7's own fix independently verified to still hold): `healer-s-hawk` self `[]`, `ajanisPridemate` full-pool `Lifegain` count 11 (unchanged), `day-of-judgment` full-pool `Graveyard fodder` count 3 (unchanged).

Tests: `sink-model/catalog/etb.ts`/`etb.test.ts`/`etb.corpus.json` fully rewritten (8 cases: 4 producer, 4 consumer, mirroring `lifegain.test.ts`'s own producer/consumer split shape). `sink-model/catalog/entry.ts` gained `consumerTriggerOn`. `sink-model/match-sink.ts` gained the new `event:'bounce'` occurrence + `matchesConsumerTriggerOn`. `card-interactions.test.ts`'s Helpful Hunter/Felidar Savior cases rewritten for the new consumer-only-means-zero-matches behavior; new Bigfin Bouncer self-match case added. Full `functional-model` suite: 115 files, 1212 passed / 5 skipped (was 1207/5 after section 7's own pass). `npm run typecheck`: identical pre-existing baseline error set, zero new errors from any file this pass touched.

### 9. `battlefield-presence-cats`/`battlefield-presence-creatures` — a shared-matcher catalog PAIR, plus a new self-ownership escape hatch (`requireConsumerForSelfOwnership`) (2026-09-18, later still)

Real motivating card: Claws Out (FDN #6, `{3}{W}{W}` Instant) — `costReduction: {perControlled: {amountPerMatch: 1, subtype: 'Cat'}}` ("Affinity for Cats") plus `effects: [{kind:'pumpAll', predicate:'creatures-you-control', power:2, toughness:2, untilEndOfTurn:true}]` ("Creatures you control get +2/+2"). Per the user's own explicit framing, BOTH abilities are the same underlying "cares about the board-state COUNT of a filtered set of permanents you control" concept — "Battlefield presence" — surfaced as TWO catalog entries (`Cats`/`Creatures`, different `query`/`consumerBattlefieldPresence.subtype`) sharing one new matcher function, not two independent mechanisms.

**Producer** (`query`, both entries): reuses the EXISTING baseline `entersBattlefield`/`createToken` occurrences `match-sink.ts` already derives for every normal permanent — a real Cat/Creature card's own baseline occurrence (`to:'Battlefield', controller:'you', subject:'self'`) or a `createToken` effect's own `resolvedAttrs.types` already resolves real creature SUBTYPES via `synergy.ts`'s `typeWordsFromTypeLine` (splits a type line on the em-dash), so `{category:'Cats', to:'Battlefield', controller:'you', types:{has:['Cat']}}`/`{category:'Creatures', ..., types:{has:['Creature']}}` matched zero new occurrence code — the existing zone-shaped matching branch (`occurrenceSatisfiesSink`) already handles it. `Creatures` is deliberately broad by design (matches virtually every real creature card as a producer) — that's the whole point of a generic board-count category, not an over-match to fix.

**Consumer** (`SinkCatalogEntry.consumerBattlefieldPresence?: {subtype?: string}`, `entry.ts`; `matchesBattlefieldPresenceConsumer`, `match-sink.ts`) — a NEW consumer-recognition mode, genuinely different in KIND from `consumerTriggerNames`/`consumerTriggerOn` (both `Trigger`-keyed): checks `CardDefinition.costReduction.perControlled.subtype` (front/back face) and every real `pumpAll`/`putCounterAll` effect (`effects`/`triggers[].effects`/`abilities[].effects`/nested `modal` modes) whose own `predicate === 'creatures-you-control'` and whose own `subtype` field matches `filter.subtype` EXACTLY (both `undefined` included — the bare, no-subtype "Creatures" case; a subtype-filtered anthem does NOT satisfy the no-subtype filter, and vice versa). `battlefield-presence-cats` declares `{subtype:'Cat'}`; `battlefield-presence-creatures` declares `{}` (subtype omitted — present-but-empty is what distinguishes "has this consumer signal, generically" from "has none at all," same convention `consumerTriggerNames: []` would leave ambiguous if the array itself weren't the presence signal).

**Real bug found LIVE by the user, same session, before this task was reported done — a genuine escape hatch, not a special case bolted onto the self-ownership gate inline**: the first cut reused the pre-existing `selfDirectProducerMatch || selfConsumerMatch` self-ownership rule verbatim (same as `lifegain`/`etb`/`graveyard-fodder`) — Helpful Hunter (FDN #16, `typeLine: 'Creature — Cat'`, "When this creature enters, draw a card," NO cost-reduction/anthem effect at all) self-displayed a `"Cats"` row (`count:8`, including itself) on its OWN card page purely for BEING a Cat. The user's own diagnosis, confirmed correct: merely being a Cat/Creature is passive type/subtype MEMBERSHIP, not a deliberate, authored ability — structurally different from Bigfin Bouncer's real bounce EFFECT or Day of Judgment's real destroy-all PROGRAM (both genuine authored abilities that make self-display meaningful) — the same shape of over-match the original `etb` design already hit once (section 6/8 above) and was corrected for, just via bare TYPE membership instead of bare TRIGGER presence this time.

**Fix**: new `SinkCatalogEntry.requireConsumerForSelfOwnership?: boolean` (`entry.ts`) — when `true`, `card-interactions.ts`'s self-ownership gate considers ONLY `selfConsumerMatch` for that entry (`selfOwnsCategory = entry.requireConsumerForSelfOwnership ? selfConsumerMatch : selfDirectProducerMatch || selfConsumerMatch`); a genuine direct producer match is NEVER sufficient on its own for self-display, no matter how directly `definition` satisfies `query`. Set `true` on BOTH `battlefield-presence-cats`/`-creatures`; every other entry (`lifegain`/`graveyard-fodder`/`etb`) leaves it unset, unchanged. **The reverse direction (the per-candidate `matchingCardNames` loop, deciding who counts as a MATCH for whoever DOES own the category) is completely untouched either way** — it was never gated on self-ownership at all, only on the producer-shaped `matchSink` check — so Helpful Hunter still correctly appears in Claws Out's own `"Cats"` `matchingCardNames`, and any other real Cat/Creature still correctly appears as a producer for someone else's want.

**Verified live against the real, now-100-card FDN pool**:
- `claws-out` (FDN #6) self: `[{category:'Cats', count:8, matchingCardNames:[8 real Cats, self excluded]}, {category:'Creatures', count:72, matchingCardNames:[72 real creatures, self excluded]}]` — both via `consumerBattlefieldPresence`, neither via a producer match (Claws Out is an Instant).
- `helpful-hunter` (FDN #16) self: `[{category:'ETB', count:1, matchingCardNames:['Bigfin Bouncer']}]` only — no `Cats` row at all (down from the real, confirmed `count:8`-including-itself bug).
- `ajanis-pridemate`/`felidar-savior`/`bigfin-bouncer`/`healers-hawk`/`serra-angel` (all real Cats/Creatures with no Affinity/anthem effect of their own) re-checked and confirmed to likewise NOT self-display `Cats`/`Creatures` — only their own pre-existing, unrelated categories (`Lifegain`/`ETB`/none) survive.
- `GET /api/sink-catalog`: both new entries `blue` (corpus manifests `11/11`/`10/10`), `producerMatches` 8/72 respectively (the reverse-direction pool, unaffected by the self-ownership fix, which only gates the CARD PAGE's own self-display).

**Known, narrow, out-of-scope gap flagged, not fixed**: `server/api/sink-catalog/index.get.ts`'s own `computeRealMatches` (`hasConsumerSignal`) only checks `entry.consumerTriggerNames`/`entry.consumerTriggerOn` — it doesn't yet know about `consumerBattlefieldPresence`, so the `/app/engine/sinks` review-tool page's own `consumerMatches` list is `undefined` (omitted, not a crash) for both new entries even though they DO have a real consumer signal; `producerMatches` (8/72) still renders correctly. Card-serving-API-side, `card`/`server`-owned file, not touched by this `engine`-scoped task — a real, small follow-up for whoever picks up that route next, not a correctness bug in the underlying catalog/matching logic itself.

Tests: `sink-model/catalog/battlefield-presence-cats.ts`/`.test.ts` (11 cases)/`.corpus.json`, `sink-model/catalog/battlefield-presence-creatures.ts`/`.test.ts` (10 cases)/`.corpus.json` — new trio pair, mirroring `lifegain`'s own producer/consumer-split test shape. `sink-model/catalog/entry.ts` gained `consumerBattlefieldPresence`/`requireConsumerForSelfOwnership`. `sink-model/match-sink.ts` gained `matchesBattlefieldPresenceConsumer` (+ 2 private helpers) — zero new `ProducerOccurrence` shapes, reuses existing zone-shaped matching. `sink-model/catalog/index.ts` registers both (5 real entries total). `card-interactions.ts`'s self-ownership gate rewritten for the new `requireConsumerForSelfOwnership` branch. `card-interactions.test.ts` gained the Claws Out/Helpful Hunter cases above; every PRE-EXISTING test asserting a creature card (Ajani's Pridemate/Helpful Hunter/Bigfin Bouncer/Healer's Hawk/Felidar Savior/Serra Angel) self-displays `Cats`/`Creatures` was reverted back to asserting it does NOT (the corrected, post-fix behavior). `sink-catalog-status.test.ts` updated for the 5-entry registry. Full `functional-model` suite: 117 files, 1239 passed / 5 skipped (was 1212/5 before this section). `npm run typecheck`: identical pre-existing baseline error set (`CardDetailTabs.vue`/`card-status.ts`/`card.ts`'s `endTurn`/`mana.ts`/`server/api/tokens/by-key.ts` — none in any file this pass touched), zero new errors.

### 9b. `battlefield-presence-hare-apparent` — a THIRD filter variant ("same name as self"), unblocked by a new combinator primitive, not just a new catalog entry (2026-09-18, later still)

Real motivating card: Hare Apparent (FDN #15) — "When this creature enters, create a 1/1 Rabbit token for each other creature you control named Hare Apparent." Unlike Cats/Creatures (a `subtype`/`types` filter), this card's own board-count lived in a raw `(ctx: EffectContext) => number` closure on `createToken.amount` — a legitimate, pre-existing vocabulary in this codebase (many FIN cards use the identical shape for dynamic amounts), but opaque to `matchesBattlefieldPresenceConsumer`'s structural walk, which only ever reads declarative fields.

**Design decision: extend `combinator.ts` with one new `FilterPredicate` variant, `{field: 'sameNameAsSelf'}`** (mirrors `'excludeSelf'`'s own shape — no parameter, always resolved relative to `ctx.self`, but compares `Card.getName()` and bakes the self-exclusion into the SAME predicate rather than composing two filters) — chosen over a narrower additive marker specifically because it was NOT disproportionate effort: `Query.source: 'creaturesInPlay'` and `Aggregate{op:'count'}` already existed, so only the one new predicate was needed to express the whole shape as real, walkable data (`you.creaturesInPlay().filter('sameNameAsSelf').count()`), matching this codebase's own "combinator DSL is default for new vocabulary" convention. `hare-apparent/definition.ts`'s `createToken.amount` is now this expression (re-gated, still `blue`) instead of the raw closure.

**This required widening `createToken.amount`'s own type** (`card.ts`), from plain `Computed<number>` to `Computed<number> | ValueRef` — a NEW, dedicated `resolveCreateTokenAmount` helper resolves either shape (a plain object/`ValueRef` check, since a `Computed<number>` value is only ever a `number` or a function). Deliberately scoped to this ONE field, not a widening of the fully-generic `resolve<T>`/`Computed<T>` used everywhere else in `card.ts` — every other `amount`-carrying `Effect` kind stays plain `Computed<number>` until a real card forces the same widening there too. `combinator.ts`'s own `resolveValue` (previously module-private) is now exported for this one cross-file call site.

**Consumer detection** (`SinkCatalogEntry.consumerBattlefieldPresence` widened from `{subtype?: string}` to `{subtype?: string} | {sameNameAsSelf: true}`; `matchesBattlefieldPresenceConsumer`'s own `filter` parameter widened to match) — a genuinely different SHAPE of check from the `subtype` variant: it does NOT read `costReduction.perControlled`/`pumpAll`/`putCounterAll` at all, since Hare Apparent has none of those; it walks every real `createToken` effect's own `amount` field (`effectsCareAboutSameNameCount`/`isSameNameCountValueRef`/`queryChainHasSameNameFilter`, `match-sink.ts`) checking whether it's structurally an `Aggregate{op:'count'}` whose own input chain contains a `sameNameAsSelf` `Filter` anywhere (walks through any number of composed filters). Same effect-location coverage (`effects`/`triggers[].effects`/`abilities[].effects`/nested `modal` modes, front+back face) as the `subtype` variant reuses.

**Producer `query` is a deliberate divergence from Cats/Creatures — a literal `name: {eq: 'Hare Apparent'}` constraint, not a generic type/subtype filter.** "Same name as self" is inherently self-referential PER CARD, unlike a shared type/subtype (Cat/Creature legitimately applies across many unrelated cards); a `SinkQuery` deliberately carries no reference back to whichever card owns it (`sink-query.ts`'s own header), so there is no honest, general "does this candidate produce a copy of whichever card is asking" query to write. The one honest producer query for THIS card is the literal name — satisfied by Hare Apparent's own PRE-EXISTING baseline `entersBattlefield` occurrence (zero new producer/occurrence code; reuses `Constraints.name`/`satisfiesConstraints`, already wired through the zone-shaped matching branch). This makes the entry genuinely bespoke/one-card by construction — explicitly sanctioned by `entry.ts`'s own doc comment ("a 'bespoke' sink with only one real card wanting it is still just a catalog entry with low reuse"); a hypothetical future second same-name-counting card would need its own sibling entry (different slug, different literal `name`), sharing this same `sameNameAsSelf` consumer check and matcher function — the same "one shared matcher, N parametrized entries" pattern Cats/Creatures already established, just parametrized by literal name instead of subtype.

**Self-ownership: `requireConsumerForSelfOwnership: true`, reasoned through fresh, not copied blind.** Hare Apparent's own baseline producer occurrence trivially satisfies its OWN literal-name query (every card's baseline occurrence always carries its own name) — the exact same shape of non-deliberate, bare-identity self-match as "being a Cat trivially satisfies the Cats producer query." What DOES make self-display correct is the CONSUMER side: its own ETB effect genuinely, structurally DEPENDS on counting other copies of itself — a real, deliberately-authored "cares about the count" consumer, the same class as Claws Out's own Affinity-for-Cats cost reduction, not bare board-state membership.

**Verified live** (real dev server, `GET /api/card/fdn/15`): `functionalModel.cardInteractions` now includes `{category: 'Same-name copies', count: 1, matches: [{card: 'Hare Apparent', self: true, ...}]}`. `GET /api/sink-catalog`: new entry `battlefield-presence-hare-apparent` shows distinctly, `blue` (corpus manifest `7/7`), `realMatches.producerMatches: ['Hare Apparent']` only (confirming the bespoke-literal-name producer design — no OTHER real FDN card is literally named "Hare Apparent"); `consumerMatches` is omitted, same pre-existing, already-flagged `computeRealMatches`/`consumerBattlefieldPresence` gap section 9 already documents (not fixed here either, still `card`/`server`-owned, out of scope for this `engine`-scoped task).

Two incidental typecheck fixes, needed for exhaustiveness after widening `FilterPredicate`, in files this pass otherwise didn't touch: `combinator.ts`'s own `describePredicate` (debug-string helper) gained a `'sameNameAsSelf'` case; `recognizers/program-ast-walker.ts`'s `readPool` (the `kind:'program'`-AST pool-descriptor walker) gained an explicit decline for `'sameNameAsSelf'` — no real `kind:'program'` effect in this pool chains it (it's authored directly on a bare `createToken.amount`, never inside a `program` effect), so this walker correctly returns `undefined` rather than guessing at a `PoolDescriptor` shape nothing confirms.

Tests: `sink-model/catalog/battlefield-presence-hare-apparent.ts`/`.test.ts` (7 cases)/`.corpus.json` — new entry, third of the shared pair-turned-trio. `sink-model/catalog/index.ts` registers it (7 real entries total, was 6 after `counters-plus1plus1`). `sink-catalog-status.test.ts` updated for the 7-entry registry. Full `functional-model` suite: 120 files, 1276 passed / 5 skipped (was 120 files/1269 before the 2 incidental exhaustiveness fixes added a few more parametrized cases elsewhere). `npm run typecheck`: identical pre-existing baseline error set, zero new errors from any file this pass touched.
