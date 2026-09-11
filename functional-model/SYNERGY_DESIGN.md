# Synergy handling — design v2

Supersedes `SYNERGY_DESIGN.md`. Written for handoff to another agent.
Records what changed in the Sep 2026 design session, why, and what is
deliberately parked. Worked example throughout: Aerith Gainsborough
(`cards/aerith-gainsborough/`).

## What changed, in one paragraph

Facts are no longer flat colon-strings (`zone:Battlefield:Creature:you`)
joined by equality. They are JSON attribute bags with a small, fixed
constraint vocabulary. Static card properties (name, type line, cmc,
power/toughness) are NOT stored in facts — the matcher resolves them from
the producer's `CardDefinition` at match time. Facts are authored by AI
reading `definition.ts` (not derived by script from the trace), and verified by
a script that reconciles them against instrumented traces in both
directions. `synergy-manual.ts` / `check()` functions are dropped. Ranking
of matches (good vs. bad providers) is deferred; matching is binary.

## Why the string-key model was abandoned

Two problems surfaced when working through real wants:

1. **One string was doing two jobs** — naming the theme AND encoding the
   exact value. A want for "permanents with mana value 2–4" would need
   three keys; a want for "any pump" would need one per P/T combination.
   Hundreds of near-duplicate strings with no way to say they are the same
   theme.
2. **Conjunctions.** Aerith wants *legendary creatures*, not legendaries
   and not creatures. `zone:Battlefield:Legendary:you` would match a
   legendary artifact. Compound keys (`Creature+Legendary`) force every
   producer to emit every subset of its type line.

Both dissolve when the theme and the constraint are separate attributes.

## The fact model

A fact is a bag of attributes. `role` is `source` or `sink`. Everything
else describes *where/what* and *who*, plus optional constraints.

```jsonc
// object in a zone — SINK: a plain state check, "wants this present now"
{ "role": "sink",    "zone": "Battlefield", "controller": "you",
  "types": { "has": ["Creature", "Legendary"] } }

// object in a zone — SOURCE: a real zone CHANGE, "this card's own action
// moves something from `from` (optional — omit for an unknown/unspecified
// origin) into `to`" (2026-09-11 rework — see below)
{ "role": "source", "to": "Battlefield", "controller": "you", "subject": "self" }
{ "role": "source", "from": "Battlefield", "to": "Graveyard", "controller": "you", "subject": "self" }

// event
{ "role": "source", "event": "lifegain",   "controller": "you" }
{ "role": "sink",    "event": "dies",       "target": "self" }
{ "role": "source", "event": "putCounter", "counterType": "+1/+1", "controller": "you",
  "target": { "types": { "has": ["Creature", "Legendary"] } } }
```

Rules:

- **Two shapes, not one.** ~~A fact has either `zone`/`to`/`from` (a
  persistent object) or `event` (an occurrence). The matcher branches on
  which is present. Do not unify them.~~ **SUPERSEDED (2026-09-11, later
  same day — see "Fact unification" immediately after this list): this is
  now historical record of the pre-merge design, not the current rule.**
  `ZoneFact`/`EventFact` were unified into one `Fact` interface —
  `zone`/`to`/`from`/`event` are independent optional fields that now
  freely co-occur on the same fact. Kept here, struck through rather than
  deleted, because the REASONING below it (SOURCE-vs-SINK zone semantics,
  `to`/`from` matching rules, etc.) is still accurate and still explains
  real, live behavior — only the "never both at once" constraint itself is
  gone.
