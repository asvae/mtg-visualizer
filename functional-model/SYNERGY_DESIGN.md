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

### `event:'pump'` promoted to real vocabulary (2026-09-11, later same day) — a generic, deliberate catch-all for stat-boost effects

User's own framing: "Could be sort of a catch all for all similar effects
without much detail. But we need it. Otherwise fin8 [Auron's Inspiration]
pretty much does nothing." Before this, `pump` sat in `verify-synergy.mjs`'s
own `PARKED_ACTION_FNS` — the trace tooling recognized a real `fn:'pump'`
action but explicitly refused to let any `Fact` claim it as evidence, same
"acknowledged but no vocabulary yet" status `drawCard`/`addMana`/`counter`
each used to have before their own promotions.

**The real engine machinery underneath was already fully built** —
`Effect kind:'pumpAll'|'pumpTarget'|'pumpSelf'`, all wired to a real
`actions.pump`/`state.pump` call (real Forge-cited Layer 7 continuous
effect, `layers.ts`) — this was purely a Fact-vocabulary gap, not an
engine gap, for 3 of the 4 cards below. `event:'pump'` itself is
deliberately GENERIC, per the user's own explicit instruction — a bare
`{event:'pump', target/controller/targeted: <whatever applies>, value}`,
no attempt to encode amount/duration/permanence as sub-fields. `describeFact`
needed no new branch — its existing generic event fallback already renders
a bare `event` string for anything unlisted, so `'pump'` renders as `pump`
for free, exactly the "bare, without much detail" shape asked for.

**Promotion, `verify-synergy.mjs`**:
- Removed `'pump'` from `PARKED_ACTION_FNS`.
- Added `producedEvents`' own `case 'pump': return [{event:'pump', side:
  sideOf(entry, cardName)}]` (same bare-object-name `sideOf` heuristic
  `sacrifice`/`destroy` already use, since `harness.ts`'s own
  `loggingActions.pump` logs a `target` name, not a `player`/`controller`
  field).
- Added `case 'read:getNetPower': return [{event:'pump', side: undefined}]`
  — Adelbert Steiner's own real, LIVE-recalculated layer-7a CDA
  (`effectivePT`/`ptFormula`) has no discrete `pump` ACTION to log at all (a
  CDA is a pure read, recomputed every time P/T is checked, never a
  timestamped delta `state.pump` would create) — its own scenario already
  logs a real `read:getNetPower` line specifically to demonstrate the
  recalculation; treated as equivalent produce evidence, same "a real
  low-level read backs a produce/want it corroborates" reasoning this file
  already establishes for zone/type reads.
- Added `'pump'` to the reverse-check `explainableFns` set (NOT
  `'read:getNetPower'` — every `read:`-prefixed fn is already skipped by
  that loop's own guard, so adding it there would be dead code).
- Added a narrowly-scoped `isAuronsInspirationBroadcastPumpFact` exemption
  (see the Auron writeup below) — the one real "documented engine gap
  blocks ALL possible trace evidence" case this promotion needed to
  tolerate, same class of exemption `isStaticOnlyLand`/`isCoinFlipFact`
  already are, just scoped to one specific card/fact shape rather than a
  structural pattern (matches this file's own `crossroads-village`-scoped
  precedent for a genuinely one-card situation).

**Applied to all 4 real pump-shaped cards found in fin/1-10** (checked all
10 real oracle texts specifically for a stat-boost clause; the other 6 —
Summon: Bahamut, Ultima Origin of Oblivion, Aerith Gainsborough, Aerith
Rescue Mission, Ashe Princess of Dalmasca, Cloud Midgar Mercenary — have
none; Aerith Gainsborough's own `+1/+1 counter` effects are permanent
state via `putCounter`, not pump, confirmed not conflated):

- **Adelbert Steiner** (fin/3) — SOURCE `{event:'pump', target:'self'}`,
  oracle-anchored ("gets +1/+1"). Real evidence: the `read:getNetPower`
  case above (already logged by this card's own scenario).
- **Ambrosia Whiteheart** (fin/6) — SOURCE `{event:'pump', target:'self'}`,
  oracle-anchored ("gets +1/+0", the Landfall reminder-text line). Real
  evidence: a genuine `fn:'pump'` line already in this card's own trace
  (its `onLandfall` trigger's real `kind:'pumpSelf'` effect).
- **Auron's Inspiration** (fin/8) — SOURCE `{event:'pump', target:
  {types:{has:['Creature']}, attacking:true}}`. **CORRECTED same day, later
  still** — the first pass left this deliberately bare (no `target` at
  all), reasoning that no "attacking" predicate/constraint vocabulary
  existed to name that bucket honestly. User's own live spot-check on the
  Facts tab rejected that: the fact must actually SAY "attacking
  creatures," not stay silent about scope — silence isn't the same as
  "correctly unconstrained." Fixed by adding a real, forced
  `Constraints.attacking?: boolean` field (see `synergy.ts`'s own doc
  comment on it — the real, full explanation, not repeated here) —
  `attacking` is
  orthogonal to WHO controls the creature, so `controller`/`recipient`
  correctly stay unset (the real text has no controller restriction,
  applies to BOTH players' attackers); `types:{has:['Creature']}` is ALSO
  included alongside `attacking` because `engine.ts`'s own
  `canAttack`/`declareAttackers` never actually enforce a Creature-type
  check on `GameEngine.attackers` — nothing in this engine's own data
  model guarantees "attacking" implies "typed Creature," so the type
  constraint is real, checked-against-`state.ts` narrowing, not a
  redundant restatement. Oracle-anchored ("get +2/+0", unchanged — same
  sentence, no re-anchor needed). **No real trace evidence is achievable
  at all** — `definition.ts`'s own extensive comment documents why (no
  live attacker-state reaches `card.ts`'s engine-agnostic `Effect`/
  `EffectContext` surface, no cross-player `pumpAll` predicate exists), so
  the effect is an honest, intentional no-op; UNCHANGED by the `attacking`
  addition, since `Constraints.attacking` isn't consulted by
  `satisfiesConstraints` either (same underlying limitation — see its own
  doc comment). Exempted via `isAuronsInspirationBroadcastPumpFact` (doc
  comment updated to reflect the real `attacking` target, not stale
  "generically bare" reasoning) — real fact, real documented gap, tolerated
  exactly the way the user asked.
- **Battle Menu** (fin/9) — SOURCE `{event:'pump', target:{types:{has:
  ['Creature']}}, targeted:true}` (its "Ability" mode, "target creature
  gets +0/+4"), oracle-anchored ("gets +0/+4"). Real evidence: a genuine
  `fn:'pump'` line already in this card's own `abilityMode` scenario
  (targets the opponent's real `w_1_1_cat` token).

**Verified**: `verify-synergy.mjs` on all 4 (scoped) and the full pool — 0
hard failures either way (unchanged from before this task). `find-synergies
.mjs` before/after (isolated to just these 4 facts, not a stale git-HEAD
diff — today's working tree has diverged too far from HEAD across several
concurrent sessions' own migrations for a HEAD-based diff to isolate just
this change cleanly): **zero interaction lines gained or lost** — expected
and correct, since NO sink anywhere in the pool currently wants
`event:'pump'` yet (confirmed, grepped the whole pool). This promotion
makes the vocabulary real and matchable for a FUTURE payoff card to key
off, it doesn't itself create a new match today. `vitest run
functional-model` → 238/238 (unchanged). `tsc --noEmit` → unchanged (45
pre-existing baseline errors).

**Known, expected, LARGE side effect of this promotion, not a regression**:
removing `pump` from `PARKED_ACTION_FNS` means `verify-synergy.mjs`'s own
reverse "explain every action" soft-note check now surfaces a real
`fn:'pump'` trace line with no matching declared fact on roughly 90 other,
still-unmigrated (v1-schema) pool cards that already have a real, wired
`pumpAll`/`pumpTarget`/`pumpSelf` effect (Craterhoof Behemoth, Rinoa
Heartilly, Tifa Lockhart, Gladiolus Amicitia, many more) — these were
previously silently parked/invisible, now they're real, visible, correctly
categorized SOFT notes (never hard failures), same "note, not fail"
treatment every other promotion (`drawCard`, `addMana`) already produced
pool-wide. Not fixed here — genuinely out of scope for this task (scoped
to fin/1-10) — flagged as a real, sizeable future sweep opportunity, same
bucket as the already-noted mana-fact pool-authoring gap.

### Real bug, shared plumbing: `describeFact` let an unnamed real movement fall through to presence phrasing (2026-09-11, later same day)

Standing rule (user's own words): **"there should be no presence in
sources (only in sinks), sources — only zone movements."** The DATA was
already right — a real, migrated SOURCE fact like Ambrosia Whiteheart's
own `{to:'Hand', from:'Battlefield'}` bounce fact genuinely has both a
real `from` and `to` — but `describeFact`'s own rendering had a real bug:
when `zoneMovementName(fact.from, to)` didn't recognize the `(from, to)`
pair (only `{to:'Battlefield'}`/`{from:'Battlefield',to:'Graveyard'}`
existed until now), the code fell all the way through the `if` block to
the generic bare `ZONE_PRESENCE_PHRASE[zone] ?? "${zone} presence"` line
below — presenting a real movement as if it were a bare presence claim
("Hand presence / yours · from battlefield"). Caught live by the user on
that exact fact; almost certainly also affected Cloud, Midgar Mercenary's
and Ashe, Princess of Dalmasca's own Library→Hand facts (confirmed — both
were rendering "hand presence" before this fix).

**Fixed both parts, per the user's own explicit two-part ask:**
1. **New named `ZONE_MOVEMENT_NAMES` entries**, added only because real
   cards need them (same "grow only when forced" discipline the table's
   own doc comment already states) — grepped every migrated card's
   `synergy.json` for real `(from, to)` pairs and checked each against the
   table (see the table's own doc comment for the full list checked):
   - `{from:'Battlefield', to:'Hand', name:'bounce'}` — Ambrosia
     Whiteheart's own fact. (User's own naming call, not my first
     suggestion — "returns to hand" was considered and rejected in favor
     of the shorter, common MTG term.)
   - `{from:'Library', to:'Hand', name:'tutor'}` — shared by BOTH Cloud,
     Midgar Mercenary's real "search your library for an Equipment card...
     put it into your hand" (a genuine full-library tutor) AND Ashe,
     Princess of Dalmasca's real "look at the top five cards of your
     library... put it into your hand" (a genuine top-5 dig, NOT a full
     search — real, meaningfully different mechanisms, checked both
     cards' own real oracle text). `ZONE_MOVEMENT_NAMES` only keys on
     `(from, to)`, not the effect kind, so it structurally can't give
     these two cards distinct names without a bigger table-shape change
     (out of scope here). **Renamed same day, later still, per the user's
     own direct call on fin/7's Facts tab**: originally landed as `found`
     (the honest word chosen at the time specifically to avoid overclaiming
     "searched the whole library" for Ashe's own dig) — user reviewed it
     live and asked for `tutor` instead, so this is now the shared label;
     same underlying reasoning (one honest word covering both real
     mechanisms without over-claiming either one's precision), just a
     different word.
2. **Structural fix to the fallback itself**, not a per-pair patch: inside
   the already-existing "a real (from,to) movement" gate (`fact.role ===
   'source' && (fact.to !== undefined || fact.from !== undefined)`), an
   unnamed pair no longer falls through past the `if` block at all — it
   returns a generic-but-honest `"moves to ${to} (from ${from})"` (or bare
   `"moves to ${to}"` with no known origin) directly, so this holds for any
   FUTURE unnamed movement too, not just the ones given real names today.
   The only fallthrough case within this gate that's still deliberately
   real and unchanged: a `from`-only fact with no `to` at all (self-cast's
   own real destination is the deliberately-invisible Stack) — that still
   falls to the `event`-named branches below, same as before this fix, not
   a presence phrase either.

**Verified pool-wide, not just the 3 named cards**: wrote a scratch check
rendering every SOURCE fact across the whole pool with a real `from`
populated (18 real facts, full pool) — zero render presence-style
("...presence") labels, confirmed clean. Spot-checked the specific labels:
Ambrosia Whiteheart → `bounce`; Cloud, Midgar Mercenary/Ashe, Princess of
Dalmasca → `found` (both); Summon: Bahamut/Aerith Gainsborough/Battle Menu
→ `dies`/`enters the battlefield`/`cast a spell` all unchanged. One
incidental correctness improvement outside the 3 named cards: Battle
Menu's own `{to:'Graveyard', subject:'self'}` fact (no `from` — an
any-origin "ends up in the graveyard" baseline, same shape as `self-cast`/
`self-enters`) used to render "graveyard presence" (a real violation of
the same standing rule) and now correctly renders "moves to graveyard" —
the same structural fix, not a separate patch.

Also fixed `synergy.test.ts`'s own test that had codified the bug
(`describeFact({from:'Hand',to:'Graveyard'})` asserted to equal `'graveyard
presence'`) — rewritten to assert the corrected `'moves to graveyard (from
hand)'`, plus new tests for the `bounce`/`found` named entries.

