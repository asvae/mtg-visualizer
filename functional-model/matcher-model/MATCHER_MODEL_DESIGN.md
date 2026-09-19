# Sink model — conceptual design

What `matcher-model/` actually IS, end to end, and why it's shaped the way
it is. Every file under `matcher-model/` has its own implementation-detail
doc comments (per-mechanic reasoning, real Forge citations, corpus
provenance) — this doc doesn't repeat those. It's the one place that
explains the conceptual chain connecting them, for someone who needs the
"why does this look like this" answer before touching any one file.

Owner: `schema` agent (see `.claude/agents/schema.md`). Companion to
`functional-model/SYNERGY_DESIGN.md` (FIN's older, still-current
paired-Fact model — see that doc's own top-of-file pointer to here) and
`.claude/contracts/sink-derivation-status-schema.md` (the review-status
axis for the predicate family described below).

## The one-sentence version

A card's real behavior is compressed into a small vocabulary
(`CardDefinition.keywords`); a **sink** is a curated question that
un-compresses both sides of a candidate pairing just enough to answer
"does this card belong to this synergy category" — and building/curating
that question well is genuinely the one place in this whole pipeline
that needs a human judgment call, everything downstream of it is meant
to be mechanical.

## The chain: Self → Sink → (Predicates) → Candidate

Every sink-catalog match is really asking one question from one card's
point of view about another card:

- **`self`** — the card whose page/context is asking ("what synergy
  categories do I belong to, and who else is in them with me").
- **`candidate`** — the card being tested against one specific sink.
- **Sink** — the thing standing *between* them. Concretely, a
  `Matcher` (`matcher-model/catalog/entry.ts`) is a real, directly
  callable value: `instance(candidate, root?) => SinkMatchDetail | null`.
  That callable signature — not a passive data record — IS the "Sink"
  node in this chain: it's the thing that actually mediates the
  Self-vs-Candidate relationship. (`self`/`candidate` terminology and the
  callable-instance shape are both real, current code — see
  `Matcher`'s own doc comment, `catalog/entry.ts`, and
  `card-interactions.ts`'s own "Terminology" note.)
- **Predicates** — the mechanism the Sink uses internally to answer the
  question honestly, described next.

## Why "compressed" is the right word for `CardDefinition`

`CardDefinition.keywords: Keyword[]` is a closed, compact vocabulary —
`'Lifelink'`, `'Flying'`, `'Trample'` — standing in for real, spelled-out
game behavior that the engine (not the schema) knows how to execute.
That compression is real, not just a style choice: a bare string match
against `keywords.includes('Lifelink')` can answer "does this card print
Lifelink," but it CANNOT by itself answer the actual synergy question a
sink cares about — "does this card cause its controller to gain life."
Those are different questions that happen to correlate. The printed
keyword is the compressed form; "this card causes a `{event:'lifegain',
controller:'you'}` occurrence whenever it deals damage" is the
un-compressed, matchable form. A sink query is written against the
un-compressed shape, never the bare keyword string — matching a sink
means someone (a predicate, or a structural effect walk) has already
done the decompression work.

## Predicates: the uncompression mechanism

`sink-derivation-predicates/*.ts` (`saga.ts`, `crew.ts`, `lifelink.ts`) are
exactly this: each is a direct function that reads a candidate's
compressed field(s) — a keyword, a type-line/subtype pattern, a
`crewCost` — and derives the real, un-compressed occurrence a
`MatcherQuery` can actually compare against. Concretely,
`lifelinkProductionOccurrences` (`predicates/lifelink.ts`) turns
`card.keywords?.includes('Lifelink')` into a real
`{event:'lifegain', controller:'you'}` `ProducerOccurrence` — the exact
same shape a card with a literal `gainLife` `Effect` node would produce,
so a `Lifegain` sink can't tell the difference between "genuinely has a
`gainLife` effect" and "prints Lifelink" once the predicate has run.
`match-query.ts`'s `deriveOccurrences(card, root)` is where this actually
happens: it walks a candidate's `effects`/`triggers[].effects`/`program`
AST nodes directly (the structural, no-keyword-needed cases — most
`Effect.kind` values need no predicate at all, decompression is trivial
because the effect node already says what it does), and *also* calls out
to the predicate family for the handful of mechanisms whose real
consequence is emergent from generic engine automation rather than
anything visible on the `CardDefinition` itself (Saga chapter-completion
sacrifice, Crew's tap-cost path, Lifelink's automatic lifegain). Every
occurrence a predicate contributes is marked
`ProducerOccurrence.predicateDerived: true` — a genuine, tracked
distinction from a directly-authored effect, consulted specifically by
`card-interactions.ts`'s self-ownership gate (see below): predicate-
derived evidence is trusted to make some OTHER card's sink match, but
never trusted alone to make `self` claim ownership of a category on its
own page (a predicate infers a structural consequence the engine
guarantees; it isn't a "this card was deliberately authored to do X"
claim the way a real effect node is).

## The Sink's own responsibilities

The user's own framing lists four real jobs a sink does. Each maps to
concrete, current code:

### 1. "Does this sink apply to Self at all" — the self-ownership gate

This is genuinely the rarest of the four — as the user put it, "there
isn't a lot of effect like that." Important to be precise about what
kind of "special" this is: **self-checking is NOT a separate capability
a `Matcher` needs, and there is no dedicated `appliesToSelf()`-style
method anywhere in this design, nor should there be.** It's the exact
same callable contract described in §3 below —
`instance(candidate, root?) => SinkMatchDetail | null` — invoked with
`self` passed as the `candidate` argument. "Applying to the same card
that's asking" is nothing special at the sink level: same function, same
code path, `self` just happens to be the candidate this particular time.

What IS real and deliberate is what happens to the RESULT afterward —
purely external, post-processing logic in `card-interactions.ts`, not
anything the sink itself does differently. A `SinkMatchDetail` already
separates `producer` (this card structurally causes the event) from
`consumer` (this card structurally reacts to/cares about the event); when
checking whether `self` OWNS a category enough to display it on its own
page, `card-interactions.ts`'s `computeCardInteractions` computes
`selfDirectProducerMatch`/`selfConsumerMatch` by calling the exact same
per-entry match (`matchEntry`, a small local helper added 2026-09-18 when
`CountersMatcher` stopped always carrying a `query` — see "MatcherQuery becomes
optional" below) it runs against every other candidate, then FILTERS on
which side of the returned detail is considered "good enough" for
self-display. For most entries,
`selfDirectProducerMatch || selfConsumerMatch` (either side alone is
enough). For the Battlefield-presence family specifically, the
`requireConsumerForSelfOwnership` flag (a plain config field on
`MatcherCatalogEntry`, `catalog/entry.ts` — not a method, not new sink-level
behavior) narrows that filter down to `selfConsumerMatch` alone — a bare
`producer` match (trivial type/subtype membership, e.g. "this card IS a
Cat") doesn't count, only a genuine `consumer` signal does. The
motivating bug was real (Helpful Hunter, a printed Cat with no
cost-reduction/anthem effect of its own, self-displaying "Cats" purely
for existing) — merely BEING a Cat/Creature is passive membership, not a
deliberate authored ability, and the fix is entirely in how the EXTERNAL
caller interprets the match result, never a new capability on the sink
itself. So: the "does this benefit
Self" question is mostly free (a side effect of the ordinary match), and
the one place it needed real thought was building the guard that stops
passive membership from over-claiming it.

### 2. "Narrow the sink down to Self's own parameters" — the `MatcherFamily<Config>` factory

`MatcherFamily<Config> = (config: Config) => Matcher` (`catalog/
entry.ts`) is exactly this narrowing operation, landed as a real,
generic factory shape (`BattlefieldPresenceMatcher(config)`/
`CountersMatcher(config)`, `catalog/families/battlefield-presence.ts`/
`catalog/families/counters.ts` — each family's shared factory lives in
its own `families/` module, separate from each concrete instance's own
small `catalog/<slug>.ts` config file, e.g. `catalog/counters-
plus1plus1.ts`/`catalog/battlefield-presence-cats.ts`). A family
encodes one shared underlying MECHANIC ("cares about the board-state
count of a filtered set of permanents you control"; "puts counters of
some type"), genericized over the one axis that varies (a
`subtype`/`sameNameAsSelf` filter; a `counterType` string). Calling the
factory with one concrete configuration — Cats, Creatures, Same-name
copies, `+1/+1` — IS the act of narrowing the family down to one
specific, fully-configured `Matcher`. Nothing about the shared
matcher logic (`matchesBattlefieldPresenceConsumer`, `matchQuery`)
changes per instance; only the configuration does. Each family's own
`getName(config)` internal function (2026-09-18) derives the display
`category` from the config's own other structural fields rather than
accepting it as a separately-authored field — `CountersMatcherConfig`'s
`counterType` string IS the category verbatim; `BattlefieldPresenceMatcher`'s
`getName` maps its `filter` (`{subtype}` pluralizes; `{sameNameAsSelf:
true}` is a hardcoded special case) to the category instead, so there's
no parallel `category` field that could drift out of sync with the rest
of a configuration.

### 2b. MatcherQuery becomes optional, `CountersMatcher` migrates off it (2026-09-18)

Until this pass, EVERY family instance's own producer-matching mechanism
was the same two-step indirection: build a `MatcherQuery` (a reified,
curated object — `{category, event, counterType, controller, ...}`),
then hand it to `matcher-model/match-query.ts`'s generic `matchQuery`/
`occurrenceSatisfiesQuery` comparator, which walks `deriveOccurrences`
output and compares each occurrence against the query's own fields. Per
the user's own explicit correction — "Matcher family should produce sink
out of card definition. Not out of magical query... each matcher family's
matcher function should directly inspect the candidate... written as
real code in the function body, not built as a standalone object handed
to a generic comparator" — `CountersMatcher` (`catalog/families/
counters.ts`) now skips the `MatcherQuery` step entirely for its own
producer check: it still calls `deriveOccurrences(candidate, root)` (the
real, structural, `CardDefinition`-derived occurrence walk — genuinely
reused, not reimplemented; this IS "produce sink out of card
definition"), but the MATCHING condition itself is real, inline code in
the factory's own function body (`occ.event === 'putCounter' &&
occ.counterType === counterType`, plus a small inline controller-
compatibility check mirroring `match-query.ts`'s own private
`effectiveController`/`sidesCompatible` helpers) — no `MatcherQuery` object
constructed, no generic comparator invoked.

**Real, mechanical consequences, not just an internal refactor**:
- `MatcherCatalogEntry.query` (`catalog/entry.ts`) is now OPTIONAL — a
  `CountersMatcher` instance has none at all (`undefined`, never a
  synthesized display-only stand-in — the user explicitly rejected that:
  "just put these mock definitions somewhere within test," i.e. the
  family's own unit test (`counters.test.ts`) IS the real "what does
  this sink look for" documentation now, not a serialized query object).
  A new `MatcherCatalogEntry.category?: string` field covers the one real
  purpose `query.category` used to serve for a query-less entry — see
  "UI naming" above for the full `entry.category ?? entry.query?.category`
  read pattern every consumer now uses.
- Every consumer that used to read `entry.query` unconditionally had to
  learn to tolerate `undefined`: `card-interactions.ts` (a new local
  `matchEntry` helper — routes a callable `Matcher` through its own
  `entry(candidate, root)` call, falls back to direct `matchQuery(entry
  .query!, ...)` only for a plain non-callable entry, which always still
  has a real query), `server/api/sink-catalog/index.get.ts` (serves
  `query: members[0]?.query` — genuinely `undefined` for Counters, not a
  fallback object — and the review page conditionally renders the
  "Curated MatcherQuery" panel only when present), `matcher-catalog-status.ts`
  (`category` fallback, above).
- **`BattlefieldPresenceMatcher` has NOT migrated** — still builds a real
  `MatcherQuery` and calls `matchQuery` for its own producer check
  (`catalog/families/battlefield-presence.ts`, unchanged). This was a
  deliberate, scoped-down first step ("scoped to Counters only... a
  deliberate, incremental first step") to validate the pattern before
  touching the second family. Confirmed zero behavior regression for
  Counters: the real FDN pool's own producer/consumer match sets (19
  source candidates, 1 sink candidate — Exemplar of Light) are
  byte-identical before and after, verified live against a running dev
  server both ways.

### 3. "The instance sink is applicable to Candidate" — the callable contract

This is the `Matcher` callable contract itself:
`instance(candidate, root?) => SinkMatchDetail | null`. Every
`MatcherCatalogEntry` built by a family factory is ALSO directly callable —
a plain function value with the entry's own data fields
(`slug`/`query`/`consumerTriggerNames`/...) assigned onto it — so a
caller can run one instance against one candidate and get back
structural match detail (`producer`/`consumer`, each naming which real
signal matched) in a single call, uniformly across every family member,
instead of hand-checking `matchQuery`/`matchesConsumerTriggerNames`/
`matchesConsumerTriggerOn`/`matchesBattlefieldPresenceConsumer`
separately per entry. This is additive — no existing production call
site (`card-interactions.ts`, the sink-catalog review API route) invokes
an entry as a function today, they still read its plain data fields —
but it's the real, current embodiment of "is this matcher
applicable to this candidate" as a single, first-class operation.

### 4. UI naming — "Battlefield Presence applying only to Cats should just say Cats"

**Already true for the surface that matters most (a card's own
Interactions/Sinks list) — verified directly against the running code,
not assumed.** The real, per-INSTANCE display label — authored once per
configuration: `'Cats'`, `'Creatures'`, `'Same-name copies'`, `'+1/+1'` —
never the generic family name `'battlefield-presence'`/`'counters'`.
Until 2026-09-18 this always lived at `MatcherCatalogEntry.query.category`;
since `CountersMatcher`'s own instances dropped `query` entirely (see
"MatcherQuery becomes optional, `CountersMatcher` migrates off it" below), the
real read is `entry.category ?? entry.query?.category` — `CountersMatcher`
sets the new top-level `category` field directly (still `'+1/+1'`,
identical label, just no longer nested under a query object);
`BattlefieldPresenceMatcher` (unmigrated) still sets only `query.category`,
so the `?? entry.query?.category` fallback is what still resolves 'Cats'/
'Creatures'/'Same-name copies' for it. `card-interactions.ts`'s
`computeCardInteractions` groups its output by this same resolved value
(`const category = entry.category ?? entry.query!.category;`), so a card
matching the Cats configuration shows a row literally labeled "Cats,"
never "Battlefield Presence." This is not a coincidental byproduct of the
factory refactor — `BattlefieldPresenceMatcherConfig`/`CountersMatcherConfig`
both require the caller to author a real, specific per-configuration
category precisely so this label exists per instance, not per family.

**The one place the GENERIC family name legitimately does surface** is the
review-status dashboard (`matcher-catalog-status.ts`'s `FAMILY_LABELS`,
served by `server/api/sink-catalog/index.get.ts`) — and that's a
deliberately different, review-workflow question ("what sink concepts
exist to review, and is this whole family's shared matcher logic
correct"), not a card-facing synergy label. See the next section for why
these two surfaces are intentionally different granularities, not a
gap.

**No real gap found here.** This is one place the user's own worked
example ("should just have name Cats") is already exactly what the code
does — flagged as confirmed-correct rather than left unverified.

## Family granularity (review) vs. instance granularity (card page) — two deliberately different questions

A single real card can genuinely own 2+ instances from the same family
at once (a hypothetical card caring about both Cats and Creatures; once
a second real `CountersMatcher` configuration exists, a card caring about
both `+1/+1` and `-1/-1`). **What a card's own page shows must be at the
INSTANCE level, never rolled up to family** — two separate rows ("Cats",
"Creatures"), never one collapsed "Battlefield presence" row. This is
confirmed true in the current code, not just asserted:

- `MATCHER_CATALOG` (`catalog/index.ts`) is a flat array of individual
  `Matcher` values — `battlefieldPresenceCats`,
  `battlefieldPresenceCreatures`, and `battlefieldPresenceHareApparent`
  are three separate array entries, never grouped into one family object
  at this layer.
- `card-interactions.ts`'s `computeCardInteractions` iterates
  `MATCHER_CATALOG` directly (`for (const entry of MATCHER_CATALOG)`) and keys
  its output map by `entry.category ?? entry.query!.category` — i.e., by
  INSTANCE, not family. It imports only `isMatcherCatalogEntryUsable` from
  `matcher-catalog-status.ts` (the blue/usable gate) — it never imports or
  calls `computeMatcherCatalogStatus`/`computeMatcherCatalogColor` (the
  family-grouping functions), so nothing in the card-page code path ever
  collapses two instances of the same family into one row. A card
  matching both Cats and Creatives would produce two independent map
  entries and therefore two independent output rows.
- Family-level grouping is genuinely confined to
  `matcher-catalog-status.ts`'s `computeMatcherCatalogStatus` (grouping key:
  `entry.family ?? entry.slug`), consumed ONLY by
  `server/api/sink-catalog/index.get.ts` — the `/app/engine/sinks`
  review-dashboard route. That grouping exists because a human reviewer
  verifies a whole family's SHARED matcher/factory logic once (one
  review verdict for "Battlefield presence" as a mechanism), not because
  the underlying matches themselves are family-scoped.

So: **review browses by family** (what shared mechanisms exist and are
they correct), **a card's own page reports by instance** (what does this
specific card actually do) — two different questions at two
intentionally different granularities, and the code already keeps them
separate rather than accidentally conflating them.

## The thesis: this is the one place genuine judgment concentrates

Every OTHER stage in this pipeline is meant to be boring, mechanical,
and deterministic by design: `deriveOccurrences`'s structural effect-walk
has no discretion (an `Effect.kind` either has a case or it doesn't);
`matchQuery`'s constraint comparison is plain equality/range checks;
`gate-and-write-status.mjs`/the FDN authoring gate is a mechanical
pass/fail over real spans; even the predicates
(`saga.ts`/`crew.ts`/`lifelink.ts`) are direct, deterministic functions
answering one closed question with no invented judgment call. None of
that is where this system's real intelligence lives.

The sink catalog IS where it lives — deciding what counts as one real,
reusable synergy CONCEPT (is "Cats" its own concept or a special case of
"Creatures"? does Hare Apparent's self-name-counting idiom deserve its
own configuration or does it force-fit into an existing filter shape?
does "Battlefield presence" even need review as one family, or as three
independent claims?) is a genuine curation decision, not something
derivable mechanically from a `CardDefinition`. That's exactly why the
catalog gets its own human-review axis at all
(`matcher-catalog-status.ts`'s gray/purple/blue/yellow/green/re-review
ladder, `.claude/contracts/sink-derivation-status-schema.md`'s sibling
axis for the predicate family) — nothing else in this pipeline needs
one, because nothing else in this pipeline requires a human judgment
call to get right in the first place.

### 2c. `CountersMatcher` takes a real `CardDefinition` directly — no config object at all (2026-09-19)

Per the user's own explicit instruction — "I don't care about magical
configuration file. Sink(definition). Got it?" — `CountersMatcher`'s public
signature is now `CountersMatcher(definition: CardDefinition): Matcher`.
There is no `CountersMatcherConfig` anymore, not even as an internal type: the
`slug`/`category`/`consumerTriggerNames` a hand-authored config object used
to carry are ALL derived from `definition`'s own real structural fields at
construction time, by small, private, pure helper functions in
`catalog/families/counters.ts` (`deriveCounterType`/`slugForCounterType`/
`deriveConsumerTriggerNames`) — the user was explicit that HOW this
derivation happens internally didn't matter ("Or do some
Sink(extractConfig(definition))... I don't care"), only that the PUBLIC call
takes a real `CardDefinition`. `catalog/counters-plus1plus1.ts` now calls
`CountersMatcher(exemplarOfLight)` (the real FDN #11 `CardDefinition`) instead
of a literal `{slug, counterType, consumerTriggerNames}` object.

This also sharpens the chain this doc's own "The chain" section above
names: the user's own later diagram for it was **`Self Definition → Sink →
(Predicates) → Candidate Definition`**, concretely
`MatcherFamily(matcherCandidateDefinition) -> (Predicates) -> Candidate
Definition`. Read against real code: `MatcherFamily(matcherCandidateDefinition)`
is the family-factory call (`CountersMatcher(definition)`) — `definition` here
IS `self`, the card that OWNS this sink; the returned `Matcher`'s own
existing callable contract (`instance(candidate, root?) => SinkMatchDetail
| null`) is unchanged and already covers the "Candidate Definition" half —
no new call shape was needed there. The one genuinely new piece: the
middle "(Predicates)" step is now a real, NAMED piece of code —
`withPredicates(counterType, consumerTriggerNames)` (a small closure factory
in `families/counters.ts`, closing over this ONE configured instance's own
derived fields) returns `{producer, consumer}`, two named predicate
functions the sink's own callable body invokes instead of inlining the
match checks directly. Not a generic predicate-composition framework —
just making the step visible in the code instead of leaving it anonymous
logic inside the closure, per the user's own explicit ask.

Derivation rules, each documented at its own helper function
(`catalog/families/counters.ts`):
- **`counterType`** — the first real `putCounter`/`putCounterTarget`/
  `putCounterAll` effect found walking `definition.effects` AND
  `definition.triggers[].effects` (the SAME two places `deriveOccurrences`'s
  own `walkEffects` looks, scoped down to just the one driving definition
  being configured rather than an arbitrary runtime candidate). Exemplar of
  Light's own `onLifeGain` trigger (`{kind:'putCounter', counterType:
  '+1/+1', ...}`) resolves `counterType` to `'+1/+1'`. Throws — loudly, not
  silently — if `definition` has no such effect at all: `CountersMatcher` only
  makes sense called with a card that genuinely drives this family.
- **`slug`** — deterministically sanitized FROM `counterType` itself
  (`'+1/+1'` -> `'counters-plus1plus1'`, `'-1/-1'` -> hypothetically
  `'counters-minus1minus1'`), not authored separately — reproduces the real,
  pre-existing slug byte-for-byte, so every filesystem/review-status
  convention keyed off `entry.slug` (`matcher-catalog-status.ts`'s
  `sourceFileFor`/`computeMatcherCatalogFingerprint`/`memberEvidenceFor`, all
  of which resolve `catalog/${slug}.ts`/`catalog/${slug}.corpus.json`
  directly) keeps resolving to the real, UNRENAMED
  `catalog/counters-plus1plus1.ts`/`.corpus.json` files with zero changes
  needed anywhere else.
- **`consumerTriggerNames`** — the genuinely ambiguous one. Investigated
  first whether "this trigger has no `on` field at all" was already a
  meaningful, reserved discriminator for "reacts to a counter being added"
  elsewhere in the codebase (`card.ts`'s own `Trigger.on` doc comment,
  `match-query.ts`) before assuming it — it is NOT: dozens of real,
  currently-shipped FDN/FIN triggers are name-only for reasons entirely
  unrelated to counters (not yet retrofitted onto a closed auto-fire
  occasion, fired only by a scenario's own `Scenario.trigger` field, or
  simply belonging to a still-wholly-unbuilt trigger family). Using absence
  of `on` alone would over-match any manually-named trigger a card happens
  to carry. The real, established signal instead: a small, explicit,
  family-owned allowlist of recognized `Trigger.name` spellings
  (`COUNTER_ADDED_TRIGGER_NAMES`, seeded with `'onCounterAdded'` — the one
  real, checked-in convention name already in the pool, per this family's
  own pre-2026-09-19 header comment), with a trigger EXCLUDED if it also
  carries a real `on` value (a real closed auto-fire occasion already
  explains it; a coincidental free-text name match on top of that is a
  collision, not a genuine second signal). Exemplar of Light's own
  `onCounterAdded` trigger (no `on`, name matches) is the one real hit;
  `onLifeGain` (real `on: 'lifeGained'`) is correctly excluded.

**Zero behavior regression, live-verified** (dev server, `GET
/api/sink-catalog` + `GET /api/card/fdn/11`): the real FDN pool's own
producer/consumer match sets for the `counters` entry are still exactly 19
source candidates / 1 sink candidate (Exemplar of Light, self-included),
byte-identical to the pre-2026-09-19 documented numbers; `entry.slug`
(`'counters-plus1plus1'`), `entry.category` (`'+1/+1'`), and
`entry.consumerTriggerNames` (`['onCounterAdded']`) all resolve identically
to before, now derived rather than authored. `counters.test.ts` no longer
imports the pre-built production singleton OR a `CountersMatcherConfig`
literal — it builds its own inline mock `CardDefinition` shaped like the
real Exemplar of Light and calls `CountersMatcher(mockDefinition)` directly,
per this file's own standing "everything visible in one file, mocks
inline" convention; 5 new derivation-focused test cases added (slug/
category/consumerTriggerNames correctness, a differently-typed driving
definition, the throw-on-no-producer-effect case, and both discrimination
edge cases for the `on`-field exclusion rule).

`BattlefieldPresenceMatcher` is UNCHANGED — still takes a hand-authored
`BattlefieldPresenceMatcherConfig` object, deliberately out of scope for this
pass (same "Counters only, one family at a time" precedent "MatcherQuery
becomes optional" above already established).

### 2d / 3b. The callable contract returns a plain `boolean` (producer-only); `MatcherFamily<Config>` returns `Matcher[]` (2026-09-19, later still)

The 3rd real design iteration on the `Matcher` callable contract this
week: `MatcherQuery`-based -> config-object-based -> `CardDefinition`-based
(sections 2b/2c above) -> now **boolean-return-based**. The user's own
explicit target shape, verbatim:
```ts
const matcher = MatcherFamily(matcherDefinition)
const booleanWeLookFor = matcher(sourceCandidateDefinition)
```
Two earlier proposed compromises — a boolean call plus separate
producer/consumer accessors; a call returning an all-boolean-fields object —
were both explicitly rejected ("both complete bullshit"). Read literally:
the call itself must return `true`/`false`, full stop.

**Section 3's own "`instance(candidate, root?) => SinkMatchDetail | null`"
is now HISTORICAL, not current** — left unedited above per this doc's own
"keep the running history intact" convention (same treatment section 2's
own now-stale `MatcherFamily<Config> = (config) => Matcher` line already
got from 2b/2c). The real, current contract is:

```ts
type Matcher = MatcherCatalogEntry &
  ((candidate: CardDefinition, root?: string) => boolean) & {
    isPredicateDerived?: (candidate: CardDefinition, root?: string) => boolean;
  };
```

**The call answers the PRODUCER question ONLY** — "does `candidate` itself
structurally produce this sink's event" — deliberately NOT the combined
producer-or-consumer question `SinkMatchDetail` used to answer. Verified
against every real consumer of the old combined return before scoping this
as a genuine simplification, not a loss of functionality:
- The CONSUMER check already lived as a fully separate, already-
  boolean-returning function (`matchesConsumerTriggerNames`/
  `matchesConsumerTriggerOn`/`matchesBattlefieldPresenceConsumer`,
  `match-query.ts`) — never actually routed through the callable for
  `counters.test.ts`'s own "SINK CANDIDATE" cases in the first place.
- Every real production reader of the old combined return
  (`card-interactions.ts`'s `matchEntry`, `server/api/sink-catalog/
  index.get.ts`'s `instanceProducerMatched`/`instanceConsumerMatched`)
  ALREADY reduced it to a boolean via `!!` immediately.
- `.via` (the debug string) was read nowhere in `app/`/`server/` —
  confirmed by grep, zero hits, safe to delete along with the rest of
  `SinkMatchDetail` (which no longer exists as a type at all).

Both real consumer-side call sites (`card-interactions.ts`'s `matchEntry`,
`server/api/sink-catalog/index.get.ts`'s `instanceConsumerMatched`) now call
the three consumer-check functions DIRECTLY against `entry`'s own plain data
fields (`consumerTriggerNames`/`consumerTriggerOn`/
`consumerBattlefieldPresence`), uniformly whether `entry` is callable or
not — a callable `Matcher` carries these same fields too (assigned by
its factory alongside `slug`/`query`/...), so there's no real distinction
left to branch on for the consumer question at all.

**`predicateDerived` survives as `Matcher.isPredicateDerived`, a
separate, optional accessor** — still genuinely needed:
`card-interactions.ts`'s `selfDirectProducerMatch = self.producerMatched &&
!self.predicateDerived` still distinguishes "this card's own authored
effect literally matches" from "this only matched via an inferred/
predicate-derived occurrence" (the Healer's Hawk/Felidar Savior
self-ownership fix, an earlier real bug fix this doc's own history already
covers) — a bare boolean genuinely can't carry that nuance, so it moved out
to its own small accessor rather than being dropped. `CountersMatcher`
re-derives it from its own `producerPredicate`'s occurrence;
`BattlefieldPresenceMatcher` re-exposes `matchQuery`'s own already-computed
`predicateDerived` field — both real, non-guessed implementations, not
placeholder stubs.

**`MatcherFamily<Config>` now returns `Matcher[]`, not one
`Matcher`** — a second, live user correction on the same design: "we
need array handling here obviously." A single driving `CardDefinition` is
not guaranteed to derive only ONE distinct matcher.
`CountersMatcher(definition)` concretely: a definition with `putCounter`-family
effects of more than one distinct `counterType` derives one `Matcher`
PER distinct `counterType` (`deriveCounterTypes`, plural — replaces the old
`deriveCounterType`, singular/first-match-wins, which silently discarded any
non-first counter type found on the same definition). Exemplar of Light
(the only real driving definition in the pool today) has exactly one
distinct `counterType`, so this is a single-element array in practice —
zero real behavior change for today's pool, only a widened, honest
contract.

**The general dedup principle (stated explicitly, per live user correction,
for whichever family migrates to this array-returning shape next)**: "we
should not have any absolutely identical sinks (i.e. when card has 2
locations for exactly the same effect), but any difference should create
separate sink." Two occurrences on the same definition that would derive the
exact SAME instance (e.g. the same `counterType` found both as a top-level
effect and inside a trigger) collapse to ONE instance in the returned array,
never a duplicate; a genuine difference (a different `counterType`) produces
a separate instance. For `CountersMatcher` specifically, `counterType` is the
COMPLETE identity key for an instance — every other derived field
(`slug`/`category`/`consumerTriggerNames`) is a pure function of
`counterType` plus the whole `definition`, never of which specific
occurrence produced that `counterType` — so deduping on the raw
`counterType` string (a `Set`) is the correct and COMPLETE implementation of
this rule for this family, not an approximation of it. A future family whose
own instance identity depends on more than one field would need its own,
wider dedup key (whatever fields actually determine THAT family's instance
identity), not this same single-string shortcut.

`BattlefieldPresenceMatcher` — conforming edit only, per this pass's explicit
scope: its own internal `MatcherQuery`/`matchQuery`-based matching logic is
UNCHANGED (still not migrated to the direct-inspection shape sections
2b/2c established for Counters). Its callable now returns a plain `boolean`
(producer-only, via `matchQuery(query, candidate, root).matched`) and gained
its own `isPredicateDerived` accessor; its factory now wraps its one real
instance in a single-element array (`return [sink];`) — a genuine,
structural degenerate case of the widened `MatcherFamily<Config>` contract, not
a special exception to it. All 3 real instance files
(`battlefield-presence-{cats,creatures,hare-apparent}.ts`) now read
`BattlefieldPresenceMatcher({...})[0]!`; `catalog/counters-plus1plus1.ts` reads
`CountersMatcher(exemplarOfLight)[0]!` — both real, structurally-justified
assertions (each config's own driving definition is fixed, known content,
not runtime-arbitrary input), not guesses.

**Zero behavior regression, live-verified** (real dev server): `GET
/api/sink-catalog` — `counters`: `blue`, 19 source-candidate / 1
sink-candidate (Exemplar of Light), byte-identical to the pre-existing
documented numbers; `battlefield-presence`: `blue`, 111 source-candidate / 4
sink-candidate, byte-identical. `GET /api/card/fdn/11`
(`functionalModel.cardInteractions`): Exemplar of Light's own `"+1/+1"` row
still `count: 19`, self included. `GET /api/card/fdn/6` (Claws Out):
`"Creatures"` row `count: 111`, `"Cats"` row `count: 10`. `/app/engine/
sinks/counters`, `/app/engine/sinks/counters-plus1plus1`, `/app/engine/
cards/fdn/11` all still resolve 200. `npx vitest run functional-model`: 120
files, 1347 passed / 5 skipped (net +3 vs. the prior 1344/5 baseline — new
`isPredicateDerived` coverage plus 2 new array/dedup derivation cases in
`counters.test.ts`, zero shrink). `npm run typecheck`: unchanged
7-diagnostic pre-existing baseline, zero new.

## Open items

- No further authoring gap found while writing this doc — the four
  responsibilities in the user's own framing all map cleanly onto real,
  current code, and the two granularity questions raised (per-instance
  UI naming; family-vs-instance display scope) are both already correct
  as verified above, not aspirational.
- `server/api/sink-catalog/index.get.ts` is mid-fix in a concurrent task
  as of this writing (not touched here) — nothing in this doc depends on
  that fix; the family-grouping behavior it serves was read, not edited,
  to write the section above.
- **`BattlefieldPresenceMatcher` still hasn't migrated off `MatcherQuery`/
  `matchQuery`, NOR off its own hand-authored config object** (see "MatcherQuery
  becomes optional" and "2c" above) — a real, deliberately-deferred
  follow-up, not forgotten. Once it does, `matchQuery`/`MatcherQuery`/
  `occurrenceSatisfiesQuery` (`match-query.ts`/`matcher-query.ts`) would have
  zero remaining callers inside `matcher-model/catalog/` itself (only
  `lifegain`/`graveyard-fodder`/`etb`, plain singleton entries, would still
  use them directly) — worth a real look at whether those three singletons
  should also migrate to the same direct-inspection, `Sink(definition)`
  shape at that point, or whether `matchQuery`/a config object stays
  legitimately in use for them long-term. Not decided here. (As of
  2026-09-19, the user separately floated discarding the whole existing
  sink implementation more broadly — "Right now it's complete bullshit" —
  but confirmed scope for THIS pass stayed Counters-only; whether that
  widens to the other four families is an open question for a future
  task, not decided or acted on here.)