- **A zone fact's SOURCE/SINK sides are genuinely different claims, not
  the same shape with a role label (2026-09-11 rework).** A SINK zone
  fact is a timeless state check — "wants a creature on the battlefield
  right now" — and still just declares `zone` (unchanged). A SOURCE zone
  fact is a real zone-CHANGE event the card causes: it declares `to` (the
  zone it moves something INTO — required in practice) and, optionally,
  `from` (the zone moved OUT OF — omit when the origin is unknown/
  unspecified/could-be-anywhere, e.g. this card's own ETB, which could be
  cast from hand, fetched from a library, blinked back from exile — CR
  doesn't distinguish for this purpose; set it when the movement has one
  well-defined origin, e.g. `from: "Battlefield"` for something that dies/
  is sacrificed/destroyed, CR 700.4). `from`/`to` are the authoritative
  MATCHING data — a `sink` fact matches purely on `to` (a consumer caring
  only about "things put into a graveyard, regardless of where they came
  from" matches on `to` alone, `from` is never part of that comparison). A
  human-readable movement name ("dies", "enters the battlefield") is a
  DERIVED display layer on top (`synergy.ts`'s `zoneMovementName`/
  `ZONE_MOVEMENT_NAMES`), never the reverse — bare presence-style wording
  is the fallback for any `(from, to)` pair that table doesn't name yet,
  not a separately-authored fact shape. Cards authored before this rework
  still have a bare SOURCE `zone` field on disk (a pool-wide migration is
  a separate, larger sweep, not done as part of this change) — every
  reader treats that as an implicit `{ to: zone }` (no `from`) for full
  backward compatibility.
- **`subject: "self"`** on a produce means "the card this file belongs
  to." The matcher reads its name/types/cmc/P/T from the `CardDefinition`.
  Nothing static about the card is repeated in the fact.
- **Tokens** point at a definition too: `"subject": { "token": "w_1_1_soldier" }`.
  The matcher resolves types/P/T from `tokens/<slug>/definition.ts` (see
  "Tokens" below).
- **Constraints** appear on sink facts, and on source facts only where the effect
  is filtered (what it *targets*). Vocabulary is fixed and small:
  - lists (`types`): `has` (all of), `hasAny` (any of), `not`
  - numbers (`cmc`, `power`, `toughness`, `amount`): `min`, `max`, `eq`
  - strings (`name`): `eq`
  Grow this only when a real card forces it, never speculatively.
- **`controller`** is `you` / `opp`. Almost every fact has it; it is one
  of the matcher's index columns.
- **No functions.** If a card ever needs a comparison the vocabulary
  cannot express, add a `check.ts` next to that card's `synergy.json`.
  Expect this to be ~never; do not design for it.

### Fact unification — `ZoneFact`/`EventFact` merged into one `Fact` (2026-09-11, later same day, user-approved architecture shift)

**Target model, now current**: `Fact` is ONE interface, not a
`ZoneFact | EventFact` union. `event`, `to`, `from` (and `zone`, the
legacy spelling of `to` — see below) are independent optional fields that
can freely co-occur:

```jsonc
// pure location/presence fact — no event, no from
{ "role": "sink", "to": "Graveyard", "controller": "you" }

// pure named-action fact with no fixed zone consequence worth asserting
// inline (see the ACT-vs-CONSEQUENCE standing rule, synergy.ts's own
// `Fact` doc comment) — no to/from
{ "role": "source", "event": "destroy", "target": { "types": { "not": ["Land"] } } }

// BOTH at once, now ONE object instead of two (fin/1's own merged `dies`
// fact — used to be a separate ZoneFact `self-graveyard` + EventFact
// `self-dies`)
{ "role": "source", "event": "dies", "from": "Battlefield", "to": "Graveyard", "target": "self" }
```

**`zone` folded into `to`.** `zone` was always conceptually "a `to` with
no `from`, no `event`" (a SINK's plain presence check) — keeping both
spellings was two names for one idea. Every NEW fact, SOURCE and SINK
alike, should use `to`; `zone` stays supported (`effectiveZone` resolves
`zone ?? to`) for the rest of the pool, which hasn't been migrated (a
full pool-wide migration is a separate, larger sweep — only summon-
bahamut's own data was migrated in this pass, including its sink fact:
`mega-flare-you`'s `zone:'Battlefield'` is now `to:'Battlefield'`).

**Why**: the old two-interface split forced an awkward workaround the
moment a single real fact legitimately needed BOTH an `event` name AND
real zone data at once — CR 700.4's "dying IS moving from the battlefield
to a graveyard" is exactly ONE real occurrence, not two — `EventFact` had
to invent differently-named `zoneFrom`/`zoneTo` fields (purely
descriptive, never matched — see the now-superseded section below) just
to avoid tripping `isZoneFact`'s structural check. Now that field is
gone; a merged fact just uses real `from`/`to` directly.

**Concrete consequence for fin/1 (Summon: Bahamut), applied this pass**:
- `self-graveyard` (ZoneFact, `from`/`to`, `subject:'self'`) and
  `self-dies` (EventFact, `event:'dies'` + `zoneFrom`/`zoneTo`,
  `target:'self'`) — the SAME real occurrence represented twice — are now
  ONE fact: `{event:'dies', from:'Battlefield', to:'Graveyard',
  controller:'you', subject:'self', target:'self', value:1}`. Carries
  BOTH `subject` AND `target` — **an earlier version of this merge dropped
  `subject` (reasoning "`target:'self'` already says the same thing"),
  which turned out to be a real, measurable, unintended regression, not a
  harmless simplification**: `factsInteract`'s zone-matching branch
  (`resolveSubject(p.subject, ...)`) is the ONLY place a producer's real
  static attributes (Bahamut's own actual types — Creature, Enchantment,
  Saga) get resolved for a TYPE-CONSTRAINED zone-shaped want (e.g. a real
  "creature card in your graveyard" sink) — it never reads `target`.
  Dropping `subject` silently broke 17 real matches a *before* run of
  `find-synergies.mjs` still showed (Ardyn the Usurper, Cloud of Darkness,
  Deadly Embrace, Elixir, Evil Reawakened, Exdeath Void Warlock, Fight
  On!, Golbez Crystal Collector, Gran Pulse Ochu, and others — all real
  type-constrained Graveyard/Battlefield-presence sinks the old standalone
  `self-graveyard` ZoneFact used to satisfy via its own `subject:'self'`).
  Caught by re-running the required diff, not by inspection — fixed by
  keeping both fields, since a complete, non-lossy merge of two facts that
  each already declared a real self-reference (one via `subject`, one via
  `target`) should carry BOTH forward, not arbitrarily pick one. This is
  "make the merge real" (do the actual data-preserving unification), not
  "cleverly preserve both matcher shape-family behaviors" (the explicitly
  deferred redesign) — the shape-family regression below still happens in
  full; this fix only restores a field that should never have been
  dropped in the first place.
  - `self-enters`/`self-cast` deliberately do NOT get the same `subject`
    addition — neither ever had a `subject`-carrying ZoneFact sibling to
    merge from (there was never a separate standalone "self on the
    battlefield" or "self in hand" ZoneFact for this card), so there's no
    dropped field to restore. Adding `subject` to them anyway would be
    opportunistically maximizing matches beyond what the merge itself
    requires — a different, not-requested change — not fixing an
    incomplete merge.
- `destroy-nonland` (EventFact, `event:'dies'` + `zoneFrom`/`zoneTo`,
  `target:{types:{not:['Land']}}`) has NO ZoneFact counterpart on this
  card (no other fact shares its exact target scope), so it isn't merged
  with anything — its `zoneFrom`/`zoneTo` are simply renamed to `from`/
  `to` directly.
- `self-enters` (`zoneTo:'Battlefield'`) → `to:'Battlefield'`. `self-cast`
  (`zoneFrom:'Hand'`) → `from:'Hand'`. Neither has a ZoneFact counterpart
  to merge with either — same rename-only treatment.
- `destroy-act`/`self-sacrifice` (bare ACT tags, never had `zoneFrom`/
  `zoneTo` — see the ACT-vs-CONSEQUENCE standing rule) are UNCHANGED.

**Matching is deliberately UNCHANGED — deferred, not redesigned, this
pass.** `factsInteract` still hard-partitions on `isZoneFact(fact)` (now a
plain structural classifier over one `Fact` type, not a type-narrowing
union guard) before attempting a match — a fact with any of `to`/`from`/
`zone` is "zone-shaped," an `event`-only fact is "event-shaped," and the
two families still never match each other. **A merged fact that now
carries BOTH `event` and `to`/`from` is classified into the zone-shaped
family ONLY** — it no longer also satisfies an `event`-shaped want for the
same real-world concept the way its old separate EventFact half used to.
This is a real, user-accepted regression ("we can tweak interactions
later if we break something") for the specific facts it hits — NOT
silently absorbed, verified via a real before/after `find-synergies.mjs`
diff on summon-bahamut (see below) rather than assumed. **Full matcher
unification — letting one fact satisfy BOTH shape-families' wants at once
— is tracked here as open future work, not done in this pass.**

**Real pool-wide interactions diff (`find-synergies.mjs`, summon-bahamut
only — confirmed zero collateral change to any other card via a full-pool
before/after diff, and re-run a SECOND time after the `subject`-dropping
bug above was caught and fixed — the numbers below are the FINAL,
corrected ones, not the first, buggy measurement)**:
- **Lost** (used to match, no longer does — 9 distinct real cards, 3 of
  them counted twice below because both `self-dies` and `destroy-nonland`
  independently matched them before as separate EventFacts): the real
  EventFact `event:'dies'` sinks — Aerith Gainsborough, Dwarven Castle
  Guard, Judge Magister Gabranth (×2), Magic Pot, Sephiroth Fabled
  SOLDIER (×2), Sephiroth Planet's Heir, Undercity Dire Rat, Vincent
  Valentine, Zodiark Umbral God (×2) — 12 total lines, the "dying"-labeled
  group — plus both real EventFact `event:'entersBattlefield'` sinks
  (Loporrit Scout, Woodland Weavemaster) — 14 lines total. This IS the
  accepted, expected shape-family regression: these sinks are genuinely
  EventFact-shaped (`event:'dies'`/`event:'entersBattlefield'`, no
  `zone`/`to`/`from` of their own), and the merged Bahamut facts that used
  to satisfy them as EventFacts are now classified zone-shaped instead.
- **Gained** (didn't match before, does now): the SAME 9 real
  UNCONSTRAINED zone-shaped Graveyard-presence sinks (Cantankerous
  Keepers, Eden Seat of the Sanctum, Emet-Selch Unsundered, Ignis
  Scientia, Magic Pot, Qutrub Forayer, Rydia's Return, Thranduil Sindarin
  Liege, Vanille Cheerful l'Cie) gain a SECOND, duplicate matching line
  each (net +1 apiece — they already matched ONCE before, via the
  standalone `self-graveyard` ZoneFact; now BOTH the merged `dies` fact
  AND `destroy-nonland` independently satisfy them as separate zone-shaped
  producers, since neither has a type constraint to fail on) — confirmed
  via an explicit before/after count check per card, not assumed from the
  raw line diff alone. Genuinely NEW (0 → 1) are 10 real zone-shaped
  Battlefield-presence sinks (Clash of the Eikons, Dion Bahamut's
  Dominant, Doppelgang, Formidable Speaker, Omega Heartless Evolution,
  Restoration Magic, Sage's Nouliths, Squall SeeD Mercenary, Stiltzkin
  Moogle Merchant, The Wandering Minstrel) via `self-enters`'s real
  `to:'Battlefield'` (this fact had no zone-shaped capability at all
  before), and one new self-interaction (`same-instance`) on `self-cast`,
  gained via the `effectiveController` plumbing fix below, not the shape
  reclassification itself.
- **Explicitly NOT regressed** (this only became visible after the
  `subject` fix above): the 17 real type-constrained zone-shaped
  Graveyard/Battlefield-presence sinks (Ardyn the Usurper, Cloud of
  Darkness, Deadly Embrace, Elixir, Evil Reawakened, Exdeath Void Warlock,
  Fight On!, Golbez Crystal Collector, Gran Pulse Ochu, and others) that
  the old standalone `self-graveyard` ZoneFact used to satisfy via its own
  `subject:'self'` still match today, via the merged `dies` fact's own
  (now-restored) `subject:'self'` — a FIRST, buggy version of this merge
  (before the `subject` fix) silently lost all 17 of these; re-verified
  after the fix that they're back to net-zero change (still 1 real match
  each, same as before the whole task started).
- Net: 543 → 549 total interaction lines for this card (+6: -14 lost, +20
  gained), a real, fully-accounted-for, documented tradeoff — not a
  silent regression, and not the "roughly -11" figure a naive first pass
  at this same diff produced before the `subject` bug was caught.

**Two small "just enough plumbing so nothing crashes" fixes, both real
bugs this merge surfaced, not new matching semantics**:
1. `effectiveController` (synergy.ts) used to branch on `isZoneFact` to
   decide whether to read `subject` or `target` for self-reference —
   correct only while the two fields were mutually exclusive by
   construction. A merged fact can carry `target:'self'` with no
   `subject` at all while ALSO being classified zone-shaped (e.g.
   `self-cast`, now zone-shaped via its own real `from`) — the old
   branch would silently stop recognizing it as self-referencing. Fixed
   to check both fields unconditionally. This is why `self-cast` gained a
   real self-interaction match above — not a matching-semantics redesign,
   just correcting a helper that assumed a structural invariant the merge
   removed.
2. `factsInteract`'s zone-zone branch compared a sink's `to` against a
   bare `w.zone` read (not `effectiveZone(w)`) — harmless while every
   real sink in the pool only ever authored `zone`, but this pass's own
   `mega-flare-you` sink now authors `to` instead. Fixed to use
   `effectiveZone(w)`; the identical bug (and identical fix) also existed
   in `scripts/verify-synergy.mjs`'s own JS-duplicate matcher (its sink
   branch only ever checked `'zone' in w`, not `'to' in w` — surfaced as
   3 real hard failures on this card's own re-verification before the
   fix, now resolved).

`describeFact` also gained a defensive fallthrough (a `from`-only fact
like `self-cast` has no "current zone" to render as a presence phrase —
it now falls through to the `event`-named branches instead of crashing on
an undefined zone string) — purely a rendering fix, not a matching one.

**Follow-up question, answered concretely (2026-09-11, later same day):
is `event` on `self-enters` (`{event:'entersBattlefield', to:'Battlefield',
...}`) still doing anything now that it also has `to`?** Traced every real
consumer rather than guessing: **no, it's currently fully inert.**
`factsInteract`'s shape-partition gate (`isZoneFact(p) !== isZoneFact(w)`)
rejects `self-enters` against both of the real event-shaped
`event:'entersBattlefield'` sinks (Loporrit Scout, Woodland Weavemaster)
before the `event` string is ever compared — that gate, not a string
mismatch, is the actual reason those 2 matches are lost (confirmed by
checking their own sink shapes: both are pure `{event:'entersBattlefield',
...}`, no `to`/`from`/`zone` at all). `describeFact`'s label ("enters the
battlefield") comes entirely from `zoneMovementName`'s `(from,to)`-pair
lookup, not from `event` — the zone branch returns before `event` is even
read. Same story for `themeOf`/`factKind`/`app/lib/factConditions.ts`.
**Kept anyway, deliberately** — real documentation of what the movement
fundamentally is, and the exact field a future matcher-unification pass
(open work, above) would read to recover those 2 matches; removing it now
would save nothing and lose real signal. See `Fact.event`'s own doc
comment in `synergy.ts` for the same answer in-code.

### No `id`, no `sourceText`/`highlight` on the served fact — `annotations` required (2026-09-11)

Three related, same-day corrections, all in service of the running "facts
should be as short as possible" theme:

- **`Fact.id` removed entirely.** It used to be the stable per-card
  identity key mainly needed to cross-reference a fact between the old
  `AnnotatedFactRef`-based segment tree and the Facts table — that whole
  mechanism is gone (`annotateOracleText`/`AnnotatedSegment`/
  `AnnotatedFactRef` deleted from `synergy.ts` earlier the same day). The
  secondary "stable identity across regen/diffing" argument for keeping
  it anyway was explicitly rejected: facts are short enough now that an
  AI can just re-author them, no stable key needed. The one remaining
  convention — matching a fact by a tuple of its own fields when nothing
  else identifies it — is now the ONLY identity mechanism, not a
  fallback: `role` + `describeFact(fact)`'s own rendered label + the
  fact's first real `annotations` entry (see `synergy.ts`'s private
  `factIdentity`, mirrored by the card page's own `factKey`).
- **`annotations` is now REQUIRED, minimum one entry** (`[AnnotationRef,
  ...AnnotationRef[]]`, not `AnnotationRef[] | undefined`) — "no
  annotation if undefined" was true by convention before, now it's a
  checked invariant: every fact must genuinely point at something the
  card's own owner actually prints. A fact with nothing real to anchor to
  at all doesn't belong in the model as a `Fact` — fold its signal into
  one that DOES have real backing, or drop it, rather than inventing a
  decorative annotation. Enforced by `scripts/annotation-coverage.mjs`
  (`ANNOTATED_CARD_SLUGS` — scoped to cards that have actually opted into
  the model; the rest of the pool isn't held to this yet), wired into
  `verify-synergy.mjs`'s own exit code and a standalone
  `functional-model/annotation-coverage.test.ts` (`npm run test`), same
  three-file shape `scenario-card-names.mjs` established earlier the same
  day.
  - New `AnnotationRef.target: 'typeLine'` variant (`{start, end}`, no
    `line` — a type line has no paragraph structure) alongside the
    original `'oracle'` shape — added because some facts genuinely have
    no ability-text basis at all: a baseline "this creature was cast as a
    creature spell" / "this permanent enters the battlefield" fact
    (Summon: Bahamut's own `self-cast`/`self-enters`) is true because of
    what's PRINTED ON THE TYPE LINE (`"Enchantment Creature — Saga
    Dragon"`), not the oracle-text body. This is the "something in the
    pool actually needs it" case earlier design notes said would justify
    a new `target` kind — it's real now, not speculative.
  - A fact that truly has NOTHING real to anchor to (pure inferred
    game-rules knowledge, not even the type line) is removed rather than
    force-annotated — Summon: Bahamut's own `self-battlefield` (a
    presence-with-Flying claim existing only so a hypothetical "you
    control a flying creature" sink could match it) was deleted outright
    for exactly this reason, per the SAME rule that already governs
    SOURCE zone facts generally (see the "SOURCE `ZoneFact` reworked"
    section above — a SOURCE fact must describe a real zone TRANSITION,
    never bare presence; `self-battlefield` was presence, not a
    transition, regardless of shape). Checked before deleting: no other
    fact on this card, no scenario, and no other pool card's own SINK
    fact narrows on a flying-specific constraint (the vocabulary doesn't
    even have one) — the only thing lost is Summon: Bahamut's own
    presence in the pool's generic, unqualified "battlefield presence"
    match set (~130 other cards' own bare `{zone:'Battlefield'}` sink
    facts), which is the deliberate, accepted consequence of enforcing
    this rule on this card, not a functional break.
- **`sourceText`/`highlight`/`anchor` removed from the served `Fact`
  shape entirely**, moved to a new, never-served, per-card
  `cards/<slug>/annotations-authoring.json` (`FactAnnotationAuthoring`/
  `AnnotationAuthoringFile`, `synergy.ts`) — once a fact has a real baked
  `annotations` pointer, the literal text is fully re-derivable by
  slicing `oracleText`/`typeLine` at that pointer, so storing the string
  TOO on the served object was pure duplication. The authoring file is
  POSITIONALLY aligned with that same card's `synergy.json` `source`/
  `sink` arrays (index-based, not id-keyed, since `Fact.id` is also gone
  — reorder both together or they silently misalign) — checked into git
  so the authored intent survives for regen/review, read ONLY by
  `scripts/compute-annotations.mjs`. `find-synergies.mjs`/
  `verify-synergy.mjs`'s own matching/reconciliation logic never read
  `sourceText`/`highlight` in the first place, so this move is
  zero-impact there — confirmed via a real byte-identical round-trip
  regen (strip the fields from `synergy.json`, author the same strings
  into the new file, re-run `compute-annotations.mjs`, diff against the
  pre-move file: identical).

### `EventFact.zoneFrom`/`.zoneTo` — descriptive-only, never matched (2026-09-11, later same day)

A `dies`-shaped EventFact (`self-dies`, `destroy-nonland`) used to be a bare
`{event:'dies', ...}` tag with no zone data at all — a reader has to
already know CR 700.4 (dying = battlefield→graveyard, always) to see it's
the same real-world thing as the card's own `self-graveyard` ZoneFact
(`from:'Battlefield',to:'Graveyard'`). Both `dies`-shaped EventFacts on
Summon: Bahamut now carry `zoneFrom: 'Battlefield'`/`zoneTo: 'Graveyard'`
too, so all three "something dies" facts on the card carry matching,
self-explaining zone data instead of two different encodings of the same
real thing.

**Deliberately NOT named `from`/`to`** (`ZoneFact`'s own field names) —
`isZoneFact` discriminates structurally (`'zone' in fact || 'to' in fact ||
'from' in fact`), so reusing those exact keys on an EVENT fact would make
it misclassify as a ZONE fact, breaking the "a fact has either `zone`-shape
or `event`-shape, never both" invariant. `zoneFrom`/`zoneTo` are a
differently-named, purely-informational pair for exactly this reason —
verified empirically (not just reasoned about) that a `dies` fact carrying
them still classifies as `isEventFact`, not `isZoneFact`, and still
describes as bare "dying".

**Purely descriptive — NOT a new matching dimension.** `factsInteract`'s
EventFact branch still matches on `event` string equality alone
(`pe.event !== we.event`); `zoneFrom`/`zoneTo` are never compared. Adding
them does not and must not change which real pool cards match Bahamut's
own `dies`-shaped facts.

**Also considered and rejected: renaming `event: 'dies'` to `event:
'moveZone'`** (the initially-proposed fix) — rejected because the literal
string `'dies'` is itself established, actively-matched pool vocabulary:
11 real cards' own EventFact sinks declare `event:'dies'` today (checked —
al-bhed-salvagers, jenova, judge-magister-gabranth, sephiroth ×2,
undercity-dire-rat, vincent-valentine-galian-beast, zodiark-umbral-god, and
three `target:'self'`-scoped ones that only match a card's OWN dies-fact).
Renaming Summon: Bahamut's own producer-side event string would silently
break every one of those real matches while every other pool card's own
`dies` sinks kept expecting the old name — a real regression, not a
cosmetic rename. The self-explaining-data goal is achieved via
`zoneFrom`/`zoneTo` instead, with the matched `event` name left alone.

**Also considered and rejected, same day yet again: the identical
`moveZone`-style generalization argument applied to `event:
'entersBattlefield'`** now that it carries its own `zoneTo:'Battlefield'`
— user's point being that baking "Battlefield" into the event NAME is
redundant once `zoneTo` already says so, same redundancy argument as
`dies`. Same due-diligence check redone for this specific event string,
not assumed from the `dies` precedent: `grep`'d every real
`cards/*/synergy.json` for `event:'entersBattlefield'` — 16 real cards
declare it (14 as a SOURCE producer: crossroads-village, gohn-town-of-
ruin, gongaga-reactor-town, insomnia-crown-city, baron-airship-kingdom,
guadosalam-farplane-gateway, elrond-moon-reader, rabanastre-royal-city,
sharlayan-nation-of-scholars, treno-dark-city, summon-bahamut, the-gold-
saucer, windurst-federation-center, vector-imperial-capital; 2 as a SINK
want: loporrit-scout, woodland-weavemaster). Ran `find-synergies.mjs`
against the real pool and confirmed these aren't just co-incidental
declarations — they're actively matched today: all 14 producers,
including Summon: Bahamut's own `self-enters`, show real
`--[enters the battlefield]-->` edges into BOTH real sink cards. Renaming
Bahamut's own event string would silently drop it from those 2 real
matches while the other 13 producer cards kept the old name — the exact
same regression class as the rejected `dies`→`moveZone` rename, verified
independently rather than assumed to transfer from that earlier verdict.
`entersBattlefield` stays as-is, same reason `dies` did: it's established,
actively-matched pool vocabulary (and, like `dies`, a real CR-defined term
— CR 110.5/603.6 — not an arbitrary label), and `zoneFrom`/`zoneTo`
already deliver the self-explaining-data goal without touching the
matched name. (No rename happened here, so the follow-up question of
whether a hypothetical rename should also apply retroactively to `dies`
doesn't arise — both event names independently checked and independently
kept, on their own pool-usage merits, not by mechanically transferring one
verdict to the other.)

**Also considered and rejected: collapsing `self-graveyard` (ZoneFact) and
the `dies`-shaped EventFacts into fewer facts**, now that they'd carry the
same from/to data — rejected because they're NOT redundant: `factsInteract`
requires both sides of a match to be the same shape
(`isZoneFact(p) !== isZoneFact(w)` short-circuits to no-match), so a
ZONE-shaped "wants something in a graveyard" sink (30+ real pool cards
checked) can ONLY ever match a ZONE-shaped produce, and an EVENT-shaped
"wants a dies event" sink (11 real pool cards checked, above) can ONLY
ever match an EVENT-shaped produce. Collapsing to one shape would silently
drop real matches on whichever side lost its shape — both are pool-wide
load-bearing today, confirmed via a real pool grep, not assumed from the
design's own earlier reasoning about `destroy-act` alone.

**Extended same day to `entersBattlefield` (`self-enters`).** User caught
that `self-enters` (`{event:'entersBattlefield', target:'self'}`) is the
same kind of bare zone-transition tag `self-dies` used to be before the fix
above. Fixed the same way: `self-enters` now carries `zoneTo:
'Battlefield'`, `zoneFrom` omitted.

**Standing rule, generalized same day after a second round (2026-09-11,
third pass): every real zone is fair game for `zoneFrom`/`zoneTo` when
actually known; the Stack specifically is never assigned as a value on
either side.** Battlefield, Graveyard, Hand, Library, Exile, Command,
etc. are all legitimate values. The Stack is different in kind, not just
another zone we haven't gotten around to: this model treats it as
invisible/skip-through, because CR 601's cast process moves a card THROUGH
the stack on its way to resolving rather than TO the stack as a meaningful
resting place the way Graveyard/Exile/Battlefield are, and no fact
anywhere in this model's vocabulary sinks on "is on the stack" as a zone
concept. So the rule for an omitted `zoneFrom`/`zoneTo` is actually two
different things depending on WHY it's omitted:
- Omitted because the real value genuinely varies across different real
  effects (e.g. `entersBattlefield`'s origin: hand/library/exile/nowhere-
  for-a-token depending on the effect) → same "omitted = unspecified"
  convention `ZoneFact.from` already uses.
- Omitted because the real, definite value IS the Stack → omitted because
  Stack is the one deliberately-invisible zone, not because the value is
  unknown or varies.

`self-enters`'s omitted `zoneFrom` is actually an instance of the SECOND
case for the common path (a normal cast resolves off the stack onto the
battlefield — the real predecessor zone, when there is one, is usually the
Stack) as well as the first (other real entrance effects have other real
non-Stack origins) — either way, correctly omitted, just get the reasoning
right: it is not "unknown among hand/library/whatever," it's "frequently
the invisible zone, and otherwise genuinely effect-dependent."

**`self-cast` reconsidered under the corrected rule — now gets
`zoneFrom: 'Hand'`.** An earlier version of this section concluded
`self-cast` should stay a bare `{event:'cast', target:'self'}` tag with no
zone fields at all. That conclusion was reached under an incomplete
framing (treating the Stack's total absence from the pool's vocabulary as
"casting has no zone data worth tracking on either end," rather than "the
Stack specifically is invisible, but the OTHER end still counts"). Redone:
CR 601 casting is Hand → Stack for the overwhelming common case, and
specifically for Summon: Bahamut (checked `definition.ts` — no alternate
cost, flashback, or foretell-style wrinkle on this card, so its own cast
really does originate in Hand). Hand is a real, trackable, already-used
zone value elsewhere in this model — there's no reason to omit it just
because the OTHER end of this particular movement happens to be the
invisible one. Final shape:
`{event:'cast', zoneFrom:'Hand', target:'self', value:-1}` — `zoneTo`
omitted (the real destination is the Stack, which this rule says to never
assign, not because it's unknown).

Note this is genuinely per-card, not a rule to blindly copy onto every
`cast` fact pool-wide — a card with a real flashback/foretell/alternate-
cost line can originate from Graveyard/Exile/etc. instead, and that would
need checking against its own `definition.ts` before writing `zoneFrom`,
same discipline applied here.

**`destroy-act` re-checked under the same pass and confirmed correctly
unaffected — but for a reason unrelated to the Stack rule.** CR 701.6
destroying is not itself a guaranteed movement the way dying/entering/
casting are: regeneration and indestructible can both prevent the
battlefield-to-graveyard move a destroy effect attempts. `destroy-act`
(the ACT) and the unconditional `dies`-shaped `destroy-nonland` (the
consequence, which DOES carry `zoneFrom`/`zoneTo`) are deliberately
separate facts on this card precisely because destroying, unlike dying,
has no guarantee behind it — giving the ACT fact zone fields would
overstate it as certain when it isn't. Nothing about the Stack rule
changes this; `destroy` doesn't involve the Stack at all.

#### Standing rule: when does an ACT-type EventFact get `zoneFrom`/`zoneTo` inline, vs. stay a bare tag deferring to a separate consequence fact? (2026-09-11, codified from the `self-cast`/`destroy-act` cases above)

An ACT-type EventFact (one representing something a player or effect DOES —
`cast`, `destroy`, `sacrifice`) gets `zoneFrom`/`zoneTo` **inline on
itself** when the zone movement is a **guaranteed, defining part of the
act** — the act cannot occur at all without the movement happening. It
stays a **bare tag, deferring to a separate zone-consequence fact**, when
either of these holds:

1. **The movement is conditional/preventable** — something in the rules
   can make the act happen without the movement actually occurring
   (destroying: indestructible/regeneration can stop the
   battlefield→graveyard move the destroy effect attempts; asserting
   `zoneTo` on the ACT itself would assert something not actually
   guaranteed).
2. **The consequence is independently-matched pool vocabulary in its own
   right** — a real, separate fact (an EventFact like `dies`, or a
   dedicated ZoneFact like `self-graveyard`) already represents that same
   real movement and is matched by real pool cards as its own concept,
   independent of what caused it. Tagging the ACT with the same zone data
   would duplicate, not clarify, what the dedicated consequence fact
   already says.

Once the movement has actually happened — i.e. once we're describing the
**consequence**, not the act that may or may not have caused it — the
consequence fact DOES get `zoneFrom`/`zoneTo` inline, because by the time
a consequence fact like `dies` fires, the movement is unconditionally
guaranteed to have occurred; any conditionality lived upstream, in the ACT
that attempted to cause it, not in the consequence itself.

Worked examples, all real facts on this card:

| Fact | Kind | `zoneFrom`/`zoneTo` inline? | Why |
|---|---|---|---|
| `self-cast` (`event:'cast'`) | ACT | Yes — `zoneFrom:'Hand'` | CR 601.2a: casting unconditionally includes the hand→stack move as its first step; there is no "cast but the card didn't move" case. |
| `destroy-act` (`event:'destroy'`) | ACT | No — bare tag | CR 701.6: indestructible/regeneration can prevent the move outright (reason 1); the guaranteed consequence is separately represented by `dies` anyway (reason 2). |
| `self-sacrifice` (`event:'sacrifice'`) | ACT | No — bare tag | The consequence (battlefield→graveyard) is already separately, independently matched as `self-graveyard` (a ZoneFact, 30+ real pool cards match on graveyard-presence) — reason 2, even though sacrificing itself has no rules-based prevention mechanism the way destroying does. |
| `self-dies`/`destroy-nonland` (`event:'dies'`) | CONSEQUENCE | Yes — both `zoneFrom`/`zoneTo` | CR 700.4: by the time `dies` fires, the battlefield→graveyard move is unconditionally guaranteed to have happened, regardless of whatever upstream act (destroy, sacrifice, lethal damage, etc.) caused it. |
| `self-enters` (`event:'entersBattlefield'`) | CONSEQUENCE | Partial — `zoneTo:'Battlefield'` only | Same "consequence, guaranteed by the time it fires" logic as `dies` for the destination; `zoneFrom` omitted for the separate Stack-invisibility reason above, not because this rule's guaranteed/conditional test fails. |

A future fact should be judged against this table before inventing a new
justification from scratch — is it an ACT (ask: guaranteed movement, or
conditional/separately-matched?) or a CONSEQUENCE (movement already
happened by definition, always eligible)?

**Checked against every EventFact on this card while writing this rule
down — no inconsistency found.** `self-counters` (`putCounter`),
`chapter-iii-draw` (`drawCard`), `chapter-iv-damage` (`damage`) aren't zone
movements of any kind (no `zoneFrom`/`zoneTo` question applies to them at
all, same as `targeted` not applying to every fact either) — correctly
have neither field, for a reason outside this rule's scope entirely.

### `EventFact.targeted` — descriptive-only, never matched (2026-09-11, later same day again)

New optional field distinguishing a real CR 601.2c targeted choice from an
unconditional broadcast, for a fact whose `target`/`recipient` names a real
bucket of more-than-one possible candidate. Motivating pair, both real
fin/1 (Summon: Bahamut) facts, same oracle text ("Destroy up to one target
nonland permanent" vs. "...deals damage... to each opponent") that already
motivated `zoneFrom`/`zoneTo`:
- `destroy-act`/`destroy-nonland` — a genuine choice among legal candidates
  ("up to one target..." — 0 or 1 is a real legal outcome, and real
  targeting restrictions like hexproof/protection/shroud can matter).
  `targeted: true`.
- `chapter-iv-damage` — no choice at all; it unconditionally hits every
  member of the `recipient: 'opp'` bucket ("to EACH opponent"). `targeted:
  false`.

**Convention: only ever written (`true` or explicit `false`) when the axis
is actually meaningful — i.e. `target`/`recipient` names a real bucket of
potential candidates.** Omitted, not `false`, for a fact whose `target` is
simply `'self'` or whose only real "recipient" is the singular `you` —
checked every other EventFact on this card and none of them have a real
bucket-of-candidates to have chosen among or broadcast to in the first
place, so `targeted` doesn't apply to any of them (not merely "not yet
reviewed"):
- `self-cast`, `self-enters`, `self-dies`, `self-sacrifice`,
  `self-counters` — `target: 'self'`, exactly one fixed thing, no choice
  concept at all.
- `chapter-iii-draw` — `controller: 'you'` only, no `target`/`recipient`
  field at all; same "singular, nothing to choose among" reasoning.

Same explicit-boolean-vs-omission distinction `zoneFrom`/`zoneTo` draws
between "genuinely varies" and "known but the invisible zone" — here it's
between "the axis doesn't exist for this fact" (omit) and "the axis
exists and was checked" (`true`/`false`). Don't default every non-`true`
fact to `targeted: false` — that would misrepresent "not applicable" as
"reviewed and confirmed broadcast."

**Purely informational — NOT consulted by `factsInteract`, and NOT added
to `themeOf`** (same treatment as `zoneFrom`/`zoneTo`, which also aren't in
`themeOf` — `themeOf`'s own doc comment scopes it to attributes a fact
*actually constrains* for matching, which `targeted` deliberately isn't).
No sink in the pool wants "only a targeted producer" or "only a broadcast
producer" today. If a real future card needs that as an actual want, wire
it into `factsInteract` deliberately then.

**Served-shape note for the `card` agent**: this field WILL appear in
`GET /api/card/fin/1`'s `functionalModel.synergy` facts (same served
`Fact` shape `zoneFrom`/`zoneTo` already extended) but is purely
informational — no rendering/exposure required yet. If a future card page
feature wants to visually flag "this removal is a real choice" vs. "this
just happens to everyone," this is the field to read; nothing needs to
change on the card side today.

### Aerith's complete fact set

```jsonc
// source
{ "zone": "Battlefield", "controller": "you", "subject": "self" }        // enters
{ "zone": "Graveyard",   "controller": "you", "subject": "self" }        // dies
{ "event": "lifegain",   "controller": "you" }                           // lifelink
{ "event": "putCounter", "counterType": "+1/+1", "target": "self" }      // onLifeGained payoff
{ "event": "putCounter", "counterType": "+1/+1", "controller": "you",
  "target": { "types": { "has": ["Creature", "Legendary"] } } }          // dies payoff

// sink
{ "event": "lifegain",   "controller": "you" }                           // onLifeGained trigger
{ "event": "dies",       "target": "self" }                              // onDies trigger
{ "event": "putCounter", "counterType": "+1/+1", "target": "self" }      // X = counters on self
{ "zone": "Battlefield", "controller": "you",
  "types": { "has": ["Creature", "Legendary"] } }                        // recipients of dies payoff
```

Observations that generalize:

- **Every trigger condition is a want** for the event that fires it.
- **One trigger decomposes into several independent wants.** Aerith's
  dies trigger yields three (a way to die, counters on self, legendary
  creatures) — each matchable against a different partner card.
- **Self-matches** (`lifegain`, `putCounter +1/+1 self` appear on both
  sides) are first-class output, not a flag — see "Self-interactions"
  below. The visualizer needs them.

## Why facts cannot be derived deterministically from traces

Tried hard to make `factsFor(trace)` produce the above by script. It
cannot, for two distinct reasons:

1. **Read ≠ want (no sign).** A read like `hasSubtype('Legendary')`
   establishes that the card's behaviour is a *function of* legendaries.
   "Pump each legendary" and "destroy each legendary" log identical reads.
   Sign is not in the trace.
2. **Filters are only observable relative to the board.** The trace shows
   counters landing on two objects; it does not show *why those two*. In
   Aerith's scenario everything on the board happened to be legendary. A
   black-box population approach (seed a diverse board, see what gets
   touched) recovers the filter only up to the population — a spell that
   hits five specific creature types, or "non-Human", is under-determined
   by any fixed board. Instrumented reads recover the *vocabulary* of the
   filter (which type names were asked about) but the boolean structure
   still needs inference and can be ambiguous.

Both problems exist only because a script cannot read intent. The AI can.
Hence the decision below.

Also considered and set aside: replacing lambdas in `definition.ts` with a
declarative effect schema so facts become a pure function of the
definition. Rejected for now — it is a DSL, a DSL needs an interpreter,
and Forge's own DSL is the cautionary tale. TS lambdas are readable and
executable without a parser; that property is worth keeping.

## Pipeline

```
1. cards/<slug>/definition.ts       definition, Forge → TS          AI   (unchanged)
2. cards/<slug>/scenarios.ts   scenarios                       AI   (unchanged)
3. cards/<slug>/synergy.json   facts, read from definition.ts       AI   (NEW: AI-authored, not derived)
4. run-scenarios → trace.json                                  script (unchanged, harness gains read logging)
5. verify-synergy               reconcile synergy.json ↔ trace  script (NEW)
6. find-synergies               matcher over all synergy.json   script (rewritten for attribute bags)
```

All three AI steps are per-card, offline, and checked by step 5. The
matcher only ever sees `synergy.json`. Card definitions do not change (they
are MTG cards), so "facts go stale" is not a concern — the check catches a
mistranslation, which is the only thing that can change.

## Step 5 — verification (the load-bearing new piece)

Reconcile facts against the trace in **both directions**; fail the card on
anything unexplained:

| declared fact          | must have trace evidence                                          |
|------------------------|---------------------------------------------------------------------|
| want, `event: X`       | a `trigger` for X, or a `read:*` for X, or a with/without diff     |
| want, `zone` + filter  | `read:` of that zone plus reads of the filter's attributes, or a with/without diff |
| produce, `event: X`    | that action in some scenario's log                                |
| produce, `zone`        | the lifecycle line (`enters`, dies → Graveyard)                    |

| trace item             | must be explained by                                              |
|------------------------|---------------------------------------------------------------------|
| every `read:*`         | some declared want                                                |
| every action           | some declared produce                                             |

This is a reconciliation, not a proof of correctness — it cannot confirm a
filter is *exactly* right, but it catches omissions (AI missed a want the
code clearly reads) and fabrications (AI declared a want nothing reads),
which is where an AI reading code actually fails.

**With/without diff.** Aerith's scenarios 2 and 3 differ in one setup axis
(legendary creature present or not) and their traces differ by one
`putCounter`. That *is* the want, demonstrated. Where scenarios come in
such pairs, an empty diff falsifies the declared want. Encourage the AI to
write scenarios in pairs for this reason.

## Harness change — instrumented reads (required)

Today only `getCreaturesInPlay` logs a `read:` line. Every query method a
lambda can branch on must log its **arguments and result**:

```ts
hasSubtype(s: string) {
  log({ fn: 'read:hasSubtype', target: this.name, subtype: s, result: this.subtypes.includes(s) });
  return this.subtypes.includes(s);
}
```

Cover: `hasType`, `hasSubtype`, `getCounters`, `getCMC`, `isTapped`,
`getAttachedTo`, `getEquippedBy`, name comparison, and whatever
`getCardsIn` filters by. Without this, step 5 can only verify source facts;
sink facts go unchecked. This is the one piece of real work the whole design
depends on.

Convention for definition authors: filter via mock methods, not raw string
checks on `typeLine`. A raw check is invisible to the trace.

Aerith's dies trace, before and after:

```
before                          after
trigger onDies                  trigger onDies
read:getCreaturesInPlay you 2   read:getCreaturesInPlay you 2
                                read:getCounters Aerith +1/+1 → 2          (new)
                                read:hasSubtype token-0 Legendary → true   (new)
                                read:hasSubtype Aerith  Legendary → true   (new)
putCounter token-0 +1/+1 2      putCounter token-0 +1/+1 2
putCounter Aerith  +1/+1 2      putCounter Aerith  +1/+1 2
```

## Step 6 — matcher

- **Index** on `zone|event` + `controller` (nearly every fact has both).
  Evaluate remaining constraints within the bucket. Keeps it O(bucket)
  rather than O(source × sink) at 30k cards.
- **Evaluate constraints** against the *producer card's `CardDefinition`*
  for static attributes (`types`, `cmc`, `name`, `power`, `toughness`) and
  against the source fact's own fields for dynamic ones (`counterType`,
  `target` filter). A `subject: { token }` resolves static attributes from
  the token's definition the same way `subject: "self"` does from the
  card's.
- **A sink fact with `target: "self"`** on the consumer side matches a source
  fact whose `target` filter the consumer card satisfies.
- **Self-interactions** are computed as the pair (A, A) like any other,
  then tagged (see below). Never dropped.
- **Theme** = the set of attributes a sink fact constrains
  (`{zone, controller, types}` = type-matters, `{zone, controller, cmc}` =
  mana-value-matters, `{event: lifegain}` = lifegain). Derivable from the
  fact; no labels in the data layer.

## Weighting (ease / strength) — implemented 2026-09-04

The "rarity weighting" parked below is done. Every `Fact` (source AND
sink) carries two mechanically-computed `1|2|3|4|5` fields (`Weight` type,
`functional-model/synergy.ts`):

- **`ease`** (source AND sink) — how many REAL givers/wanters this exact
  fact has, not a string-key shape guess. `matchCountForFact` (exported from
  synergy.ts, reuses the same `factsInteract` predicate `findInteractionsForCard`
  runs at match time, hoisted to module scope so both can share it) counts
  real matches for one fact against the whole pool; the raw counts are
  bucketed by quintile and INVERTED — more real matches = lower `ease`. 1 =
  nearly any card in the pool satisfies it ("permanents on your
  battlefield"), 5 = rare, only a handful of cards give/want it. This is the
  axis that tells "Creature on your battlefield" (specific) apart from
  "permanents on your battlefield" (broad) even though both are the same
  `zone:Battlefield` shape.
- **`strength`** (source only — a sink fact has no magnitude of its own) — real
  game-mechanical magnitude of the effect, read off `trace.json`'s own log
  entries (`createToken.qty`, `putCounter.amount`, `dealDamage.amount`,
  `gainLife`/`loseLife.amount`, simultaneous `destroy`/`sacrifice` count for
  a `dies` source) and bucketed STEEPLY, not linearly: magnitude 1 → 1,
  magnitude 2 → 4, magnitude 3+ → 5. A 2-for-1 effect and a 1-for-1 effect
  are not "close" in power level and the scale says so.
- **`factTotal(fact) = ease * (strength ?? 1)`**, range 1-25 (exported
  helper, also used by `InteractionMatch.theirTotal`). `strength` defaults
  to neutral (1) rather than penalizing a fact that genuinely has no
  magnitude concept (a sink fact, or a source like `grantKeyword`).
- Recomputed for the whole pool via `functional-model/scripts/compute-weights.mjs`
  (`npx vite-node functional-model/scripts/compute-weights.mjs`) — rerun
  this if the pool changes meaningfully rather than trusting stale numbers.
- A separate, purely documentary `sourceText?: string` field also lives on
  every fact — a short quote from the card's own printed oracle text
  explaining what real ability the fact came from (a source/sink pair with
  no visible connection to the card text, like Dion/Bahamut's "wants
  permanents on your battlefield," is otherwise unreadable on the card
  page). Backfilled for FIN #1-50 so far, not the whole set.
- An optional `highlight?: string` field can also live on a fact — the exact
  substring of that fact's own `sourceText` that names it, AI-authored (not
  derived by a generic regex: the same words, "draw a card," e.g., can appear
  more than once on one card under different conditions, so only the author
  reading the real text can say which occurrence is this fact's own).
  `sourceText`/`highlight` are the human-authored SOURCE OF TRUTH a
  reviewer reads/edits — they are not themselves what gets rendered inline
  anymore (see `annotations` below, 2026-09-11).
- **`annotations?: AnnotationRef[]`** (`synergy.ts`, 2026-09-11) — a
  DERIVED, computed-once pointer into the fact's own face's real oracle
  text, baked into the checked-in `synergy.json` by
  `scripts/compute-annotations.mjs` from `sourceText`/`highlight` (same
  indexOf-based matching `annotateOracleText` used to do live). Shape:
  `{ target: 'oracle', line, start, end }` — `line` is 0-indexed within
  that face's own `oracleText.split('\n')`; `start`/`end` are character
  offsets WITHIN that line only (half-open), so a consumer slices via
  `oracleText.split('\n')[line]!.slice(start, end)` with no re-parsing or
  live string search. `target: 'oracle'` is the only value — no other
  target kind is needed yet. An array because one fact could in principle
  point at more than one span, though today's computation only ever
  produces zero or one (derived from a single `highlight` string). A fact
  whose `sourceText`/`highlight` fail to match (same "first match, best
  effort" tolerance as before) just has no `annotations` — still visible in
  the plain facts table, not a hard failure.
  - **Replaces the OLD live-recomputation design**: `annotateOracleText`
    used to rebuild a whole `AnnotatedSegment[][]` tree from
    `sourceText`/`highlight` via live `indexOf` on EVERY server request
    (`server/api/card/[set]/[number].ts`'s `buildAnnotatedCard`). Per the
    user's own framing — "card text won't ever change, so we can attach to
    it specifically" — that computation now happens exactly once, offline,
    and the result is checked-in data. `annotateOracleText`/
    `AnnotatedSegment`/`AnnotatedFactRef` are `@deprecated` in `synergy.ts`
    (left working, not deleted) until the `card` agent finishes migrating
    `FunctionalModelText.vue` and `buildAnnotatedCard` off them — see
    `.claude/contracts/card-schema.md` for the served-shape change
    (`annotatedCard.faces[].oracleText` becomes a plain raw string, no more
    pre-split segment tree) and file-by-file handoff.
  - **Scoped to `cards/summon-bahamut/synergy.json` only so far** (2026-09-11
    task, explicit user instruction) — `scripts/compute-annotations.mjs`
    itself is written to run over the whole pool (`npx vite-node
    functional-model/scripts/compute-annotations.mjs [<slug> ...]`, no args
    = whole pool), but a pool-wide regen is a separate, later decision, not
    done here.
- **Known gap, not fixed here:** both live call sites
  (`server/api/graph-links.ts`, `server/api/card/[set]/[number].ts`) call
  `findInteractionsForCard(name, pool)` with no `tokens` argument, so a
  token-subject produce never resolves real static attributes at match
  time (only `compute-weights.mjs`'s own stored `ease` numbers use real
  token data, via an adapter from `tokens.ts`'s `TokenInfo` shape to
  synergy.ts's `TokenLike` shape).
- **This section predates the `ease`/`strength` → single `value` field
  collapse** (see git history / `Weight`'s own doc comment in synergy.ts) —
  `factTotal` and `compute-weights.mjs` no longer compute two dimensions or
  multiply them together; treat the `ease`/`strength` prose above as
  historical context for WHY `value` is bucketed the way it is, not the
  current mechanism. Not rewritten here to keep this change scoped.
- **`-1` sentinel (2026-09-10):** `Weight` also allows `-1` — a manually
  authored placeholder on a fact that hasn't been through a real
  `compute-weights.mjs` pass yet (distinct from `value` being absent
  entirely, which means the fact predates the weight fields — see
  `factTotal`'s own doc comment for both cases). `factTotal` treats `-1`
  exactly like unset for any arithmetic; the raw JSON still shows `-1`
  rather than collapsing it to `undefined`, so it stays visible as "needs a
  real value" until a `compute-weights.mjs` run resolves it (which it does
  unconditionally, with no special-casing needed — see that script's own
  header comment).

## Tokens

Tokens get their own definitions, in their own folder, in the same shape as
cards:

```ts
// tokens/c_a_treasure_sac/definition.ts
export const treasure: TokenDefinition = {
  slug: 'c_a_treasure_sac',        // Forge's tokenscript slug — used ONLY as the identifier
  name: 'Treasure',
  typeLine: 'Artifact — Treasure',
  colors: [],
  activated: [{
    cost: '{T}, Sacrifice this',
    effects: [{ kind: 'addMana', color: 'any', amount: 1 }],
  }],
};
```

- `TokenDefinition` = `CardDefinition` minus `manaCost`, plus `slug`. Same
  `triggers` / `activated` / `keywords` / `effects` machinery, so a token
  with logic (Treasure, Food, Clue, Blood) runs in the harness like a card
  and gets its own `scenarios.ts` and `synergy.json` via the same AI flow.
- **Forge's `res/tokenscripts/` is source material only.** Its slugs
  (`w_1_1_soldier`, `c_1_1_a_servo`, `c_a_treasure_sac`) are adopted as
  identifiers because card scripts already reference them
  (`TokenScript$ w_1_1_soldier`) and art assets key off them per set. The
  format is not adopted; definitions are local TS. Older Forge scripts use
  inline `TokenName$ / TokenTypes$ / TokenPower$` instead — the AI
  normalizes those to the matching slug, creating the token definition if
  it does not exist yet. The `tokens/` folder grows on demand; do not
  bulk-import Forge's token list.
- A card's `createToken` effect names the slug; its source fact is
  `{ "zone": "Battlefield", "controller": "you", "subject": { "token": "<slug>" } }`.
- **No inheritance rule.** A card that makes Treasures does NOT
  automatically acquire the Treasure's mana source fact. If the card's
  scenario taps/sacrifices the token, the trace shows the mana and the AI
  declares that source fact on the card like any other; otherwise the card's
  facts say only that it produces a Treasure, and the Treasure's own facts
  live in `tokens/c_a_treasure_sac/synergy.json`. Card → token → token's
  effect is the multi-hop case (parked); token `synergy.json` files are
  what will make that hop possible later.

## Self-interactions

The pair (A, A) is computed like any other and kept in the output, tagged
with which of three cases it is. The visualizer distinguishes them.

1. **Same instance.** A `target: "self"` sink fact met by the card's own
   `target: "self"` source fact. Aerith's lifelink feeds her own lifegain
   trigger; that trigger puts the counters her dies trigger reads. A
   self-contained engine.
2. **Second copy on the battlefield.** A `zone` sink fact met by the card's own
   `subject: "self"` source fact. Straightforward for non-legendaries (two
   copies of a tribal lord).
3. **Second copy, legendary.** The legend rule puts one copy in the
   graveyard — which *is* dying. Second Aerith → legend rule → the copy
   with counters dies → pumps the new one. A real interaction, not just a
   rule to annotate. The harness already emits `legendRule` in the trace.

Tagging rule: `target: self ↔ target: self` = same instance; anything else
= second copy; if the card is Legendary, a second-copy match also carries
the legend-rule note, and the legend rule itself counts as a source for a
`{ event: "dies", target: "self" }` sink.

## Deliberately parked (all sit on top of this, none change it)

- **Ranking / good-vs-bad providers.** `prefer: { cmc: 'high' }`,
  `repeatable`, `amount` remain unimplemented. Key-rarity (IDF-style)
  weighting is DONE — see "Weighting (ease / strength)" above.
- **Multi-hop chains.** Still single-hop. Depends on weighting first.
- ~~`drawCard` facts.~~ DONE (2026-09-05, Elrond, Moon-Reader) — `event: 'drawCard'` is a real, verified source fact now (verify-synergy.mjs's `producedEvent`), same as lifegain/lifeloss.
- **Set-level output / archetypes.** Enabler/payoff/engine classification
  by degree; community detection on the card projection → archetypes
  emerge as clusters, labelled by hand afterwards. Fits the no-judgment
  rule.
- **The 3 remaining false-positive cards** (Delivery Moogle, From Father to
  Son, Magitek Infantry) — resolved by construction under the new model:
  the AI reads the real filter from the lambda (`name: { eq }`, artifact
  type) and instrumented reads verify it.
- **Bahamut.** As a binary want, "total mana value of other permanents" is
  just `{ zone: Battlefield, controller: you }`. The sum only matters for
  ranking. No function needed.

## Removed from the design

- `synergy-manual.ts` / `computedWants` / `check()` — no card needs it
  under the attribute model. Escape hatch remains possible (`check.ts` per
  card) but is not part of the design.
- `staticFactsFor(card)` — its job (disproving trace-derived false sink facts)
  is subsumed by AI-authored facts plus verification.
- Additive typed keys (`zone:Graveyard:Creature:you` alongside
  `zone:Graveyard:you`) — types are now attributes resolved from the
  definition, not key segments.
- `flat-trace.json` and `pool.json` (`flatten-traces.mjs`,
  `pool-traces.mjs`) — they existed so `factsFor` could scan one stream per
  card / per pool. No consumer now. Verification is per scenario by nature:
  with/without diffs need scenario boundaries, and "unexplained read"
  reports are more useful against a named scenario. Keep `trace.json` only.
- Scryfall as a runtime source — static card data comes from the
  `CardDefinition`. Scryfall may still seed definition fields (colours,
  rarity) at authoring time.

## Where the code lives / will live

- `functional-model/harness.ts` — add read logging to every mock query
  method (see above).
- `functional-model/synergy.ts` — `factsFor`/`staticFactsFor` retired;
  replace with constraint evaluator + `findInteractionsForCard` over
  attribute bags.
- `functional-model/scripts/verify-synergy.mjs` — new; step 5.
- `functional-model/scripts/find-synergies.mjs` — rewrite for indexed
  attribute matching.
- `functional-model/tokens/<forge-slug>/` — new; `definition.ts`,
  `scenarios.ts`, `trace.json`, `synergy.json`, same layout as cards.
- `functional-model/scripts/flatten-traces.mjs`, `pool-traces.mjs` — delete.
- `functional-model/cards/<slug>/synergy.json` — now AI-authored, still
  tracked in git, still regenerable (by re-prompting), never hand-edited
  by humans.

---

## Implementation notes (this pass)

Everything above is the design as handed off; this section records what
actually happened implementing it, and what's still open — see the git
history / PR this file ships with for the concrete diff.

- **Built, working, verified end-to-end**: `harness.ts`'s read logging
  (every query method `card.ts`'s lambdas can branch on, plus `sacrifice`'s
  own candidate-type filtering, which used to bypass the logged Card
  interface entirely — a real gap this pass closed alongside the
  originally-scoped work); `synergy.ts`'s v2 fact model, constraint
  evaluator, and `findInteractionsForCard` matcher (self-interaction
  tagging included); `scripts/verify-synergy.mjs` (step 5); a rewritten
  `scripts/find-synergies.mjs` (step 6). 16 cards were hand-authored and
  verified as a working proof: `aerith-gainsborough` (the worked example
  above, reproduced exactly), `fight-on`, `gaius-van-baelsar`, `hecteyes`,
  `jecht-reluctant-guardian-braska-s-final-aeon`, `kain-traitorous-dragoon`,
  `malboro`, `namazu-trader`, `ninja-s-blades`, `overkill`, `phantom-train`,
  `the-final-days`, `warren-elder`, `a-realm-reborn`, `summon-bahamut`
  (its old `synergy-manual.ts` deleted — the Mega Flare want resolved
  exactly as this doc's own "Bahamut" section says), and `magitek-infantry`
  (one of the three false-positive cards this doc calls out — see below).
  `scripts/flatten-traces.mjs`, `pool-traces.mjs`, `functional-model/pool.json`,
  every `cards/<slug>/flat-trace.json`, and the now-obsolete
  `scripts/derive-synergy.mjs` (its whole job — precompiling from a trace —
  no longer exists under this design) were all deleted.

- **Real bugs the verification step actually caught**, i.e. the mechanism
  doing its job: (1) `overkill`'s own effect sets a target's toughness to
  -9999 but never calls a real destroy/SBA check (its own trace comment
  already said so) — an initial `{event:'dies'}` produce fact for it had
  zero trace evidence and was removed; (2) an omitted `subject` on a
  produce fact (Gaius van Baelsar's own "each player sacrifices a
  creature" — the thing landing in the graveyard is whichever creature got
  sacrificed, not Gaius himself) was defaulting to the producer's own
  static attrs in the matcher, exactly like explicit `subject: "self"` —
  wrongly making Gaius satisfy a type-constrained want just by existing.
  Fixed: an omitted `subject` now resolves to "unknown," matching only an
  unconstrained want, same as a `{token}` subject the token registry
  doesn't recognize yet.

- **294 of 298 cards in the pool remain on the OLD string-key
  `synergy.json` shape** (or an empty `{source:[],sink:[]}` a since-
  deleted `derive-synergy.mjs` run left behind) — the 16 above are a
  working proof of the pipeline, not a completed migration. Both
  `verify-synergy.mjs` and `find-synergies.mjs` detect the old shape (or an
  all-empty file, which is valid under either schema and therefore never
  silently treated as "verified empty") and skip it with a message rather
  than crashing or fabricating a result — the remaining cards need the same
  AI-authoring pass this design always called for, at whatever scale that
  takes.

- **`tokens/` was scaffolded, not populated** — the folder convention
  exists (see `functional-model/tokens/README.md`) but no real token
  definitions were authored (Treasure/Horror/etc.), per this doc's own "the
  tokens/ folder grows on demand; do not bulk-import." A `{token}`-subject
  produce fact (`kain-traitorous-dragoon`'s and `namazu-trader`'s own
  Treasure, `the-final-days`'s own Horror) is authored correctly but can
  currently only satisfy an *unconstrained* want, since there's no token
  definition yet for the matcher to resolve type/P/T attributes from.

- **A pre-existing, unrelated app-layer break, not caused by this design
  but exposed by following it literally**: `server/api/card/[set]/[number].ts`
  reads each card's `flat-trace.json` in TWO places — `loadFunctionalModelPool()`
  (builds the `PoolCard[]` the Interactions panel's own
  `findInteractionsForCard` join uses) and `loadFunctionalModel()` (the
  card page's whole functional-model comparison panel: source `definition.ts`
  text, the facts table `app/components/TraceViewer.vue` renders, AND the
  raw per-scenario `trace.json` view — all three, since that function
  wraps them in one shared `try`/`catch` and returns `null` for all of them
  together on any failure). None of this was accounted for by this doc's
  own "no consumer now" claim (in "Removed from the design," above).
  Deleting every `flat-trace.json` degrades gracefully (no crash — both
  call sites already tolerate a missing file and return
  empty/`null`) but it goes dark app-wide: EVERY card's functional-model
  panel (not just Interactions) disappears from the card detail page until
  that route is rewired to read `trace.json` directly (for the
  source/trace views) and the new per-card `synergy.json` through the new
  matcher API (for Interactions) instead. Left untouched deliberately —
  out of scope for a `functional-model/`-only pass — and flagged here in
  full so it isn't mistaken for a small, contained regression.

- **Two vocabulary calls made under real-card pressure, not specified
  above**: `event: 'lifeloss'` (the direct counterpart to `lifegain`,
  needed by `kain-traitorous-dragoon`/`namazu-trader`'s own life payments)
  and treating `sacrifice`/`destroy`/`legendRule` as producing BOTH a
  `zone: 'Graveyard'` fact and an `event: 'dies'` fact (the same action,
  described two ways — needed so `jecht-reluctant-guardian-braska-s-final-aeon`'s
  own forced-sacrifice edict and `summon-bahamut`'s own destroy effect can
  satisfy `aerith-gainsborough`'s `{event:'dies', target:'self'}` want).
  Both are small, load-bearing extensions verify-synergy.mjs already
  checks against, not speculative additions.

- **`magitek-infantry`'s own name-comparison tutor** (`c.getName() ===
  ctx.self.getName()`, the case this doc's own "3 remaining false-positive
  cards" section calls out) is authored as a `{ name: { eq: 'Magitek
  Infantry' } }` want, but `harness.ts` deliberately does NOT log a generic
  `read:getName()` for every call (it's used constantly just to LABEL
  other log entries — e.g. every `target: target.getName()` field already
  in this file — so instrumenting it blanket-style would spam every trace
  and double-count existing evidence). The want's `zone: 'Library'` half is
  real, verified evidence (`read:getCardsIn` on Library); the specific
  name-equality half of the filter isn't independently instrumented.
  `magitek-infantry`'s own `scenarios.ts` also has no scenario where the
  tutor actually SUCCEEDS (both existing scenarios hit the "not found"
  branch) — a real, flagged scenario-coverage gap, not hidden.

- **Follow-up pass, same day**: FIN collector numbers 1-50 migrated to v2
  (61 of 298 cards now, up from the original 16 — see this doc's own
  `git log` for which batch did which). Two gaps this batch's authors hit
  in `verify-synergy.mjs` itself, now fixed: `TRIGGER_EVENT_MAP` was
  missing `onOtherPermanentsDie` (blocked `g-raha-tia`'s real want —
  mapped to `'dies'`, same as `onDies`); and `producedZone`'s `moveTo`
  case hardcoded `side: 'you'` regardless of the actual target, which
  would hard-fail a genuine `controller: 'opp'` exile produce (blocked
  `venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal` and
  `white-auracite`, both of which exile an opponent's permanent) — fixed
  to resolve the real side via `sideOfName(entry.target, cardName)`, the
  same helper the `destroy` case already used. All three cards' own
  `synergy.json` still carry the workarounds their authors chose (an
  empty fact set for `g-raha-tia`, an omitted `controller` for the other
  two) — the script fix doesn't retroactively tighten them; that's a
  follow-up re-author, not done here.

- **`functional-model/cards/<slug>/index.ts` renamed to `definition.ts`**
  across all 298 folders (plus every `scenarios.ts` import and every
  script/doc reference) — clearer name for what the file actually is.
  Same day, **`functional-model/tokens/` (this doc's own token-folder
  convention, scaffolded above) renamed to `token-cards/`** — it collided
  with the pre-existing `functional-model/tokens.ts` file (a flat
  static-token registry predating this design), which every card's own
  `definition.ts` importing it did extensionlessly (`from '../../tokens'`).
  The rename alone wasn't the full fix: extensionless `.ts` imports are
  only resolved by a bundler-aware loader (vite-node; Nitro's own static
  imports) — plain Node's ESM resolver never guesses a `.ts` extension for
  a bare specifier, so a *dynamically constructed* `import()` built from a
  template string (e.g. a Nitro server route loading an arbitrary card's
  `definition.ts` at request time, or this repo's scripts run with plain
  `node` instead of the README's documented `npx vite-node`) fails
  regardless of the folder rename. Fixed at the root: all 37 affected
  `definition.ts` files now import `'../../tokens.ts'` with the explicit
  extension, which Node's native TypeScript support resolves directly —
  confirmed working under both plain `node` and `vite-node`. `npx
  vite-node` remains this project's documented way to run these scripts
  (see README), just no longer load-bearing for this specific import. See
  `functional-model/token-cards/README.md` for the naming rationale.

- **FIN 51-150 migrated (141 of 298 cards now v2)**. Surfaced five more
  `TRIGGER_EVENT_MAP` gaps at this scale, all now fixed:
  `onOpponentCreatureDies`/`onCreatureSacrificed` → `'dies'`; `onScry` →
  `'scry'`, `onSurveil` → `'surveil'` (new vocabulary — `matoya-archon-elder`
  is the first card to want either, no producer exists yet, matching the
  design's own "grow only when a real card forces it"); and
  `onGraveyardCardsLeave` → `'graveyardLeaves'` (the one case where the
  trigger's own name and its synergy.json event name genuinely differ,
  not a naming-convention slip — the map's whole job). Before this fix all
  four cards' wants passed only via the loose scenario-diff fallback, not
  real trigger evidence — worth knowing if a card ever has only one such
  trigger and no diff-pair scenario, which would have silently
  under-verified. `sahagin`'s `onNoncreatureSpellCast` and `rook-turret`'s
  `onArtifactEnters` are left unmapped on purpose — both cards' own
  `synergy.json` declares no want using them yet (`wants: []`), so nothing
  is currently unverified; add the mapping when a card actually declares
  the want, not before. One real v1-era data bug also caught and fixed in
  passing: `summon-primal-odin`'s old fact had its Gungnir-destroy produce
  as `controller: 'you'` (own graveyard) when the trace clearly destroys
  `opp0-creature-token-0`; corrected to `controller: 'opp'` under v2.

- **Full FIN set migration, same day, `TRIGGER_EVENT_MAP` now also has**
  `onLandfall` → `'landfall'` and `onOtherCreatureEnters` →
  `'entersBattlefield'`, same pattern as the earlier five.

- **Real `harness.ts` instrumentation gap found and fixed**: the
  declarative `move` effect's own type filter (`card.ts`'s `case 'move'` →
  `actions.move`) checked `effectiveTypes(c)` directly instead of going
  through `loggingCard`, so a library/hand/graveyard search filtered by
  `land`/`creature`/`artifact` (as opposed to a hand-authored `custom`
  lambda calling `c.isLand()` etc. itself) logged zero `read:*` evidence
  for its own filter — `reach-the-horizon`'s and `loporrit-scout`'s wants
  were correctly authored but genuinely unverifiable until this fixed.
  Same bug shape `sacrifice`'s own `matches` was already fixed for; `move`
  had been missed. Fixed the same way (route through `loggingCard`,
  `switch` on `validType`) and regenerated `trace.json` for the 17 cards
  whose own `move` effect declares a `validType` (the only ones this
  changes anything for). Full pool re-verified clean after: 290 of 298
  cards now v2, 0 hard failures, 8 skipped (folders this migration
  intentionally left out of scope).

- **Full FIN set (298 cards) migration complete**: 290 with real facts, 8
  audited individually and confirmed genuinely empty (parked-action-only
  effects or zero scenario evidence, not missed authoring) —
  ashe-princess-of-dalmasca, blitzball, g-raha-tia, il-mheg-pixie,
  jumbo-cactuar, summon-g-f-cerberus, the-gold-saucer,
  valkyrie-aerial-unit. One real bug caught by spot-checking the UI, fixed
  by the migration's own author: `summon-bahamut`'s destroy trigger reads
  BOTH battlefields (`you` and `opp`) for its target pool but only
  declared a `{zone:Battlefield, controller:you}` want — added the missing
  `controller:opp` half. I spot-checked the other 19 original-batch
  cards for the same "read both sides, declared one" shape (compare each
  card's `read:getCreaturesInPlay`/`getCardsIn`/`getLandsInPlay` `player`
  values against its own zone-wants' `controller`) — only `overkill` and
  `ultima-origin-of-oblivion` read both sides, and both already correctly
  leave `controller` unconstrained rather than picking one side, so
  nothing else needed fixing.

  Nine more trigger names surfaced pool-wide; three were real
  `TRIGGER_EVENT_MAP` gaps (a want existed, verified only via the loose
  scenario-diff fallback) and are now fixed: `onCreatureOrArtifactDies` →
  `'dies'`, `onMutantDies` → `'dies'`, `onOpponentLosesLife` →
  `'lifeloss'`. The other six (`onArtifactEnters`,
  `onCrewedVehicleAttacksFirstCombat`, `onBirdsAttack`,
  `onFirstHumanCreatureCast`, `onDwarfOrEquipmentEnters`,
  `onCastSpellYouDontOwn`, `onScoutsDealCombatDamage`) need no mapping:
  each is either a produce-side trigger (verified via the resulting
  action in `producedEvent`, not the trigger name) or the card declares no
  want using it yet — `TRIGGER_EVENT_MAP` only matters for wants, so
  there's nothing for these to unblock right now.

- **`EventFact.recipient` added (2026-09-10)**, a third vocabulary call
  under real-card pressure alongside the two `Implementation notes` already
  logged above. Every real `event:'damage'` fact in the pool (23/23) had
  `controller` naming the DEALER only — no way to say who the damage goes
  to — while `event:'lifeloss'` already (and inconsistently) uses
  `controller` to name the RECIPIENT. Rather than reconcile the two onto
  one meaning, added a new optional `recipient?: Side` distinct from both
  `controller` (dealer/doer) and `target` (a `Constraints`-shaped permanent
  filter — `dies`/`putCounter`'s own vocabulary, not a bare player side).
  `lifeloss`'s own controller-as-recipient reading is left untouched, as a
  documented special case (`EventFact.controller`'s own doc comment) — not
  retroactively migrated; that would mean re-authoring every existing
  `lifeloss` fact in the pool, out of scope for this fix. Only
  `cards/summon-bahamut/synergy.json`'s own Mega Flare damage fact
  (`chapter-iv-damage`) declares `recipient` so far (`recipient: 'opp'` —
  "deals damage ... to each opponent"); every other card's damage fact is
  untouched, per explicit fin/1-only scope. `describeFact` gained a
  dedicated `damage` branch (previously generic-fallback) that renders
  `"your damage"` unchanged when `recipient` is omitted, `"your damage to
  the opponent"`/`"...to you"`/`"...to either player"` when declared.
  `scripts/verify-synergy.mjs` does not check `recipient` (only `event`/
  `counterType`/`controller` against trace evidence) — inert to
  verification, confirmed 0 new hard failures. `app/lib/factConditions.ts`
  (card-owned) does not yet know about `damage`'s new named branch or
  `recipient` — flagged to the `card` agent, not fixed here (out of lane).
  (Note, 2026-09-11: `describeFact`'s own `damage` branch was later
  simplified to a fully bare label — see synergy.ts's own doc comment on
  `describeFact` — so the "named branch" wording above is now stale; not
  rewritten here, out of scope for this entry.)

- **SOURCE `ZoneFact` reworked into an explicit zone-CHANGE shape
  (`to`/`from`), replacing bare presence-style `zone` on the source side
  only (2026-09-11)** — see "The fact model" above for the full rule.
  Motivation: a SOURCE zone fact's bare `zone` used to render as generic
  "battlefield presence"/"graveyard presence" labels that said nothing
  about the actual event the card causes; "presence" is really just the
  observable CONSEQUENCE of a zone change (something is present on the
  battlefield because it entered; something is present in a graveyard
  because it died), so the change itself — not the resulting presence —
  is now the authored fact. SINK facts are unaffected on purpose (a board-
  state want like "you control a creature" as a casting/targeting
  requirement is not a movement — forcing a synthetic `from` onto it would
  invent a zone change that never happened).
  - `synergy.ts`: `ZoneFact.zone` is now optional (SINK-only, or a
    pre-rework SOURCE fact not yet migrated); added `to?: string`
    (SOURCE — the destination zone) and `from?: string` (SOURCE, optional
    — the origin zone, omitted for "unknown/could be anywhere"). New
    `effectiveZone()` choke point (`fact.zone ?? fact.to`) used everywhere
    a zone fact's "what zone is this really about" question is asked
    (`isZoneFact`, `factsInteract`, `factKind`, `describeFact`) so a
    pre-rework bare-`zone` source fact keeps matching/rendering exactly as
    before — no pool-wide migration was required for this change to be
    safe. `factsInteract`'s own zone-vs-zone branch compares a SOURCE
    fact's `to` (or legacy `zone`) against a SINK fact's `zone` — `from`
    is deliberately NOT part of that comparison, which is exactly the
    "match on `to` alone, ignore origin" behavior this rework's own task
    brief asked for.
  - New exported vocabulary — data, not just control flow, so a `card`-
    agent consumer can read it directly instead of re-deriving it:
    `ZONE_MOVEMENT_NAMES` (a small, deliberately narrow `{from?, to, name}`
    table — grow only when a real card's own fact needs a movement not
    already named, same discipline `TypeConstraint`'s own vocabulary
    follows) and `zoneMovementName(from, to)` (the lookup over that table).
    Two entries seeded, exactly what Summon: Bahamut's own facts need:
    `to: 'Battlefield'` (any/unspecified `from`) → `"enters the
    battlefield"`; `from: 'Battlefield', to: 'Graveyard'` → `"dies"` (CR
    700.4 — battlefield → graveyard is dying regardless of cause,
    including sacrifice; since a `ZoneFact` always describes a persistent
    OBJECT, nothing else needs to disambiguate this from a nonpermanent
    card merely entering a graveyard some other way — that path never has
    `from: 'Battlefield'` in the first place). `describeFact` calls this
    lookup for any SOURCE zone fact declaring `to`/`from`, falling back to
    the unchanged bare "<zone> presence" phrasing when the pair isn't
    (yet) named.
  - `cards/summon-bahamut/synergy.json`: converted its two SOURCE zone
    facts — `self-battlefield` (`zone: 'Battlefield'` → `to: 'Battlefield'`,
    now renders "enters the battlefield") and `self-sacrifice-graveyard`
    (`zone: 'Graveyard'` → `from: 'Battlefield', to: 'Graveyard'`, now
    renders "dies"). Its two SINK zone facts (`mega-flare-you`/
    `mega-flare-opp`, plain Battlefield-presence wants) are untouched, per
    this rework's own source-only scope. No other card converted — a full
    pool-wide SOURCE-`zone`-fact migration is a separate, larger sweep,
    left undone (flagged, not silently assumed out of scope).
  - `scripts/verify-synergy.mjs`, `scripts/find-synergies.mjs`,
    `scripts/compute-weights.mjs`: each had its own local `isV2Shaped`
    (now all three additionally accept `'to' in f || 'from' in f`, not
    just `'zone' in f`) and, in `verify-synergy.mjs`/`compute-weights.mjs`,
    a `'zone' in p`-gated branch reading `p.zone` directly for a SOURCE
    fact's own forward/reverse trace-evidence check — all switched to the
    same `effectiveZone`-style `p.to ?? p.zone` fallback so a rework-shaped
    fact gets real evidence-checked exactly like a legacy one did (`from`
    itself is not independently re-verified against the trace — same
    "verify the destination, not every documented detail" scope these
    checks already had for `controller`/`subject`). Without this fix, a
    converted fact would have silently fallen through to the WRONG branch
    (the event-fact evidence path, which reads `p.event` — undefined on a
    zone fact — and would have hard-failed verification) or been excluded
    from the pool entirely as "not v2-shaped."
  - Verified: `npx vitest run functional-model` — 216/216, no test
    changes needed (every existing `describeFact`/`factsInteract` test
    exercises a SOURCE fact via the `zf()` fixture's own bare-`zone`
    shape, which is exactly the backward-compatible path this rework
    preserves byte-for-byte). `npx vite-node
    functional-model/scripts/verify-synergy.mjs` — summon-bahamut: 0 hard
    failures (same pre-existing `tapForMana` soft notes only); full pool:
    313 checked, 1 hard failure, same pre-existing `auron-s-inspiration`
    (an unrelated Exile-zone gap) as every prior pass. `npx tsc --noEmit
    -p functional-model/tsconfig.json`: 50 errors before and after,
    confirmed identical set (all pre-existing, unrelated `synergy.test.ts`/
    card `definition.ts` issues). Real regenerated labels, via
    `find-synergies.mjs` against the actual authored fact objects (not
    hand-typed): `self-battlefield` → every match now reads "enters the
    battlefield" instead of "battlefield presence"; `self-sacrifice-
    graveyard` → every match now reads "dies" instead of "graveyard
    presence" — same set of matched cards before and after (isolated via
    a scoped `git stash push -- <these files>` A/B, not just reasoned
    about), confirming the matching-logic change is label-only, not a
    behavior change.
  - **Not done, flagged rather than silently skipped**: a full pool-wide
    migration of every other card's own SOURCE `zone` fact to the new
    `to`/`from` shape — this is a real, separate authoring sweep (each
    fact needs a human/AI judgment call on what its real origin zone is,
    same as any other fact authorship), not a mechanical rename, and out
    of this task's explicit scope ("don't invent semantics beyond what's
    needed for Summon: Bahamut and whatever other FIN cards are in the
    current uncommitted diff"). The backward-compatible `effectiveZone`
    fallback means no other card's behavior regressed by leaving this
    undone.
  - **Card-agent-facing, not done here (out of lane)**: the Facts tab's
    own rendering (labels, notes/conditions column, any `from`/`to`
    display) still needs updating to actually show `from`/`to` where
    useful — `zoneMovementName`/`ZONE_MOVEMENT_NAMES` are exported
    specifically so that work doesn't need to re-derive the movement-name
    mapping independently, per this rework's own task brief.
  - **Open Forge-verification**: none needed — this is a synergy fact
    schema/label-derivation change (a data-model rework plus one
    reconciliation-tooling fix), not new engine mechanics; the CR 700.4
    "dies" citation is a rules-vocabulary justification for the derived
    label mapping, not a claim about `harness.ts`'s own execution
    behavior, which is untouched.
  - **Correction (2026-09-11, later same day)**: `self-battlefield`'s own
    conversion above was WRONG and has been reverted (`to: 'Battlefield'`
    → back to `zone: 'Battlefield'`). That fact was never a zone-change
    movement in the first place — its `sourceText`/`highlight` are about
    Flying, i.e. it exists purely so some OTHER card's sink ("you control
    a flying creature") can match this permanent's ongoing
    presence-with-Flying; it only had `to`/`from`-eligible shape because
    it mechanically LOOKED like a Battlefield-zone source fact, not
    because it describes an arrival. Forcing it through the from/to
    movement lens made it collide, on the Facts tab, with the genuine ETB
    fact (`self-enters`, `event: 'entersBattlefield'`) — both rendered
    "enters the battlefield". This is exactly the false-positive this
    rework's own SINK-side scope note (above: "a board-state want ... is
    not a movement — forcing a synthetic `from` onto it would invent a
    zone change that never happened") already warned about for sinks —
    turns out a SOURCE fact can be the same kind of non-movement
    presence-only claim too, this rework just hadn't hit a real example
    yet. `self-sacrifice-graveyard`'s own conversion (`from: 'Battlefield',
    to: 'Graveyard'` → "dies") is unaffected and stays correct — sacrifice
    really is a zone-change event, unlike Flying-while-on-the-battlefield.
    Swept the rest of the pool for the same mechanical mistake
    (`grep '"to": "Battlefield"' cards/*/synergy.json`): summon-bahamut
    was the only card with any SOURCE `to`/`from` fact at all (per this
    rework's own explicitly narrow scope above — no other card was ever
    migrated), so there was nothing else to fix. Re-verified:
    `npx vitest run functional-model` 224/225 (the 1 failure is the
    separately-scoped, pre-existing `scenario-card-names.test.ts`
    fabricated-name check, unrelated to this fix); `verify-synergy.mjs`
    — 313 checked, 1 hard failure, still only the pre-existing unrelated
    `auron-s-inspiration`; real regenerated `describeFact` output on the
    actual fact confirms `self-battlefield` → "battlefield presence" and
    `self-enters` → "enters the battlefield" (no longer identical).
    `trace.json` untouched — it's generated purely from `scenarios.ts`
    execution, independent of `synergy.json`, so no regen was needed for
    a `synergy.json`-only fix.