`vitest run functional-model` → 238/238 (was 236; +2 new tests, 0 broken).
`tsc --noEmit` unchanged (45 pre-existing baseline errors, none touching
this file). `verify-synergy.mjs` unaffected (this is a pure rendering-layer
fix — `describeFact` isn't read by any matching/verification code).

### Real gap: Ultima, Origin of Oblivion's mana-doubling ability had NO facts at all (2026-09-11, later same day)

fin/2's own third oracle-text line — "Whenever you tap a land for {C}, add
an additional {C}." — was migrated (annotations/`to`-shaped sink, etc.)
alongside the rest of this card's ability but this one ability itself was
simply never authored: `synergy.json` had exactly 2 facts, both for the
unrelated Flying-attack/blight-counter ability. Confirmed end-to-end, not
just a fact-authoring gap: `definition.ts` had this ability as pure
descriptive `staticAbilities` text with no `Trigger` at all, and
`scenarios.ts` exercised nothing related to it (its own result string said
so explicitly).

**Fixed for real, not just in `synergy.json`:**
- `definition.ts` gained a real, named `onTapLandForC` trigger —
  `effects: [{ kind: 'addMana', color: 'C', amount: 1 }]` — same
  already-proven-executable `addMana` Effect shape Elvish Archdruid's own
  activated mana ability uses. Like every other named trigger pool-wide
  (`Trigger.on` only ever recognizes `'enter'|'upkeep'|'endStep'` — no card
  in the whole 312-card pool has an auto-firing hook for anything else, per
  that field's own doc comment), this fires manually, not automatically off
  a real "land tapped" event (no such hook exists anywhere in this engine).
- `scenarios.ts` now pilots a real land tap for {C} — a real, already-in-
  project FIN Town land, Adventurer's Inn (its OWN and ONLY static ability
  is the exact "{T}: Add {C}." text this needed, cleanest real fit among
  the pool's several {C}-producing Town lands) — via a throwaway,
  scenario-local `CardDefinition` pairing that one real printed line with
  a real `activationCost`/`effects` (same `permanent`/`card` decoupling
  `activateAbility` already supports), scoped entirely to this file;
  `adventurer-s-inn`'s own `definition.ts` is untouched. `pilotActivate` +
  `pilotResolveTop` logs a real `addMana` line for the land's own {C}, then
  `pilotFireTrigger(..., 'onTapLandForC')` logs a second real `addMana`
  line for Ultima's own additional {C}.
- Two new real facts:
  - **SOURCE** — `{ "event": "addMana", "colors": { "has": ["C"] },
    "controller": "you" }` (Ultima's own additional {C}), oracle-anchored
    at "add an additional {C}".
  - **SINK** — `{ "event": "addMana", "colors": { "has": ["C"] },
    "controller": "you", "types": { "has": ["Land"] } }` (wants a land you
    control that produces {C}), oracle-anchored at "tap a land for {C}".
    The `types` constraint is honest documentation of the real condition
    but is presently **inert for matching** — `factsInteract`'s event-to-
    event branch never reads `types` on either side (only zone-shaped facts
    resolve `types` via `resolveSubject`/`constraintsOf`; see "matching
    deliberately unchanged" caveat on the `Fact` unification above). Same
    self-documenting-only treatment `targeted`/`tapped` already get in that
    branch — flagged here explicitly rather than silently pretending it's a
    real filter.
  - Also added, per a same-day follow-up ask: a `self-cast`
    `{ "event": "cast", "from": "Hand", "target": "self" }` baseline fact
    (Ultima has no alternate-cost text — plain `{5}`, checked — so
    `from: 'Hand'` stands unmodified, same reasoning as Bahamut's own
    `self-cast`), typeLine-anchored at "Creature" (no real oracle-text line
    backs a baseline "cast as a creature spell" claim, same as Bahamut's).
- `verify-synergy.mjs`'s `TRIGGER_EVENT_MAP` gained `onTapLandForC:
  'addMana'` — the first entry mapping a NAMED trigger to the `addMana`
  event shape (every other pool-wide `addMana` fact is the plain
  unrestricted "{T}: Add X." static-text shape `staticManaColorsFor`
  already exempts from evidence entirely; this is the first card whose
  `addMana` fact sits behind an actual triggered ability). Both new facts
  verify clean off the SAME trigger fire (the SOURCE fact via
  `producedEvents`' real `addMana` log-line evidence, the SINK fact via
  this new trigger-evidence mapping) — `verify-synergy ultima-origin-of-
  oblivion`: 0 hard failures, all 5 facts (2 pre-existing + 3 new) now
  carry real annotations.

**Real interactions diff** (`find-synergies.mjs`, full pool, before vs.
after — before = the git-committed old-schema `id`/`sourceText`/`highlight`
2-fact version, after = this fix): **+2 lines**, both new, nothing lost:
- `The Gold Saucer --[mana production]--> Ultima, Origin of Oblivion` — a
  genuinely real, new synergy: The Gold Saucer is the only OTHER card in
  the pool whose own plain "{T}: Add {C}." text was ever turned into a
  real `addMana` fact (Eden Seat of the Sanctum/Capital City/Starting Town/
  Adventurer's Inn's own identical "{T}: Add {C}." lines never got their
  own fact authored at all — a separate, pre-existing, pool-wide authoring
  gap on THOSE cards, out of scope here, not something this task touched).
- `Ultima, Origin of Oblivion (self-interaction: same-instance)` — a KNOWN,
  not-fully-precise side effect of the `types`-inertness limitation just
  above: Ultima's own SOURCE `addMana` fact structurally satisfies its own
  SINK `addMana` fact (same `event`/`colors`/`controller`), because the
  matcher has no way to check "and the thing producing it is a land" for
  an event-shaped fact — Ultima itself isn't a land, so this self-match is
  a real, acknowledged imprecision, not a data error to chase down. Fixing
  it for real means teaching `factsInteract`'s event branch to consult
  `types` the way its zone branch already does — a genuine, non-trivial,
  pool-wide matcher extension (not a single-card fix), so it's documented
  here and left for the same future "full matcher unification" bucket the
  `Fact` merge's own caveat already opened, not patched around ad hoc for
  this one card.

### Known, deliberately parked gap: pump/stat-scaling SOURCE effects have no `Fact` representation (2026-09-11, later same day — doc-only, no data change)

**Partially addressed, later the same day, by `event:'pump'`'s own
promotion (see the dedicated section above) — but that closes a DIFFERENT,
narrower gap than this one.** `event:'pump'` makes "this card's own ability
PERFORMS a stat-boost" a real, matchable ACT (Adelbert Steiner now has one,
via its own `read:getNetPower`-backed evidence). It does NOT touch the gap
this section is actually about, which is still fully open: a `power`/
`toughness` CONSTRAINT elsewhere in the pool (a hypothetical "wants a
creature with power 4+" sink checking Steiner as a candidate) still only
ever reads `CardDefinition.pt` (the printed BASE stat) via
`staticAttrsFor`, never `state.ts`'s own live-recalculated `effectivePT`.
These are two independent claims — "I perform a pump" vs. "my current,
post-pump stats satisfy your numeric filter" — and only the first one has
real vocabulary today. Everything below this note is unchanged/still
accurate.

Surfaced by adelbert-steiner (fin/3)'s own migration, but this is a
**general category gap, not a Steiner-specific one** — flagged broadly per
the user's own framing, not fixed here or scheduled: "the effect is
totally uncovered in facts, which is ok for now... probably at some point
we have to account for that, as some effects require specific
power/toughness and that's also a synergistic direction."

Steiner's own oracle text — "Adelbert Steiner gets +1/+1 for each
Equipment you control" — is a real layer-7a CDA (`ptFormula:
{kind:'addPerEquipmentControlled', ...}`, `card.ts`/`state.ts`'s own
`effectivePT`, live-recalculated from current board state every time P/T
is read, CR 613.1/613.3 — same citations `state.ts`'s own `effectivePT`
doc comment already uses). The SINK half is covered (`wants-equipment` —
Steiner *wanting* Equipment on the battlefield). The SOURCE half —
Steiner's OWN power/toughness varying because of this ability — has no
fact at all, and
**there is no vocabulary in `Constraints`/`Fact` today that could express
one**: an effect like this isn't a zone movement, an event, or a static
type/cmc/name filter — it's "this permanent's own P/T is a live function
of board state," a fourth kind of claim the fact model has never needed
before.

**Checked, not assumed: is base P/T tracked as a fact anywhere today?**
Yes, but only the FIXED PRINTED value, and only implicitly, never
authored on a `Fact` directly — `Constraints.power`/`.toughness`
(`NumConstraint`) already exist and are already matchable (a real, if
rare, sink could declare `power: {min: 4}`), resolved against a
producer's `subject:'self'` via `resolveSubject` →
`staticAttrsFor(card).power`/`.toughness`, which reads straight off
`CardDefinition.pt` (the card's own printed base P/T, e.g. Steiner's own
`[2, 1]`). **This is the base printed stat ONLY — it never consults
`state.ts`'s own `effectivePT` (the live, layer-7a-recalculated number
`ptFormula` produces).** So today, a hypothetical sink like "creature
with power 4+" or "your biggest creature" checking Steiner would only
ever see his printed base power (2), never his real, live, board-
state-dependent power once Equipment is actually attached (3, 4, ...) —
the fact model is blind to the exact thing this card's own ability does.
This isn't unique to CDA formulas either: the same blindness applies to
any other pump source the pool might have (anthem effects, +1/+1-counter
accumulation via `putCounter` facts that already exist as EVENTS but
aren't reflected back into a re-computed P/T for constraint-matching
purposes, etc.) — none of it feeds back into what a `power`/`toughness`
constraint sees.

**Deliberately deferred, not scheduled — same "write it down, don't act"
treatment as `Fact.value`'s own deprioritization note above.** No new
`Constraints`/`Fact` vocabulary was designed or attempted here (e.g. a
hypothetical `producesStatScaling` or `pt: {formula: ...}` fact shape is
NOT proposed, just flagged as the eventual real design question). Revisit
only if a real future task specifically asks for stat-scaling/dynamic-P/T
matching to actually work — until then, a sink filtering on `power`/
`toughness` against any pump-affected creature (Steiner included) should
be understood as reading base printed stats only, a known, accepted
blind spot, not a bug to rediscover.

### `event:'attacks'` and `event:'trigger'` — two brand-new event strings, plus the first-ever use of `entersBattlefield` as a SINK (2026-09-11, later same day)

Confirmed via a whole-pool grep before starting: `attacks`/`trigger` had ZERO
precedent anywhere (neither role), and `entersBattlefield` — a common
SOURCE event — had NEVER once been declared as a SINK. All three landed
across 2 cards, same "grow only when a real card forces it" discipline as
`event:'pump'`'s own promotion.

- **Ashe, Princess of Dalmasca (fin/7)** — SINK `{event:'attacks',
  target:'self'}` for her own "Whenever Ashe attacks" trigger condition.
  Real trace evidence, no scenario change needed: `pilotDeclareAttackers`
  (engine-trace.ts) already logs a real `{fn:'attack', card}` line per
  real declared attacker (508.1); `producedEvents` gained `case 'attack'`
  (scoped to `entry.card === cardName`, stricter than the usual `sideOf`
  heuristic, since this fact is self-referencing) and `'attack'` was added
  to `explainableFns`. `TRIGGER_EVENT_MAP` gained `onAttack: 'attacks'` —
  Ashe's own trace already has a real `{fn:'trigger', name:'onAttack'}`
  bracket right after the real attack, so `verify-synergy.mjs` passes
  clean with zero scenario work. Oracle-anchored ("Ashe attacks").
- **Cloud, Midgar Mercenary (fin/10)** — SINK `{event:'entersBattlefield',
  target:'self'}` for its own "When Cloud enters" trigger condition. Real
  evidence: `TRIGGER_EVENT_MAP` gained `onEnter: 'entersBattlefield'` —
  Cloud's own trace already has a real `{fn:'trigger', name:'onEnter'}`
  bracket (`pilotResolveTop`'s own real 603.6b auto-fire log). Oracle-
  anchored ("Cloud enters").
- **Cloud's own Panharmonicon-style static** ("As long as Cloud is
  equipped, if a triggered ability of Cloud or an Equipment attached to it
  triggers, that ability triggers an additional time" — ENGINE_GAPS.md gap
  #13). User's own explicit split, quoted verbatim: SOURCE (the doubling
  effect itself) — **skipped, "we don't need that I think"**; gap #13
  stays exactly as documented, open, un-actioned. SINK — **added, but only
  the self half**: "a triggered ability of Cloud" — Cloud's own new
  `{event:'trigger', target:'self'}` fact, oracle-anchored to exactly that
  clause. The equipment-attached half ("...or an Equipment attached to
  it") was explicitly scoped OUT by the user's own call ("probably too
  specific, we can probably omit it") — not modeled, not a fact. New
  event name `trigger` chosen to mirror the 1:1 fn-name convention
  `cast`/`sacrifice`/`destroy`/`counter`/`pump` already establish (matches
  the real underlying `{fn:'trigger', ...}` log action directly). Real
  evidence: a NEW, dedicated `readEvidence` branch in `verify-synergy.mjs`
  (not `TRIGGER_EVENT_MAP` — that dictionary maps ONE trigger NAME to ONE
  event, and `'onEnter'` already needs to map to `entersBattlefield` for
  Cloud's OTHER new sink above; "one of THIS card's own triggers fired,
  whichever one" is a different, per-CARD-scoped question, not a
  per-NAME one) — `allEntries.some(e => e.fn === 'trigger' && e.card ===
  cardName)`. Cloud's own real `{fn:'trigger', name:'onEnter', card:'Cloud,
  Midgar Mercenary'}` bracket already satisfies this with zero scenario
  work.

**Verified**: `verify-synergy.mjs` scoped (both cards) and full pool — 0
hard failures either way. One new, expected, honest SOFT note on Ashe
(`trace has attack {...} with no matching declared produce`) — correct:
only the SINK was added for `attacks`, no SOURCE, so the reverse "explain
every action" check correctly flags the real attack action as still
unexplained on the produce side; not a regression, an accurate reflection
of what was (and wasn't) asked for. `vitest run functional-model` →
238/238 unchanged. `tsc --noEmit` → 45 unchanged.

**Real, surprising, IMPORTANT result from the required `find-synergies.mjs`
diff — reported plainly, not silently resolved either way:**
- Ashe's `attacks` sink and Cloud's `trigger` sink: **zero interaction
  lines gained**, exactly as expected — brand-new event strings, nothing
  else in the pool produces either one yet.
- Cloud's `entersBattlefield` sink: **13 new interaction lines gained —
  but NOT the one the fact is actually FOR.** The new sink does not
  self-match Cloud's own `entersBattlefield` SOURCE fact at all — that
  fact is zone-shaped (`to:'Battlefield'`), the new sink is event-shaped
  only (no `to`/`from`), and `factsInteract`'s own shape-family gate
  (`isZoneFact(p) !== isZoneFact(w)`, the same gate documented in the
  `Fact` unification section above) blocks the match outright before the
  event-branch's own same-instance/target logic is ever reached. Instead,
  it spuriously matches 13 UNRELATED, still-v1-schema pool cards whose own
  `entersBattlefield` SOURCE fact has no `target` field at all (Baron
  Airship Kingdom/Crossroads Village/Elrond Moon-Reader/Gohn Town of
  Ruin/Gongaga Reactor Town/Guadosalam Farplane Gateway/Insomnia Crown
  City/Rabanastre Royal City/Sharlayan Nation of Scholars/The Gold
  Saucer/Treno Dark City/Vector Imperial Capital/Windurst Federation
  Center) — `factsInteract`'s own event branch has `if (pe.target ===
  undefined) return true;` for a `we.target === 'self'` want, meaning an
  UNCONSTRAINED producer vacuously satisfies ANY self-referencing want,
  regardless of whose card it actually is. Net effect: this sink currently
  behaves the OPPOSITE of its intended framing — it doesn't recognize
  Cloud's own real entering, but DOES claim 13 unrelated lands'/cards'
  own entering as relevant to Cloud's trigger condition. This is NOT a bug
  introduced by this task — both halves of this behavior are pre-existing,
  already-documented matcher semantics (the shape-family gate from the
  `Fact` unification pass; the `pe.target === undefined` vacuous-match rule
  from the original self-referencing-want design) — but this is the FIRST
  real card to actually exercise `entersBattlefield` as a SINK, so it's the
  first time this particular interaction between the two rules has ever
  produced a visibly wrong result. **Left as-is, not patched ad hoc** —
  flagged here explicitly for a real decision (accept as a known
  imprecision same as `Constraints.attacking`'s own inertness, or invest in
  a real matcher fix) rather than silently working around it or reverting
  the fact.

### CORRECTION, same day, later still: `event:'trigger'` renamed to `event:'triggeredAbility'`, and Cloud's equipment-attached half added back

User reviewed the new Cloud (fin/10) "Trigger · self" row live and reversed
the earlier scoping call from the section above, plus asked for a naming
fix. Two real changes:

1. **The equipment-attached half is back in.** User: "should be 2 rows
   like this (one for self, one for equipment)." Checked `state.ts`'s own
   real attachment tracking first (`RealCard.attachedToId`/
   `getAttachedTo`/`getEquippedBy`, all real, live) before inventing a
   shape — confirmed WHICH Equipment (if any) is attached to a permanent
   is genuinely per-instance runtime state, not a static `CardDefinition`
   property, so a bare `types:{has:['Equipment']}` constraint alone would
   mean "any Equipment card anywhere," not "the one actually attached
   here." Added a new `Constraints.attachedToSelf?: boolean` field
   (`synergy.ts`) — same class/treatment as `Constraints.attacking`: real,
   honest, self-documenting data, NOT consulted by `satisfiesConstraints`
   (no live-state pipeline reaches it). Cloud's new equipment-half fact:
   `{event:'triggeredAbility', target:{types:{has:['Equipment']},
   attachedToSelf:true}}`, oracle-anchored ("an Equipment attached to
   it"). **No possible trace evidence** — even further from evidence than
   the self half, since demonstrating it would need a real attached
   Equipment card that ALSO has its own independent triggered ability
   firing, which no scenario in this pool exercises (and shouldn't be
   fabricated just to manufacture evidence) — same real, documented
   ENGINE_GAPS.md gap #13 as the self half, tolerated via a new, narrowly-
   scoped `isCloudEquipmentTriggeredAbilityFact` exemption in
   `verify-synergy.mjs` (same class as `isAuronsInspirationBroadcastPumpFact`).
2. **`event:'trigger'` renamed to `event:'triggeredAbility'`.** User: "it's
   not just any trigger... maybe makes sense to use Ability instead of
   Trigger." Went with the more specific `triggeredAbility` rather than
   the shorter `ability` — `ability` alone would read as (or collide in
   spirit with) the already-real, DIFFERENT `event:'activateAbility'`
   (602 activated abilities — a genuinely distinct MTG concept from 603
   triggered abilities the way this fact means it). Renamed everywhere:
   both Cloud facts, `verify-synergy.mjs`'s own dedicated `readEvidence`
   branch (now ALSO scoped to `w.target === 'self'` specifically — see
   point 1, the equipment half needed its own separate, evidence-free
   treatment once it existed again), `SYNERGY_DESIGN.md` (this section)
   and agent-memory notes.

**Verified**: both facts re-annotated via `compute-annotations.mjs` (real
spans, no manual placement). `verify-synergy.mjs` scoped (Cloud) + full
pool — 0 hard failures. `find-synergies.mjs` diff, isolated to just the
rename + new fact: **zero interaction lines gained or lost** — expected,
both `triggeredAbility` and `attachedToSelf` are brand-new strings/fields
with nothing else in the pool to match against yet. `vitest run
functional-model` → 238/238 unchanged. `tsc --noEmit` → 45 unchanged. The
`entersBattlefield`-as-sink finding documented in the section above is
UNCHANGED by this correction (unrelated fact, untouched here).

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
- **`Fact.value` accuracy is a KNOWN, DELIBERATELY DEPRIORITIZED
  non-priority right now (2026-09-11, user's own call) — not a bug to
  rediscover.** The Aerith Gainsborough migration + this same day's
  `ZoneFact`/`EventFact` merge left some already-migrated facts'
  `value`s stale/imprecise — most visibly `destroy-nonland` and the
  merged `dies` fact on summon-bahamut (fin/1), whose real magnitude
  changed shape (a merged fact, a reclassified match set) without a
  matching `compute-weights.mjs` re-run. Explicit decision: **don't
  recompute, don't audit `compute-weights.mjs`'s own accuracy, don't
  schedule a scoped fix for this** — "value we don't care for now
  (everything should be -1), we don't also care how it's being
  processed, write it down." No `compute-weights.mjs` run happened as
  part of this note, and none is scheduled. A future task that notices
  `value` looking off on a migrated fact should treat it as this
  already-known, already-accepted gap — re-flagging it as a fresh
  discovery, or unilaterally "fixing" it with a scoped recompute, is
  redundant work this decision already closed off. Revisit only if a
  real future task specifically asks for `value` accuracy work.

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
- **Cloudbound Moogle's Plainscycling, two specific facts (2026-09-11,
  later)**: user reversed the earlier "no fact for Plainscycling" call
  after seeing it live. Added a SINK `{event:'discard', target:'self'}`
  for the discard-as-COST act itself (user's own literal words: "sink for
  discard self") — bare-event self-reference, same shape as `dies`/
  `sacrifice`'s own self-facts, deliberately NOT a zone fact (`to:
  'Graveyard'`) since this is about the payment ACT, not a plain
  Graveyard-presence want. Added a SOURCE `{to:'Hand', from:'Library',
  types:{has:['Plains']}}` tutor fact, same shape/`tutor`
  `ZONE_MOVEMENT_NAMES` label already used by Ashe's/Cloud's own tutor
  facts, scoped precisely to `Plains` (a real basic land subtype), not
  broadened to `Land`. Neither half gets generic TypeCycling engine
  machinery — still a real, documented, unmodeled gap shared with 5+
  other pool cards' own `*cycling` abilities; this is two specific,
  textually-backed facts on one card, not a new keyword system. Zero
  possible trace evidence for either (Plainscycling lives only as
  `staticAbilities` text, never a resolvable `Effect`) — covered by two
  new narrow `verify-synergy.mjs` exemptions
  (`isCloudboundMoogleDiscardSelfWant`/`isCloudboundMoogleTutorFact`),
  same documented-gap-exemption pattern as Auron's Inspiration/Cloud's
  equipment half. `find-synergies.mjs` before/after: 0 lost, +2 gained
  (tutor fact matches Nibelheim Aflame, The Water Crystal); discard-self
  sink gained 0 matches (real gap, no other pool card sources a literal
  `discard` event yet — same "reported, not fabricated" treatment as
  every other zero-evidence want in this file).
- **Self-tap activation-cost fact, generalized (2026-09-11, later)**: any
  activated ability whose own COST includes `{T}` gets a real
  `{event:'tap', subject:'self', target:'self'}` SOURCE fact, kept
  deliberately separate from that same card's own tap-TARGET EFFECT fact
  (Coeurl's `{event:'tap', target:{types:...}}` taps some OTHER creature —
  a distinct occurrence, not conflated). Checked every fin/1-20 card fresh
  against real oracle text: only Coeurl (fin/12, `{1}{W}, {T}: Tap target
  nonenchantment creature.`) and Dion, Bahamut's Dominant (fin/16 front
  face, `{4}{W}{W}, {T}: Exile Dion...`) have a real `{T}` in their own
  activation cost. Direction (SOURCE, not SINK) chosen by analogy to the
  pre-existing `isCostOnlyArtifactSacrificeFact` precedent (a sacrifice-
  as-cost ACT is already modeled as a SOURCE `event:'sacrifice'` fact, not
  a sink) — the cost-PAYMENT act itself is a SOURCE, same as that
  established pattern, in contrast to Cloudbound Moogle's own
  discard-as-cost fact (modeled as a SINK per the user's own direct,
  explicit instruction there). Flagging the real inconsistency between
  the two rather than silently resolving it: discard-as-cost SINK vs.
  sacrifice/tap-as-cost SOURCE are NOT the same shape for the same kind
  of occurrence (both are "this ability's own cost consumes/alters this
  permanent's state") — worth a real decision on which framing is the
  house style going forward, not something this pass unilaterally
  reconciled. Found and fixed a genuine, separate `verify-synergy.mjs`
  false-pass risk while wiring this up: the forward SOURCE-evidence check
  only compares `event` names, with no `subject`/`target`-shape
  distinction, so Coeurl's own tap-TARGET effect's real `fn:'tap'` trace
  line would have silently, WRONGLY also "satisfied" the new self-tap-cost
  fact by bare event-name equality — added a general (not per-card)
  `isSelfTapActivationCostFact` exemption scoped to the exact
  `subject:'self'`/`target:'self'` shape, per `producedEvents`'s own
  `case 'tap'` doc comment confirming `engine.ts`'s `activateAbility` pays
  a `{T}` cost with no log line at all (a real, general engine limitation,
  not per-card — future `{T}`-cost cards get this exemption for free).
  `find-synergies.mjs` before/after (isolated swap, both cards): 0 diff —
  real, documented zero-match gap, no pool card wants `event:'tap',
  target:'self'` yet.
- **Library-presence tutor-precondition sinks restored/added for
  consistency; From Father to Son's Vehicle-vs-Artifact bug fixed
  (2026-09-11, later)**: `ashe-princess-of-dalmasca`'s own "wants an
  artifact card in library" sink (`{to:'Library', controller:'you',
  types:{has:['Artifact']}}`), removed earlier the same day per a direct
  user instruction, was RESTORED after the user saw the fuller
  from-father-to-son/delivery-moogle pattern live and changed their mind —
  a real, deliberate reversal, not relitigated. `cloud-midgar-mercenary`
  got the equivalent new sink for its own tutor, typed `Equipment` (not
  generic `Artifact`) to match both its real oracle text ("search your
  library for an Equipment card") and its own existing tutor SOURCE
  fact's identical filter. Separately, a real correctness bug: From
  Father to Son's real oracle text searches for a Vehicle card
  specifically, but all 3 of its facts used `types:{has:['Artifact']}` —
  Vehicle is a real, distinct Scryfall type-line subtype ("Artifact —
  Vehicle"), not a synonym for generic Artifact; narrowed to
  `types:{has:['Vehicle']}`. `find-synergies.mjs` before/after (isolated
  swap, all 3 cards together): 0 diff — none of these Library-presence
  sinks, nor the overbroad Artifact constraint, had ever produced a real
  match (no pool card sources a card INTO Library at all yet), so this is
  a pure correctness fix with no visible graph-edge change today.
- **Scenario consolidation: `Scenario.sequence` can chain a real cast onto
  a trigger fired mid-scenario, eliminating a redundant boilerplate
  scenario (2026-09-11, later, `dwarven-castle-guard`/`cloudbound-moogle`)**:
  user's own live call on the Scenarios tab, "either one realistic
  scenario, or 0 scenarios" — don't show a separate generic cast/enter
  board next to the card's own real, distinctive scenario. Investigated
  `harness.ts`'s `Scenario` shape rather than assuming the two shapes were
  stuck being separate: `selfZone` only skips straight to "already on the
  battlefield" when a top-level `trigger`/`ability`/`activationCost` is
  set; a scenario with NONE of those runs the real Stack -> cast ->
  resolve -> enters lifecycle, and `sequence` (already-existing machinery,
  built for Summon: Bahamut's own Saga chapters) fires named triggers
  AFTER that lifecycle, against the same shared `GameState`. So a single
  scenario with no top-level `trigger` and `sequence: ['onDies']` (or
  `['onEnter']`) gets BOTH real cast/enters evidence AND the card's own
  real unique-ability evidence, no tradeoff needed — `dwarven-castle-guard`
  went from 2 scenarios (plain cast; separate `trigger:'onDies'`) to 1;
  `cloudbound-moogle` went from 3 (plain cast; two separate `trigger:
  'onEnter'` branches) to 2 (both branches now individually carry real
  cast/enters evidence too, a strict improvement, not just a count
  reduction). `verify-synergy.mjs`'s `DEATH_TRIGGER_NAMES` exemption
  (dwarven-castle-guard's own self-dies fact) doesn't care whether `onDies`
  fired via a top-level `trigger` or mid-`sequence`, only that it fired at
  all — no evidence loss. Checked the rest of the already-migrated
  fin/11-20 batch for the same redundant shape (coeurl, dion-bahamut-s-
  dominant-bahamut-warden-of-light, dragoon-s-lance, crystal-fragments-
  summon-alexander, the-crystal-s-chosen, delivery-moogle, fate-of-the-
  sun-cryst, from-father-to-son) — none have it; every other card's
  scenarios are either all real engine-piloted playthroughs already, or
  each scenario already demonstrates a genuinely distinct real branch with
  no separate plain-cast-only boilerplate alongside it. Scoped to these 2
  cards, not applied as a blanket retroactive sweep.

- **Innate printed keyword modeled via `grantKeyword` vocabulary reuse;
  full engine-piloted consolidation for `dion-bahamut-s-dominant-bahamut-
  warden-of-light` and `crystal-fragments-summon-alexander` (2026-09-11,
  later)**: user overrode the earlier "self-inherent keyword, no
  vocabulary" call on Bahamut, Warden of Light's own printed Flying —
  "face - for sure also source of flying, grant keyword or whatnot." Added
  `{event:'grantKeyword', keyword:'Flying', subject:'self', target:'self'}`,
  reusing the SAME vocabulary `haste-magic`/`circle-of-power` already use
  for a real GRANTED keyword — modeling "this object has flying" the same
  way as "this object grants flying," deliberate and fine (a flying-
  matters payoff doesn't care which). No real trace evidence possible (a
  printed `keywords` array entry is static data, never a real
  `grantKeyword` action call) — new GENERAL (not per-card)
  `verify-synergy.mjs` exemption, `isInnatePrintedKeywordFact`, cross-
  checked against the card's own real declared keywords so it can't wave
  through a fabricated claim. Applied the identical fix to
  `summon-bahamut`'s own identical printed Flying too (flagged by the
  user as worth reconsidering for consistency, judged cheap/mechanical
  enough to just fix in the same pass). `find-synergies.mjs`: 0 diff both
  cards (real, documented zero-match new vocabulary usage).

  Separately, two more cards migrated to full engine-piloted
  `runEngineScenarios()`, mirroring `jill-shiva-s-dominant-shiva-warden-
  of-ice`'s own real single-scenario shape (user: "let's make 1 scenario,
  not 5, similar to fin 58" / "also expecting one scenario here"):
  - `dion-bahamut-s-dominant-bahamut-warden-of-light`: 5 flat scenarios ->
    1 real playthrough (cast -> real ETB Knight token -> real turn
    passage -> real `{4}{W}{W},{T}` transform -> Bahamut's Saga chapters
    over real turns -> chapter III's real Gigaflare destroy, targeting a
    real opponent Coeurl via `preferTarget` instead of the old flat
    scenario's own documented self-destroy modeling-limitation finding ->
    transform back). Needed `on:'enter'` added to the front face's
    `onEnter` trigger (real 603.6b auto-fire, matching Jill's/Cloud's own
    convention) — previously absent since the old flat-scenario style
    never needed it.
  - `crystal-fragments-summon-alexander`: 2 flat scenarios -> 1 real
    playthrough (cast -> real Equipment attachment -> real turn passage ->
    real `{5}{W}{W}` transform -> Summon: Alexander's Saga chapters over
    real turns -> real "Sacrifice after III"). Front face is an EQUIPMENT
    with only ONE activationCost/effects slot, reserved for the transform
    (definition.ts's own documented constraint) — real Equip {1} has no
    modeled `Effect` to pilot at all; checked `engine-trace.ts` for
    existing equip-piloting precedent first (none — no dedicated
    `pilotEquip` helper), used the same manual `state.equip()` +
    hand-pushed `fn:'equip'` log line technique `adelbert-steiner`'s own
    scenario already established for the identical "no modeled ability to
    activate" situation, rather than fabricate a `pilotActivate` call
    against an ability that doesn't exist. Also checked `sba.ts` for a
    real Saga-sacrifice-after-final-chapter rule — none exists anywhere
    (no Saga-specific SBA at all) — matched `harness.ts`'s own
    `sacrificeSelfAfter` mechanism 1:1 (`state.move` to Graveyard + a real
    `fn:'sacrifice'` log line) rather than invent a new one.

  Both consolidations closed a real, previously-relied-on exemption for
  real: the front face's own baseline `self-cast`/`self-enters` facts on
  BOTH cards previously depended on `isActivationCostPermanentBaselineFact`
  (their own old flat-scenario style never actually cast the permanent for
  real) — the new engine-piloted scenarios now produce REAL `fn:'cast'`/
  `fn:'enters'` evidence instead, so that reliance is gone (the exemption
  function itself is untouched/still-needed elsewhere, e.g. Coeurl).
  Checked every OTHER currently-exempted fact on both cards against the
  fuller pilot and confirmed neither closes: `isCrystalFragmentsEquipped
  PumpFact` (no continuous-effect/layer-7c pipeline exists regardless of
  real attachment) and `isSummonAlexanderDamagePreventionFact` (no
  prevention/replacement-effect pipeline exists at all, `state.ts`'s own
  header) are both genuine, structural, engine-wide gaps unaffected by
  better piloting — left in place, not stale.

- **Equipment cards are a general "wants a creature you control on the
  battlefield" SINK — standing rule for future migrations (2026-09-12)**:
  user's own reasoning, live on `crystal-fragments-summon-alexander`:
  "we can reason equipment is a sink for battlefield presence for your
  creature" — ANY real Equipment inherently needs a creature you control
  to equip to, so this is a real, general fact, not flavor-only.
  `dragoon-s-lance` (fin/17) already had this exact shape
  (`{to:'Battlefield', controller:'you', types:{has:['Creature']}}`,
  oracle-anchored on its own "Equip {N}" line) — added the identical
  fact to `crystal-fragments-summon-alexander`'s own front face.
  `find-synergies.mjs`: 0 lost, ~100 gained (every unconstrained-
  creature-presence producer in the pool). **Standing rule for future
  migrations**: every real Equipment card (`typeLine` includes
  `Equipment`, has a real printed "Equip {N}" line) should get this same
  sink by default, not as a special case per card — NOT swept pool-wide
  in this pass (out of scope), but the next card touched that has this
  shape should get it without re-litigating whether it's warranted.
- **`describeFact`'s generic bare-event fallback returned raw camelCase
  for real, unhandled multi-word event strings (2026-09-12, real bug)**:
  user caught `event:'preventDamage'` rendering literally as
  "PreventDamage" (the card page's own `first-letter:uppercase` CSS only
  capitalizes the first letter, never inserts word-boundary spaces).
  Added explicit bare-label branches, same convention as every other
  `if (event === ...)` branch above the fallback: `preventDamage` ->
  "prevent damage" (Summon: Alexander's own chapters I/II — deliberately
  generic, same "unlikely to be synergistic, but good to highlight
  regardless" spirit as `pump`'s own promotion, no richer vocabulary
  built out). Grepped the whole pool for every OTHER real camelCase event
  string that would hit the same generic fallback (the doc comment's own
  named examples: `castCreatureSpell`/`castNoncreatureSpell`/
  `graveyardLeaves`) — `castCreatureSpell` is real (champions-of-the-
  perfect, fang-fearless-l-cie), fixed the same way -> "cast a creature
  spell"; `castNoncreatureSpell`/`graveyardLeaves` have zero real pool
  instances (checked), left unfixed per "fix real instances, not
  hypothetical ones." No data changes to any card — this is a shared
  `synergy.ts` rendering fix, so no card's own `progress.json`/`review`
  flag needed touching for the two sibling cards that merely benefit from
  the fix.

- **CORRECTION (2026-09-12): reversal on innate printed keywords — no Fact
  needed at all, not even via vocabulary reuse.** User's own correction to
  the entry just above: "Not needed for keywords on card. That would be
  parsed directly - we don't need facts for that." Removed the self-only
  `{event:'grantKeyword', keyword:'Flying', subject:'self', target:'self'}`
  facts from both `summon-bahamut` and `dion-bahamut-s-dominant-bahamut-
  warden-of-light`'s back face, and the now-unused `isInnatePrintedKeyword
  Fact` verify-synergy.mjs exemption (checked: nothing else used it).
  **Standing rule for future migrations**: a card's own bare printed
  keyword, with no grant/broadcast to anything else involved, is already
  structured, directly-parseable data (`CardDefinition.keywords`/
  `backFace.keywords`) — it is NOT synergy-relevant occurrence data and
  never needs a `Fact` (of any shape) to represent it. This is narrower
  than it first sounds: it does NOT cover a keyword being GRANTED — to
  self via a real resolved effect, or broadcast to other permanents — both
  of those remain real, Fact-worthy vocabulary (`haste-magic`'s/`circle-
  of-power`'s own real granted-keyword facts, and Dion's own "Dragonfire
  Dive"/Bahamut's own "Wings of Light" broadcasts, both still real and in
  scope — see ENGINE_GAPS.md gap #14's own resolution).

  **Exception carved out same day, later (2026-09-12): printed Lifelink is
  NOT covered by the rule above.** User's own real insight, looking at
  Minwu, White Mage (fin/26) live: "Lifelink always means card is life
  gain source." The bare-printed-keyword rule assumed every keyword is
  either self-inherent-and-silent (Flying/Vigilance/Reach/Indestructible —
  purely passive, no-event, nothing OBSERVABLE happens just because a
  creature has them) or a GRANT (Fact-worthy already). Lifelink is neither
  — it's a printed, self-only keyword that is ALSO genuinely event-
  producing: CR 702.15e, "life gained equal to that damage," fires
  DETERMINISTICALLY whenever this permanent deals ANY damage (combat or
  otherwise), a real occurrence a lifegain-matters payoff could care
  about, not just descriptive text. **Standing exception**: a card with
  printed Lifelink always gets a real `{event:'lifegain', controller:
  'you', value:5}` SOURCE fact (self-only, no target/broadcast, reusing
  the existing `lifegain` vocabulary — bare "life gain" label, same
  `value:5` sentinel convention every other Lifelink card's own fact
  already uses) — even though it still gets NO fact for any of its OTHER
  bare keywords. Restored on 3 cards that had it dropped/missing under the
  old, too-broad rule: `minwu-white-mage` (fin/26, explicitly caught by
  the user), `stiltzkin-moogle-merchant` (fin/34, same situation, its own
  migration report had explicitly excluded it "per today's explicit
  rule"), and `cecil-dark-knight-cecil-redeemed-paladin`'s BACK face
  (found during the pool check below — Cecil, Redeemed Paladin's own
  printed Lifelink had never gotten any fact at all, missed by the
  original rule too since it predates this exception). Evidence: Minwu's
  own `keywordScenarios` helper already probes Lifelink automatically
  (front-face-only check); Stiltzkin's engine-piloted scenario got a real,
  direct `actions.dealDamage` call (Lifelink applies to ANY damage, not
  just combat, so this doesn't need full combat staging); Cecil's back
  face got a manual `{face:'back', dealsCombatDamage:{amount:3}}` probe,
  since `keywordScenarios` has no face-awareness. Checked every other
  fin/1-40 card with `'Lifelink'` anywhere in its `definition.ts`
  (adelbert-steiner/aerith-gainsborough/garnet-princess-of-alexandria/
  hope-estheim/lightning-army-of-one/locke-cole/noctis-prince-of-lucis/
  joshua-phoenix-s-dominant/vincent-valentine-galian-beast) — all already
  had the fact. `ardyn-the-usurper`'s/`rosa-resolute-white-mage`'s/
  `zidane-tantalus-thief`'s own Lifelink is GRANTED to something else
  (already separately Fact-worthy, unrelated to this bare-keyword
  exception). **Deferred, not fixed**: `moogles-valor` (fin/27) creates
  TOKENS with printed Lifelink (`TOKENS.w_1_2_moogle_lifelink`) rather
  than having Lifelink on the SOURCE card itself — a genuinely different,
  token-subject-lifegain shape this exact exception wasn't asked to cover
  and wasn't added preemptively; flagged for a future task if the user
  wants token-conferred Lifelink represented too.

- **ENGINE_GAPS.md gap #14 closed for real (2026-09-12): continuous,
  turn-conditional static keyword grants.** New `CardDefinition.
  continuousKeywordGrants?: {keywords, includeSelf, subtype?,
  onlyDuringYourTurn?}[]` (`card.ts`), mirroring the existing `ptFormula`
  CDA precedent exactly — copied onto the live `RealCard` only once, at
  the moment a permanent actually resolves onto the battlefield
  (`engine.ts`'s `resolveTop`, right after the pre-existing `real.
  manaAbility = manaAbilityColorFromStaticText(...)` line, which turned
  out to be the exact same "derive a field from `CardDefinition` at
  resolve time" precedent this needed — found and reused, not invented).
  New `GameState.activePlayerId?: number` (defaults to the first player
  added, kept in sync by `engine.ts`'s `doAdvance()` after every real
  phase/turn change) plus `isActiveOrDefault(state, controllerId)` (treats
  `undefined` as "yes," so a plain harness.ts `Scenario` with no turn
  concept still reads as "your turn," matching that file's own documented
  baseline) give this engine its first-ever "whose turn is it" query.
  New `state.ts` export `effectiveKeywords(state, card)` is the real
  QUERY-TIME read path (same "recalculated on read" pattern `effectivePT`
  already established for CDAs) — unions a card's own printed `keywords`
  with every currently-qualifying grant from any battlefield permanent.
  Made functionally real, not cosmetic, by routing every raw
  `card.keywords.includes(...)` read through it instead:
  `wrapCard`'s `hasKeyword`, `state.dealDamage`'s Deathtouch/Lifelink
  checks, and `engine.ts`'s Haste/Defender sickness/attack-legality
  checks (`payableManaSources`/`canActivateAbility`/`canAttack`) — a
  granted keyword genuinely exempts summoning sickness, triggers
  lifegain, and blocks attacking now, same as a printed one.
  **Real bug found and fixed along the way**: `resolveTop` never copied
  `continuousKeywordGrants` (or, less critically, `keywords`) onto a
  scenario-built `RealCard` — caught because Dion's own manual evidence
  query (below) returned `false` on his own turn, right after he
  resolved, when it should have been `true`.
  **New evidence shape for `verify-synergy.mjs`**: a continuous grant is
  derived/query-time and never produces a discrete `fn:'grantKeyword'`
  trace-log ACTION (nothing ever calls `actions.grantKeyword` for it), so
  the only possible real evidence is a deliberate `{fn:'read:hasKeyword',
  keyword, result:true}` query against real board state — same "manual
  CDA read" pattern `adelbert-steiner`'s own `read:getNetPower` line
  already established. New general (not per-card) evidence branch:
  a SOURCE `grantKeyword` fact is satisfied by any `read:hasKeyword` line
  with a matching `keyword` and `result:true`. Verified both directions
  for real (not just "fires once"): Dion's own Flying grant reads `true`
  during his own turn, `false` during the opponent's, via a real
  `advanceOneStep` loop crossing the turn boundary.
  **Two real cards, two different evidence outcomes**: Dion, Bahamut's
  Dominant's front face ("Dragonfire Dive — During your turn, Dion and
  other Knights you control have flying," genuinely turn-conditional) has
  a real fact plus a real `read:hasKeyword` evidence line (its
  `engine-trace.ts` pilot-script scenario can inject one). Ardyn, the
  Usurper ("Demons you control have menace, lifelink, and haste" —
  checked fresh against real oracle text: genuinely unconditional, no
  turn restriction) has 3 real facts (Menace/Lifelink/Haste) but a plain
  `harness.ts` `Scenario[]` scenario, which has no field letting a pilot
  script push an arbitrary custom log line mid-scenario — structurally
  can't produce this evidence shape at all, so its 3 facts are covered by
  a narrow, documented `isArdynDemonGrantFact` exemption instead (real
  fact, real mechanism, zero possible evidence given this one card's own
  scenario-authoring style — not a deeper engine limitation).
  **Standing rule**: `Constraints.types` is reused loosely for a subtype
  target here too (`{types:{has:['Knight']}}`/`{types:{has:['Demon']}}`),
  same "used for both real types and subtypes interchangeably" existing
  pool convention.
  **Still open, cross-domain**: nothing in this engine ever logs a
  discrete action for a continuous grant, so the app's replay UI
  (`app/SCENARIO_REPLAY.md`'s own documented keyword-icon rendering, keyed
  off either a card's static `cardKeywords` prop or a discrete
  `grantKeyword` log entry) has no way to visually show a query-time
  grant turning on/off across turns yet — needs a `card`-agent-side change
  to consult `CardDefinition.continuousKeywordGrants` directly against the
  replay's own per-step turn state, not a further engine change.

- **Standing rule (2026-09-12): scenario count defaults to 1 per card,
  going forward.** Generalizes today's own repeated consolidation pattern
  (`dwarven-castle-guard`, `cloudbound-moogle`, `dion-bahamut-s-dominant-
  bahamut-warden-of-light`, `crystal-fragments-summon-alexander`,
  `from-father-to-son` — all collapsed to 1 real scenario today) into an
  explicit default, per the user's own words: "for all cards - we should
  default to one scenario (or 0 if the card is very basic). More than 1
  scenario should require a very significant reason (i.e. branching
  spells etc)."
  - **Default: 1 real scenario**, covering as much of the card's own real
    behavior as one continuous playthrough honestly can — today's
    established shape (cast -> ETB -> activate -> chapters -> resolution,
    all one story), real engine-piloted where the card's complexity
    warrants it, a flat `harness.ts` scenario where it doesn't.
  - **0 scenarios** only for a card SO basic there's nothing beyond
    baseline cast/enter worth demonstrating (a vanilla creature, no real
    ability at all) — even then, weigh whether the baseline cast/enter
    demonstration is still worth 1 scenario purely for annotation/
    verify-synergy evidence purposes; use judgment, not a hard rule.
  - **More than 1 scenario requires a REAL, SIGNIFICANT reason** — genuine
    branching (a spell with two meaningfully different MODES that can't
    both be shown in one continuous story, e.g. a real "choose one" with
    mutually exclusive outcomes), NOT just "this card has 2 abilities" — 2
    abilities on one card can almost always be chained into one story
    (exactly what today's own consolidation work repeatedly demonstrated:
    Dion's ETB trigger + transform activation + Saga chapters, all one
    playthrough; Crystal Fragments' equip + transform + chapters, same).
    **CORRECTION (2026-09-12, later, Restoration Magic/fin-30):** "Tiered"
    (this set's own additional-cost-tier keyword — Cure/Cura/Curaga, each a
    real distinct cost+scope) counts as real branching too, same as an
    explicit "Choose one —" modal, even when the tiers are one escalating
    IDEA rather than mechanically unrelated effects. User's own explicit
    correction, reversing this card's own earlier migration call ("one
    escalating effect, not a modal, so 1 scenario is enough" — the wrong
    call for SCENARIO-count purposes specifically): "This one should have
    3 scenarios. (should be the same for all tiered/branching spells)."
    Each real tier gets its own scenario (one per real cost+effect
    combination) the same way Phoenix Down's own 2 modes do — this is
    still purely a SCENARIO-count decision, independent of the separate
    FACT-modeling question (a tiered/escalating effect can still be
    represented as one combined fact set rather than 3 duplicated
    per-tier ones; that data-modeling call isn't reopened by this).
  - Applies to NEW/touched work going forward only — not a forced
    retroactive audit of the already-committed pool (most of the fin/1-20
    batch already got consolidated today anyway); if a card already being
    touched for an unrelated reason happens to have an unjustified 2+
    count, consolidate it in the same pass rather than leaving it, but
    don't go looking for violations pool-wide as a separate task.

- **Refinement, same day (2026-09-12): scenarios demonstrate a card's
  real, BASIC function for a human reviewer — not a unit test.** Prompted
  by the user looking at `magitek-infantry` (fin/25) live: "1 scenario is
  enough. We're not testing engine edge cases on these cards, just basic
  functioning of the card. ... Feels like agent is putting too much effort
  to structure them as unit tests and covering all edge cases." This is a
  course-correction on EFFORT CALIBRATION, not just a stricter count rule
  — the earlier same-day "default 1, 2+ needs real branching" entry above
  was itself still being satisfied the wrong way: a card with exactly ONE
  real mode was still getting 2-4 scenarios because each no-op/failure/
  edge-case BRANCH of that same single mode got its own scenario (found-
  the-target vs. didn't; library has cards vs. empty; condition met vs.
  not) — technically each branch IS "a real thing the code does," but none
  of them show a human reviewer what the card is FOR.
  - A tutor/search effect's "didn't find anything" branch, an empty-
    library edge case, a static condition's "not currently met" branch —
    **none of these need their own scenario.** One real scenario showing
    the card doing its real, intended thing (the tutor finding its real
    target, the ability actually firing) is enough.
  - Only add a second scenario when the card GENUINELY has two
    meaningfully different real MODES it actually does — Phoenix Down's
    own real "Choose one" (below) is the standing worked example of a
    legitimate 2-scenario card. A success/failure pair of the SAME single
    mode is never this — that's still just one mode, demonstrated once.
  - Concrete fix applied same day: `magitek-infantry` (fin/25) had 4
    scenarios — real success (finds a second copy), "no second copy
    found, no-op", "empty library, no-op", and a static-condition-premise
    scenario carrying no distinguishing trace line of its own. Trimmed to
    1: the real success path, with the static condition's own real board
    premise (`artifactsCount: 1`) folded into that SAME scenario's `you`
    setup (cheap, no separate scenario needed for a premise that produces
    no distinguishing trace line either way).
  - The goal each time is "does this basically work," not exhaustive
    conditional-path coverage — if trimming a scenario would remove the
    ONLY evidence a real fact currently has, that's a sign the fact itself
    needs a different evidence source (or genuinely is a documented gap),
    not a reason to keep an edge-case-only scenario around.

- **Phoenix Down (fin/29) migrated to the unified Fact/annotations model
  (2026-09-12), a real worked example of the "2 scenarios, one per real
  mode" rule above.** Real oracle text: "{1}{W}, {T}, Exile this artifact:
  Choose one — / Return target creature card with mana value 4 or less
  from your graveyard to the battlefield tapped. / Exile target Skeleton,
  Spirit, or Zombie." A genuine branching modal with two mutually
  exclusive outcomes — exactly 2 scenarios (one per mode), the two
  no-op/defensive variants the pre-migration file carried dropped (they
  called neither `moveTo` nor `tap` against an empty pool, so they added
  zero real trace evidence beyond the two real-outcome scenarios).
  - **Cost-payment fact house-style, applied and flagged, not resolved**:
    this card's own activation cost has TWO real self-referencing cost
    components — `{T}` and "Exile this artifact." Both modeled as SOURCE
    facts (`{event:'tap'|'exile', subject:'self', target:'self'}`) by
    direct analogy to the existing sacrifice/tap-as-cost precedent
    (Coeurl/Dion's own self-tap fact, `isCostOnlyArtifactSacrificeFact`),
    not Cloudbound Moogle's SINK-shaped discard-as-cost fact — self-exile
    is closer in spirit to sacrifice/tap (a permanent's own cost-driven
    removal from play) than to discarding a card from hand. The real
    discard-vs-sacrifice/tap SOURCE-vs-SINK inconsistency this file
    already documents (2026-09-11, Coeurl's own entry above) is NOT
    resolved by this choice — flagged again here rather than silently
    picked without checking precedent, per the same standing concern.
    Added a new general (not per-card) `isSelfExileActivationCostFact`
    exemption, exact mirror of `isSelfTapActivationCostFact`, including
    the identical false-pass risk it guards against: this card's OWN
    mode-1 "exile target Skeleton, Spirit, or Zombie" EFFECT genuinely
    produces real `{event:'exile'}` trace evidence that would otherwise
    wrongly satisfy the self-exile-cost fact by bare event-name equality
    alone. Neither cost fact can ever have real trace evidence in the
    first place: `engine.ts`'s `unsupportedCostComponent` doesn't
    recognize "Exile this artifact" as a payable cost component at all (not
    pure mana/`{T}`, not the one accepted "Sacrifice another/a/two X"
    pattern), so this card's own activated ability can never be piloted
    through `canActivateAbility`/`activateAbility` — confirmed genuinely
    unpilotable, which is why this card's `scenarios.ts` stays plain
    `harness.ts` `Scenario` style (mode-gated custom effects), not
    `engine-trace.ts`.
  - **New vocabulary: `event:'exile'`, a bare ACT-shaped tag (not an inline
    `to:'Exile'` zone fact), by direct analogy to `destroy-act` staying
    bare** — a real, targeted removal act, same shape class. Checked
    before promoting: zero prior pool usage of `event:'exile'` in either
    role. Promoted `verify-synergy.mjs`'s `producedEvents`'s `case
    'moveTo'` AND `case 'ceasesToExist'` to recognize a real move into
    `zone:'Exile'` as `{event:'exile'}` evidence (general, pool-wide, not
    per-card, same "landing on the battlefield always triggers
    entersBattlefield" promotion pattern already applied to that event) —
    needed BOTH cases since this card's own mode-1 scenario exiles a TOKEN
    Zombie, which `harness.ts` logs as `ceasesToExist`, not `moveTo`, per
    real 111.7. Zero risk to the rest of the pool today (no other card
    declares `event:'exile'` yet) but DOES surface ~43 real pool-wide
    `fn:'moveTo'`/`zone:'Exile'` trace lines as new SOFT notes (produced-
    but-unexplained) on other cards that already exile something without
    declaring a matching fact — same accepted, non-fatal, note-not-fail
    side effect the `pump` promotion caused pool-wide (2026-09-11 entry
    above).
  - **New named `ZONE_MOVEMENT_NAMES` entry: `reanimate`
    (Graveyard→Battlefield)** — the first real pool usage of this `(from,
    to)` pair (checked: zero prior facts anywhere in the pool), for the
    card's own "Return target creature card ... from your graveyard to
    the battlefield tapped" mode. Named after the classic MTG effect
    archetype, same "borrow the short, common term" convention `tutor`/
    `regrowth`/`bounce` already established.
  - **Real, pre-existing, pool-wide gap surfaced (not new, but concretely
    hit for the first time by this card's own honest authoring): a
    `cmc:{max:4}` constraint on a `subject`-resolved zone fact is
    currently UNSATISFIABLE by any producer in the pool.** `CardDefinition
    .cmc` is deliberately optional and "omit unless a real card's own
    EFFECT reads its own cmc" (`card.ts`'s own doc comment) — almost no
    pool card populates it, since the synergy matcher's `staticAttrsFor`
    (`cmc: card.cmc`) is a DIFFERENT consumer than the one that field's own
    doc comment was written for. `satisfiesNum` treats an unresolved
    (`undefined`) value as an automatic non-match, so a real, textually
    accurate `cmc:{max:4}` — matching the card's own actual "mana value 4
    or less" restriction — currently cannot be satisfied by any producer
    regardless of their real cost. Confirmed via a real `find-synergies
    .mjs` diff (below): kept the honest constraint on both the reanimate
    SOURCE fact and its companion graveyard SINK fact rather than dropping
    it to preserve match count — same "correctness over match count"
    precedent this file's own From Father to Son Vehicle-vs-Artifact fix
    already established (2026-09-11 entry above). A real, computed
    cmc-from-`manaCost` field for the synergy matcher specifically (not
    reusing the effect-facing optional field) is open future work, not
    done here.
  - **Real `find-synergies.mjs` diff** (isolated swap against the
    pre-migration HEAD file): BEFORE 94 lines, AFTER 49. Gained: +39 new
    "enters the battlefield" matches via the new `self-enters` baseline
    fact (the pre-migration file had no baseline self-cast/self-enters
    facts at all). The `reanimate` fact's own 12 matches are the IDENTICAL
    card set the pre-migration file's own (incorrectly type-unconstrained)
    "reanimate" fact happened to match — the new Creature+cmc `target`
    filter cost zero real matches here. Lost: all 88 reverse graveyard-
    presence/dies matches (82 "graveyard presence" + 6 "dies") the OLD
    sink used to get purely because it had no `cmc` filter at all — see
    the gap above; a real, accounted-for, documented tradeoff, not a
    silent regression. `event:'exile'` itself: 0 matches either direction,
    expected (new, forward-looking vocabulary, same `pump`-promotion
    pattern). `verify-synergy.mjs` scoped: 0 hard failures. `vitest run
    functional-model`: 238/238.
  - **Open Forge-verification**: none needed — real oracle text confirmed
    directly against `data/fin/fin_scryfall.json` (collector_number 29,
    mana_cost `{W}`, matches `definition.ts` exactly); this pass is a fact-
    model/vocabulary migration, not new engine mechanics.

- **Real "not mocked" fix: `PlayerState.creatureCards` (2026-09-12) —
  Phoenix Down's own mode-1 scenario claimed a real card had a subtype it
  doesn't have.** User caught live: "2nd scenario exiles grizzly bear as a
  zombie (even though it's not a zombie...)". Root cause: `creatureSubtypes`
  tags the SAME shared `GENERIC_FILLER_CREATURE` ("Grizzly Bears," a real,
  specific, recognizable Scryfall card — NOT a Zombie/Legendary/Wizard/
  whatever the scenario claims) with an arbitrary subtype array — correct
  for a generic, nameless filler POOL ("N creatures with subtype X, doesn't
  matter which"), but dishonest the instant a scenario's own real card text
  names a SPECIFIC creature type it needs one genuine example of. Added a
  new `PlayerState.creatureCards?: {name, subtypes?, power?, toughness?}[]`
  (`harness.ts`) — seeds one or more real, specifically-named nontoken
  creatures with their own real stats, same "real Scryfall identity" bar
  `tokens`/`libraryNamedCard` already hold scenario setup to. Applied to
  Phoenix Down (real Qutrub Forayer, 3/2 Zombie Horror, replacing the fake
  "Zombie" Grizzly Bears).
  **Real, systemic pattern found, NOT retrofitted pool-wide**: grepped
  every `creatureSubtypes:` use pool-wide — `louisoix-s-sacrifice`,
  `serah-farron-crystallized-serah`, `bartz-and-boko`, `kuja-genome-
  sorcerer-trance-kuja-fate-defied`, `quina-qu-gourmet`, `minwu-white-mage`,
  `elvish-archdruid`, `circle-of-power`, `summon-esper-ramuh`, `torgal-a-
  fine-hound`, `summon-leviathan`, `vaan-street-thief`, `sidequest-raise-a-
  chocobo-black-chocobo` ALL have the exact same underlying issue (a real
  "Grizzly Bears" tagged Legendary/Bird/Wizard/Frog/Cleric/Elf/Merfolk/
  Human/Scout/etc, none of which it really is). Left as-is — none of these
  visibly name a SPECIFIC real creature type the way Phoenix Down's own
  "Skeleton, Spirit, or Zombie" targeting text does (most are testing a
  generic "N creatures with subtype X" pool, where WHICH specific card
  fills that pool genuinely doesn't matter to the card's own real text),
  and retrofitting all of them to `creatureCards` is a separate, larger
  task, not a one-card regression fix. Revisit case-by-case if a future
  task flags one of these as visibly wrong the same way Phoenix Down was —
  `creatureSubtypes` itself stays correct and unchanged for the genuinely-
  generic case.

- **Qiqirn Merchant (fin/65) migrated to the unified Fact/annotations model
  (2026-09-12) — first real `CardDefinition.abilities` (TWO independent
  named activated abilities on one permanent, no top-level
  `activationCost`) card in the pool, and a real, general `engine-trace.ts`
  gap it surfaced.** Real oracle text: "{1}, {T}: Draw a card, then discard
  a card." / "{7}, {T}, Sacrifice this creature: Draw three cards. This
  ability costs {1} less to activate for each Town you control." Migrated
  to `runEngineScenarios()` (ONE real scenario, per the standing "default 1,
  chain independent abilities into one story" rule — this is NOT a
  branching/modal card the way Phoenix Down's real "Choose one" is, just
  two small, unrelated real abilities, both needing their own real trace
  evidence): real cast -> real turn passage (clears summoning sickness) ->
  real `"cantrip"` activation (draw, discard) -> real `"bigDraw"`
  activation (draw 3), fired directly since its own cost is unsupported
  (below).
  - **Real `engine-trace.ts` gap fixed, general not per-card: `pilotActivate`
    had no way to engine-pilot a NAMED ability at all.** It always called
    `canActivateAbility(engine, controller, permanent, card)`/
    `activationCostFor(card)` with no `abilityName`, which only ever reads
    `card.activationCost` — undefined for a `card.abilities`-shaped card, so
    every real activation attempt on this card would have failed with "has
    no such activated ability" through this path. Added an optional
    `abilityName?: string` param (appended after the existing `label?`,
    backward-compatible with every prior positional caller), threaded to
    `canActivateAbility`/`activateAbility`/`activationCostFor` — all three
    already supported it (`engine.ts`), this was purely a missing
    `engine-trace.ts` plumbing link. `"cantrip"` ({1}, {T}, pure mana+tap)
    is now piloted for real through this fixed path — including a real,
    genuine `fn:'tap'` log line for its own `{T}` cost (the existing, more
    general `pilotActivate` tap-logging fix from earlier the same day,
    2026-09-12, Venat's own entry above), giving this card's own self-tap-
    cost fact (below) REAL trace evidence rather than needing to lean on
    the `isSelfTapActivationCostFact` exemption the way Coeurl/Dion's own
    (pre-existing-`pilotActivate`) facts still do.
  - **`"bigDraw"`'s own "Sacrifice this creature" cost is a NAMED
    self-sacrifice** — `engine.ts`'s `unsupportedCostComponent` only ever
    accepts "Sacrifice another/a/two X" (never a self-reference), the exact
    same real, general engine limitation Zack Fair's own "{1}, Sacrifice
    Zack Fair" hits (that card's own scenarios.ts header). Fired directly
    via `resolveCard(qiqirnMerchant, ctx, actions, undefined, 'bigDraw')`,
    bypassing `canActivateAbility` entirely, same technique — Qiqirn
    Merchant is never actually removed from the battlefield in this model,
    same limitation, same reason.
  - **Real fact set, all 7 SOURCE, no SINK** (no board-state-consumption
    clause anywhere in the real text): baseline `self-cast`(Hand)/
    `self-enters`; a shared `{event:'tap', subject:'self', target:'self'}`
    self-tap-cost fact (ONE fact covers both abilities' own real `{T}` —
    the same underlying concept regardless of which ability pays it, per
    the standing "any activated ability whose cost includes {T}" rule,
    2026-09-11 Coeurl/Dion entry above); `"cantrip"`'s own real `{event:
    'drawCard'}` and `{event:'discard', controller:'you'}` (the discard is
    part of the ability's own EFFECT, not a cost — a produced SOURCE fact,
    deliberately NOT modeled the same shape as Cloudbound Moogle's
    Plainscycling discard-as-COST SINK, `isCloudboundMoogleDiscardSelfWant`
    — different real context, flagged rather than silently conflated, same
    "note the shape difference, don't resolve the standing SOURCE-vs-SINK
    discard inconsistency unilaterally" treatment Coeurl's own entry already
    established for tap/sacrifice-as-cost); `"bigDraw"`'s own real
    `{event:'sacrifice', subject:'self', target:'self'}` cost-payment act
    (mirrors Zack Fair's identical shape, exempted the identical way via
    the already-generalized `isSelfSacrificeActivationCostFact`) and its own
    second, separately-anchored real `{event:'drawCard'}` fact (a SEPARATE
    fact from `"cantrip"`'s own — same event name, but each anchored to its
    own real, distinct oracle sentence, so a reviewer sees which ability
    backs which fact rather than one fact silently standing in for two real
    occurrences).
  - **New general `producedEvents` promotion, `verify-synergy.mjs`:
    `case 'discard'`** — `producedZone` already read a real `fn:'discard'`
    line for its own zone-shaped (Graveyard) evidence, but there was no
    EVENT-shaped `{event:'discard'}` sibling at all (unlike `sacrifice`/
    `destroy`, which already produce both shapes off one log line) — needed
    for `"cantrip"`'s own real discard-as-EFFECT fact to have any possible
    forward evidence. General, not scoped to this card; `harness.ts`'s own
    `loggingActions.discard` always logs a real `player` field (never a
    bare object name needing `sideOf`'s guess), same shape `gainLife`/
    `loseLife` already use.
  - **ENGINE_GAPS.md gap #7 extended**: the per-Town activation-cost
    reduction clause is real, un-executed documentary text (same treatment
    `fate-of-the-sun-cryst`'s/`the-wind-crystal`'s own cast-cost-reduction
    clauses already get) — confirmed this is the SAME missing-discount-hook
    gap, just on the activation-cost path (`activationCostFor`) rather than
    `canCastSpell`, generalizing gap #7 beyond spell-casting specifically.
  - **Dropped the pre-migration file's own stray `{zone:'Graveyard',
    controller:'you', value:1}` source fact** (no `subject`, predates this
    model) rather than migrating it forward — checked whether either
    ability's own scenario evidence could back a real self-graveyard
    zone-consequence fact the way Summon: Bahamut's own `self-graveyard`
    does, and it can't: same as Zack Fair's own identical situation, this
    card's own effect logic never actually moves it off the battlefield in
    this model (the self-sacrifice cost is never really paid, just
    documented), so there is no real evidence for that fact any more than
    there is for Zack Fair's — dropped it rather than exempt a fact with
    literally nothing behind it, same call Zack Fair's own migration
    already made for the identical shape.
  - **Real `find-synergies.mjs` diff, `verify-synergy.mjs`, `vitest`**: see
    this task's own final report for the numbers (kept out of this design
    doc per the "record the design decision, not every run's raw counts"
    convention already followed above for e.g. Phoenix Down's write-up,
    which does include its own numbers — this one's numbers live in the
    handoff note instead since they were produced by a supervised task, not
    an interactively-narrated design session).
  - **Open Forge-verification**: none needed — real oracle text confirmed
    directly against `data/fin/fin_scryfall.json` (collector_number 65,
    mana_cost `{2}{U}`, power/toughness `1`/`4`, type line "Creature — Beast
    Citizen" — matches `definition.ts` exactly); this pass is a fact-model/
    vocabulary migration plus one small `engine-trace.ts` plumbing fix, not
    new engine mechanics.

- **Rook Turret (fin/69) migrated to the unified Fact model (2026-09-12)**
  — "Flying / Whenever another artifact you control enters, you may draw a
  card. If you do, discard a card." Bare printed Flying gets no fact (this
  doc's own 2026-09-12 standing rule, above). 4 SOURCE facts: baseline
  `self-cast`/`self-enters` (typeLine-anchored, "Creature"), plus a real
  optional `{event:'drawCard', controller:'you'}` / `{event:'discard',
  controller:'you'}` pair for the loot ("if you do" gating is the same
  documentary-only convention every other optional effect in this pool
  uses — a legal draw/discard always happens once the trigger fires, no
  player-decision engine anywhere in this model). 1 SINK fact:
  `{event:'entersBattlefield', controller:'you', types:{has:['Artifact']}}`
  for the trigger CONDITION itself — same shape/precedent as `loporrit-
  scout`'s (`types:{has:['Creature']}`) and `woodland-weavemaster`'s
  (`types:{has:['Elf']}`) own "another X enters" wants, NOT the
  zone-shaped `{to:'Battlefield', types:...}` shape the task brief
  initially suggested — checked both real existing pool precedents first
  and matched them rather than inventing a third shape for the identical
  real-world trigger pattern. `TRIGGER_EVENT_MAP` gained `onArtifactEnters:
  'entersBattlefield'` (`verify-synergy.mjs`) — left deliberately unmapped
  until now per this doc's own Implementation-notes entry ("add the mapping
  when a card actually declares the want, not before"); `onArtifactEnters`
  is also the trigger name on `golbez-crystal-collector`/`tidus-blitzball-
  star` (checked, pool-wide grep), but the map is purely additive
  evidence for the forward want-check (never a source of new failures), so
  this could only ever help those two cards' own verification if they ever
  declare a matching want — confirmed no new hard failures for either.
  Scenario: consolidated to 1 (no top-level `trigger`, `sequence:
  ['onArtifactEnters']` — same `dwarven-castle-guard`/`cloudbound-moogle`
  consolidation already established, chaining the trigger fire onto a REAL
  cast->resolve->enters lifecycle so the baseline facts get real evidence
  too, not the card's own pre-existing `trigger: 'onArtifactEnters'`
  shortcut, which left `self-cast`/`self-enters` with zero trace evidence
  — a real hard failure caught by the first `verify-synergy.mjs` run and
  fixed by the consolidation, not by exempting anything). Dropped the
  pre-migration file's own stray, unexplained `{zone:'Graveyard',
  controller:'you', value:1}` source fact — same call Zack Fair's/the
  card above's own migration already made for an identical
  no-real-evidence shape; this card's oracle text has nothing about a
  graveyard at all.

  **Real, newly-surfaced matcher gap found while checking this card's own
  `find-synergies.mjs` diff, NOT caused by this migration**: an event-shaped
  want's own `types` constraint (declared directly on the fact, e.g. this
  card's `types:{has:['Artifact']}`) is **never actually read by
  `factsInteract`'s event-to-event branch** — that branch only ever
  consults `we.target` (`'self'` or a `Constraints` object); a bare
  `we.types` with no `target` wrapper falls straight through to the
  branch's final "neither side names a target — a bare event hook" `return
  true`, matching ANY producer of the same `event` string regardless of
  its own real type. Confirmed via the real diff: Rook Turret's own new
  sink gains 13 matches from the pool's 13 unconstrained
  `entersBattlefield` SOURCE facts (Baron Airship Kingdom, Crossroads
  Village, Elrond Moon-Reader, Gohn Town of Ruin, Gongaga Reactor Town,
  Guadosalam Farplane Gateway, Insomnia Crown City, Rabanastre Royal City,
  Sharlayan Nation of Scholars, The Gold Saucer, Treno Dark City, Vector
  Imperial Capital, Windurst Federation Center) — all LANDS, none of them
  Artifacts. This is not a new bug this migration introduced: `loporrit-
  scout`'s own `types:{has:['Creature']}` want and `woodland-weavemaster`'s
  own `types:{has:['Elf']}` want already match the exact same 13
  unconstrained lands today, for the identical reason — checked live via
  `find-synergies.mjs`, both already show all 13 as producers. Same
  category of pre-existing, already-accepted matcher imprecision as the
  `entersBattlefield`-as-sink `pe.target === undefined` vacuous-match
  finding earlier in this doc (Cloud, Midgar Mercenary) — left as-is here
  too, not patched ad hoc, for the same reason: fixing it is a real matcher
  change (wire a bare `Constraints` on an event-shaped `Fact` into
  `factsInteract`'s event branch the same way the zone branch already
  reads `constraintsOf(w)`) affecting 3 real cards' own match sets at once,
  not a one-card fix, and out of scope for a single-card migration task.
  Flagged here explicitly, the same way the Cloud finding was, for a real
  future decision rather than silent tolerance.

  Real `find-synergies.mjs` diff (isolated via a scoped `git stash push -u`
  A/B on exactly this card's own 4 files, not a stale HEAD diff — the pool
  is heavily concurrently edited today): **9 lost** (the dropped stray
  `zone:'Graveyard'` fact's own 9 matches — Cantankerous Keepers, Eden Seat
  of the Sanctum, Emet-Selch Unsundered, Ignis Scientia, Magic Pot, Qutrub
  Forayer, Rydia's Return, Thranduil Sindarin Liege, Vanille Cheerful
  l'Cie — a real, accounted-for, documented tradeoff, not a silent
  regression: that fact had no real basis in this card's own oracle text).
  **165 gained**: 152 from the new `self-enters` fact satisfying the
  pool's ~150 unconstrained Battlefield-presence sinks (the same generic
  gain every other newly-migrated card's own baseline `self-enters` fact
  produces), plus the 13 unconstrained-producer false-positive matches into
  Rook Turret's own new sink documented above (real, but a known matcher
  imprecision, not a meaningful "this card synergizes with lands" signal).
  `verify-synergy.mjs` scoped: 0 hard failures. Full pool: 317 checked, 8
  hard failures, all pre-existing/unrelated (`cargo-ship`, `cecil-dark-
  knight-cecil-redeemed-paladin`, `dragoon-s-wyvern`, `il-mheg-pixie`,
  `stiltzkin-moogle-merchant`, `the-wind-crystal`, `white-auracite`,
  `zack-fair` — every one mid-edit by a concurrent session per `git
  status`, none touching Rook Turret or the `TRIGGER_EVENT_MAP`/
  `ANNOTATED_CARD_SLUGS` additions). `npx vitest run functional-model`:
  238/238. `npx tsc --noEmit -p functional-model/tsconfig.json`: 47
  pre-existing errors, unchanged, none in any file this task touched.
  - **Open Forge-verification**: none needed — real oracle text confirmed
    directly against `data/fin/fin_scryfall.json` (collector_number 69,
    mana_cost `{3}{U}`, type line "Artifact Creature — Construct" —
    matches `definition.ts` exactly); this pass is a fact-model/vocabulary
    migration (plus the `TRIGGER_EVENT_MAP` addition), not new engine
    mechanics.

- **Y'shtola Rhul (fin/86) migrated to the unified Fact/annotations model
  (2026-09-12)**: "At the beginning of your end step, exile target creature
  you control, then return it to the battlefield under its owner's control.
  Then if it's the first end step of the turn, there is an additional end
  step after this step." 4 SOURCE facts: baseline `self-cast`/`self-enters`
  (typeLine-anchored to "Creature", same span zack-fair/the-lunar-whale
  already use for a plain "Legendary Creature" type line — no second
  stacked type to distinguish cast-vs-enters the way summon-choco-mog's
  "Enchantment Creature" does), plus a real targeted exile-then-return pair
  — `{to:'Exile',from:'Battlefield',controller:'you',
  target:{types:{has:['Creature']}},targeted:true}` and
  `{to:'Battlefield',from:'Exile',event:'entersBattlefield',
  controller:'you',target:{types:{has:['Creature']}},targeted:true}` — the
  same `to`/`from` pair shape jill-shiva-s-dominant/dion-bahamut-s-dominant's
  own self-transform exile+return already use, but with a `target`
  constraint instead of `subject:'self'`, since this blinks a CHOSEN
  creature, not necessarily itself (checked: no existing pool precedent for
  blinking a target OTHER than self before this card). 1 SINK fact:
  `{to:'Battlefield',controller:'you',types:{has:['Creature']}}` for the
  "target creature you control" the trigger needs. The "additional end
  step" clause gets NO Fact at all — not even an unmatchable one — since no
  Effect kind/event vocabulary represents "insert another phase" in any
  form (a stricter case than Auron's Inspiration's own "real vocabulary
  exists, trace evidence doesn't" exemption); stays honest documentary text
  on the trigger's own comment, the same way Ultimecia's back-face "take an
  extra turn" stayed undemonstrated before extra turns was closed.
  **Surfaced a genuine new engine gap** (`ENGINE_GAPS.md` gap #17): checked
  `turn.ts` directly rather than assuming — `TurnState.extraTurns` (gap #3,
  closed) only queues a whole EXTRA TURN at the turn-wrap point; nothing
  anywhere splices one more occurrence of the CURRENT phase into the
  CURRENT turn's own fixed `PHASES` walk. Real Forge citation:
  `res/cardsfolder/y/yshtola_rhul.txt`'s own `DB$ AddPhase | ExtraPhase$ End
  of Turn | AfterPhase$ End of Turn | ConditionCheckSVar$ X |
  ConditionSVarCompare$ LT1` (gated by `SVar:X:Count$
  FinishedEndOfTurnsThisTurn`). **Checked pool-wide before writing this up
  as narrow, and it isn't**: Balthier and Fran and Genji Glove (both already
  migrated) independently hit the identical `DB$ AddPhase` primitive gap for
  their own "additional combat phase" clauses, each with only a per-card
  comment ("no turn/phase-structure Effect shape exists here") and no
  central `ENGINE_GAPS.md` entry until now — gap #17 is written to cover
  both real shapes (extra end step, extra combat phase) as one underlying
  primitive, not two coincidentally-similar gaps. `find-synergies.mjs`
  diff (isolated via a temporary HEAD-restore of just this card's own
  `synergy.json`): lost ~130 old unconstrained "battlefield presence"
  matches from the removed bare-presence self-battlefield SOURCE fact (no
  longer allowed post-rework — a SOURCE must be a real movement) plus 1
  self-interaction (`second-copy-legendary`, since `self-enters` correctly
  has no `subject`, the same accepted tradeoff summon-bahamut's own
  `self-enters`/`self-cast` already established); gained 22 lines (11
  unconstrained battlefield-presence sinks matched twice — once via
  `self-enters`, once via the blink-return fact, both zone-shaped with
  `to:'Battlefield'` — same duplicate-match shape summon-bahamut's own
  migration diff already documented). The new `to:'Exile'`/targeted
  Creature-constrained facts currently have zero real pool matches (no sink
  wants Exile presence or a type-constrained blink producer yet) — real,
  honest, just unmatched today. `verify-synergy.mjs` scoped: 0 hard
  failures, 1 soft note (`legendRule` with no matching declared produce) —
  confirmed this exact soft note is the same pool-wide-accepted
  `keywordScenarios()` "second-copy-legendary" probe every other annotated
  Legendary card using that helper also produces (checked live against
  the-prima-vista/ultros-obnoxious-octopus), not something this migration
  introduced. Full pool: 319 checked, 4 pre-existing hard failures
  unrelated to this card (al-bhed-salvagers, stuck-in-summoner-s-sanctum,
  ultros-obnoxious-octopus, valkyrie-aerial-unit — all mid-edit by
  concurrent sessions per `git status`). `npx vitest run functional-model`:
  351/351 pass.

- **Follow-up (2026-09-12, later same day): ENGINE_GAPS.md gap #17 closed
  for real.** `turn.ts` now has a genuine `queueExtraPhase`/
  `isFirstPhaseGroupOccurrenceThisTurn` primitive (see that file's own
  header and `ENGINE_GAPS.md` gap #17's own closure writeup for the full
  Forge citation). Y'shtola Rhul's own `definition.ts` was updated to
  actually call `actions.queueExtraPhase('EndOfTurn')` when `ctx
  .firstPhaseGroupOccurrenceThisTurn` is true — the "additional end step"
  clause is REAL now, no longer documentary-only text. Still deliberately
  NO synergy Fact for it, same as before and same as Ultimecia's own
  `queueExtraTurn` (gap #3, closed long before this pass) never got one
  either — a "insert/repeat a turn structure step" consequence isn't a
  produce/consume-shaped board effect any SOURCE/SINK fact vocabulary
  models, so this stays a real, working mechanism with zero synergy-graph
  surface area, by design, not an oversight.

## Standing rule: scenario `result` text is user-facing prose — no "real"/"genuine"/"actual" emphasis (2026-09-12)

A `Scenario`'s `result` string (`cards/<slug>/scenarios.ts`) is read
directly by a user in the card page's Scenarios tab — plain, natural
language, not an internal engineering note. Words used purely as an
emphasis/qualifier — "real", "genuine"/"genuinely", "actual"/"actually" —
do not belong in that text. Every scenario already **is** real by
construction (it plays out on the actual engine, setup just loads
specific state; it behaves like a normal match throughout) — that's the
default, not a fact to call out inline, so there is never a reason to
tell the user "this is a real creature" or "genuinely lethal combat" as
opposed to some lesser, implied-fake alternative. Write the sentence the
same way you would without the qualifier at all: "a separate creature you
control attacks", "dies in lethal combat".

This is scoped narrowly to the `result:` string value itself — it does
NOT apply to code comments around the `Scenario[]` array, `progress.json`
`knownGaps` entries, agent notes, or this file's own prose, where the same
words are legitimately used to mean something different (an engineering
claim like "confirmed via a real trace, not fabricated" is about
verification rigor for another agent's benefit, not user-facing
description, and stays as-is).

## `Fact.provenance` — parser-derived facts wired into real `synergy.json` (2026-09-13)

`PRD_AUTOMATED_AUTHORING.md`'s recognizer-library prototype
(`functional-model/recognizers/`) is now wired into real per-card data,
not just in-memory/test-proven — see that PRD's own new "Wired into real
per-card data" section and `.claude/contracts/card-schema.md`'s new
section for the full writeup; this entry is the design-doc pointer, not a
duplicate of either.

- New optional `Fact.provenance?: { origin: 'parser'; rule: string }`
  (this file, above, alongside every other "purely informational, not
  consulted by `factsInteract`, not added to `themeOf`" field —
  `targeted`/`untilEndOfTurn`/`costReductionPerControlled`/`oncePerTurn`).
  Absent = hand-authored (today's implicit, unmarked default); present =
  which recognizer produced it. Deliberately a plain `string` for `rule`,
  not `recognizers/types.ts`'s own narrower `RecognizerId` union — this
  file's own `Fact` vocabulary does not import from `recognizers/` (the
  dependency already only ran the other direction: recognizers import
  `Fact`/`AnnotationRef`/`toLineOffset` from here).
- New `functional-model/scripts/apply-recognizers.mjs` — additive,
  idempotent, whole-pool. Appends a recognizer's matched fact to a card's
  own `source` array only when no existing fact (hand-authored OR a prior
  run of this same script) already covers the identical real claim,
  compared on a reduced key deliberately excluding `value`/`controller`
  (both genuinely inconsistent across today's existing hand-authored pool
  for these two specific fact shapes — see that script's own header) and
  `annotations`/`provenance` (metadata, not part of what a fact claims).
  202 of 323 real pool cards gained at least one new fact this way (435
  total) — NOT a cherry-picked handful; ~200 cards turned out to be
  genuinely missing this exact self-cast/self-enters boilerplate pair
  entirely (not merely "already covered", which the prototype's own small
  spot-checked sample had suggested was the norm).
- `scripts/verify-synergy.mjs` downgrades a `provenance.origin==='parser'`
  produce fact's missing trace-evidence from a hard FAIL to a soft note
  (both evidence-check sites — zone-shaped and event-shaped) — see that
  script's own inline comments. Real trigger: 43 pool cards whose own
  `scenarios.ts` never actually casts them from hand (only exercises the
  card's own distinguishing ability) would otherwise hard-fail on a
  boilerplate claim that's true by construction. Confirmed via `git
  stash`-isolated before/after: 0 hard failures both before and after this
  whole task; every one of the 43 was on a card this task's own wiring
  touched (checked, not assumed).
- `zack-fair`/`ultima` — the two cards the user asked to inspect
  personally — both come out of the real whole-pool run with **zero**
  new facts and zero diff, confirming the prototype's own side-findings
  hold for real, not just in `recognizers.test.ts`.

### `Fact.value`/`Weight`/`factTotal` removed from the schema entirely (2026-09-14)

Every `value`/`Weight`/`factTotal`/`ease` reference throughout this document
(the fact model's own doc comment, the dedup-retagging sections, the
`compute-weights.mjs` recompute writeups) is now **historical record of a
field that no longer exists**, not current behavior — struck through in
spirit, not literally, the same "kept as history, not deleted" treatment
this doc already gives the pre-merge `ZoneFact`/`EventFact` split above.
User's own explicit instruction: "let's remove value from everything (edges,
facts, etc). No -1, no nothing. wipe it out of the project" — a hard
removal, not a further step in the "deprecated pool-wide" status the field
already had going into this pass (`.claude/contracts/card-schema.md` already
recorded it as "not consulted by anything that actually matches/interacts
facts" before this).

Concretely: `Fact.value`/`Weight` (`synergy.ts`) are gone from the type;
`factTotal()` and `InteractionMatch.theirTotal` are deleted (the latter's
only real consumer, `server/api/card/[set]/[number].ts`'s
`dedupMatchesByCard`, now keeps the first-encountered duplicate rather than
the highest-`theirTotal` one — a benign, arbitrary-tiebreak degradation,
never surfaced on the served payload either way). `compute-weights.mjs`
(whose entire job was computing/writing this field) is deleted outright,
not gutted-and-kept. Every recognizer in `functional-model/recognizers/`
stopped emitting `value` on its own produced facts; `apply-recognizers.mjs`'s
dedup/retag logic (which already excluded `value` from `coreKey` identity
matching, per this doc's own note above) no longer reads or writes
`.value` anywhere. Every `cards/<slug>/synergy.json` file had its `value`
key stripped from every fact, pool-wide (a one-off script, not hand-edited
per file — verified via a pool-wide grep for zero remaining `"value"` keys
under any fact object afterward).

### `dealDamage-effect-structural.ts`/`dealDamageTarget-effect-structural.ts` widened to cover the effect's own subject clause (2026-09-16)

`verify-text-coverage.mjs` flagged the SUBJECT phrase ("This creature"/the
card's own printed name) as sitting just outside these two recognizers' own
annotations, immediately before "deals" — real for Summon: Bahamut
(`dealDamage-effect-structural`, chapter IV, "IV — Mega Flare — **This
creature** deals damage...") and Summon: Esper Ramuh (`dealDamageTarget-
effect-structural`, chapter I, "I — Judgment Bolt — **This creature** deals
damage..."). Both recognizers now build a `selfSubjectAlternation(name)`
helper — same "this `<permanent type>`"/"this permanent"/own printed name
(or short pre-comma form) shape `dies-trigger-structural.ts` already
established, deliberately excluding bare "it" for the same reason that
file's own doc comment gives — and try it as an OPTIONAL, non-capturing
prefix immediately before "deals" (only whitespace between, so a chapter's
own numeral/ability-name label, e.g. "IV — Mega Flare — ", is never reached
for — no recognizer in this pool covers that label anywhere, so this
change doesn't invent a new convention to do so either). When the subject
form isn't recognized (Vivi Ornitier's/The Emperor of Palamecia's own back
face's bare "it", Blazing Bomb's own bare "It") the match still starts
right at "deals," unchanged from before — confirmed via explicit
regression-guard assertions in both recognizers' own `.test.ts` files, not
just the widened cases.

**`Summon: Primal Garuda`'s own matching gap is NOT a recognizer-anchoring
issue** — its "Aerial Blast" clause is a `kind:'custom'` `Effect` (no
`dealDamageTarget`'s own `tapped`-filter field exists, see that card's own
`definition.ts` comment), so neither recognizer above ever runs against it;
its own `damage`/sink facts are still hand-authored via `cards/summon-
primal-garuda/annotations-authoring.json` + `compute-annotations.mjs`, not
`apply-recognizers.mjs`. Widened that authoring entry's own `highlight` the
same way, then discovered `compute-annotations.mjs` can no longer safely
regenerate this card's `synergy.json` at all: `annotations-authoring.json`
represents its facts in the file's OWN original hand-authored order/count,
but `apply-recognizers.mjs` has since re-ordered/merged/appended facts on
top of them (a real, separate parser-derived fact set now sits alongside
the authored ones) — `compute-annotations.mjs`'s strict positional zip
between the authoring file and `synergy.json`'s current `source`/`sink`
arrays silently mis-assigns spans once the two have drifted this way
(confirmed: running it against this card produced garbage `typeLine`-
anchored annotations for facts that have real `oracle`-anchored ones). This
is a genuine, pre-existing tooling gap — not caused by this pass, not fixed
here either (out of scope) — hand-patched this ONE card's `synergy.json`
annotation directly instead of re-running the broken tool; flagged for
whoever next touches `compute-annotations.mjs` or the ~85 other cards still
carrying an `annotations-authoring.json` of their own, any of which could
have silently drifted the same way once `apply-recognizers.mjs` touched
them.

Neither Summon: Esper Ramuh (chapter II/III's own "Wizards you control get
+1/+0" `pumpAll` clause, still unrecognized) nor Summon: Primal Garuda
(5 of 8 facts still hand-authored, not recognizer-derived, per that card's
own `progress.json`) flip to a green `fin_card_status.json` classification
from this change alone — both are gated by real, separate, pre-existing
provenance/coverage gaps unrelated to the subject-clause fix (their own
"This creature"/damage-clause span IS now fully covered either way).
Summon: Bahamut flips to green (0 uncovered spans, 90% covered, all 9
facts recognizer-derived).

### `destroy` implies `dies` at match time — a narrow, scoped instance of the "full matcher unification" open work above, closed (2026-09-16)

Real user-reported redundancy: `destroy-effect-structural.ts`/
`destroyProgram-effect-structural.ts` each emitted TWO source facts per
recognized destroy effect — the `event:'destroy'` ACT tag, and a
byte-for-byte-annotation-identical `event:'dies', from:'Battlefield',
to:'Graveyard'` CONSEQUENCE fact right next to it (confirmed on
`battle-menu`/fin-9: "Destroy target creature with power 4 or greater").
Per this file's own "ACT vs CONSEQUENCE" standing rule table (above,
"Fact unification" section), that pairing was always the CORRECT model for
what the two facts individually CLAIM (destroy is conditional/preventable
— indestructible/regeneration — so the ACT fact correctly stays bare; the
guaranteed CONSEQUENCE is a separate, always-real fact). The bug wasn't in
that reasoning — it's that the CONSEQUENCE fact added zero NEW matchable
information over the ACT fact's own `target` filter, since both shared the
identical annotation span and target constraint. Authoring it twice was
pure duplication of DATA, not a duplication of CLAIM.

**Fix: move the equivalence to the MATCHER, not the data.** Both
recognizers now emit ONLY the `destroy` fact (their own module doc
comments have the full writeup); `synergy.ts`'s `factsInteract` gained a
new branch, checked BEFORE the ordinary `isZoneFact(p) !== isZoneFact(w)`
shape-partition gate (this file's own "Fact unification" section, above):
when the producer is `{event:'destroy', target, ...}`, it's tested against
BOTH shape-families of "wants a graveyard arrival" want directly —
`isGraveyardArrivalWant(w)` returns true for a zone-shaped `to:'Graveyard'`
want OR an event-shaped `event:'dies'` want, exactly the two shapes a
`dies` fact could ever satisfy pre-merge/post-merge respectively. This is
narrower than the "let one fact satisfy BOTH shape-families' wants at
once" open item the "Fact unification" section above still tracks as
unsolved in general (this fix is scoped to exactly one producer event
kind, `destroy`, not a general re-architecture of `factsInteract`'s own
shape gate) — but it's the same underlying idea, applied where a real card
needed it.

**The matching logic itself, `satisfiesDestroyImpliesDies`**:
- Against a `to:'Graveyard'`-shaped or `target`-object `event:'dies'`-shaped
  want with a `types` constraint: checks the destroy's own GUARANTEED types
  (`target.types.has` only — `hasAny`/`not`/absent guarantees nothing
  type-specific) against the want's `types` constraint via the same
  `satisfiesType` helper `Constraints.types` already uses everywhere else.
  Declines outright for a want with any `cmc`/`power`/`toughness`/`name`/
  `amount` constraint — no real pool sink needs more than `types` on a
  graveyard-arrival want today (checked).
- Against a `target:'self'`-shaped `event:'dies'` want ("when THIS creature
  dies"): a genuinely WEAKER claim than the guaranteed-type check above —
  not "does this destroy guarantee killing something of this type" but
  "could the wanting card ITSELF legally be this destroy's own victim."
  Mirrors the general event-matching branch's own existing `we.target ===
  'self'` handling for any OTHER event kind (`satisfiesConstraints(
  staticAttrsFor(wCard.card), pe.target)`) rather than reinventing a
  parallel mechanism — this is exactly the "satisfy the SAME sinks through
  the SAME matching path" requirement this task was built to honor.
  Declines when the destroy has no `target` filter at all (an unrestricted
  "destroy target permanent" does NOT vacuously match every self-dies want
  in the pool — that would be a broad new invention no removed fact ever
  backed, since an unrestricted destroy's own OLD `dies` fact always
  carried real `from`/`to` and was therefore never event-only-shaped/
  reachable by this branch in the first place).

**Two real regressions this needed to guard against, found by an actual
before/after `find-synergies.mjs` diff, not assumed**: Lunatic Pandora's
and Sephiroth's Intervention's own on-disk `dies` companion facts predated
the `from`/`to` fields this recognizer family now always sets (a real,
separate staleness bug — never regenerated after that field became
unconditional) — being accidentally EVENT-only shaped, they were
reachable by the general matcher's own `we.target === 'self'` branch
against 5 real self-dies wants (Aerith Gainsborough, Ancient Adamantoise,
Dwarven Castle Guard, Garland Knight of Cornelia, Undercity Dire Rat) in a
way a CORRECTLY-shaped (zone+event) `dies` fact never could have (the
shape-partition gate blocks a zone+event fact from ever satisfying a pure
event-only want — this file's own "Fact unification" section already
documents this as the accepted, standing regression for EVERY zone+event
merged fact, not something new here). Removing the stale fact without
covering this case would have silently dropped those 5 real matches —
caught by the required pair-level diff (`(producer, wanter)` card pairs,
not raw line counts, since most of the line-level diff is expected label
deduplication for a pair that already matches some other way), not by
inspection.

**Full-pool verification (`find-synergies.mjs`, before whole task vs.
after)**: pair-level diff shows **zero real `(producer, wanter)` card-pairs
lost any edge** — every match the old `dies` fact used to provide survives,
either via the widened `destroy` match or because the pair already had a
different edge and the removed report line was a pure duplicate label for
the same real relationship. Net new real matches this widening closes for
the first time (previously unreachable even with BOTH the `destroy` and
`dies` facts on disk, since the `dies` fact's own zone-branch match needs a
`subject` field the destroy-effect recognizer never set): Ardyn the
Usurper, Al Bhed Salvagers, Jenova Ancient Calamity, G'raha Tia. `npx tsc
--noEmit`/`npx vitest run functional-model` clean (no new errors/failures);
`scripts/verify-synergy.mjs` full pool: 320 checked, 0 hard failures,
unchanged; `data/fin/fin_card_status.json` regenerated, 0 cards changed
status/reasons.
