# Sink model — conceptual design

What `sink-model/` actually IS, end to end, and why it's shaped the way
it is. Every file under `sink-model/` has its own implementation-detail
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
  `SinkInstance` (`sink-model/catalog/entry.ts`) is a real, directly
  callable value: `instance(candidate, root?) => SinkMatchDetail | null`.
  That callable signature — not a passive data record — IS the "Sink"
  node in this chain: it's the thing that actually mediates the
  Self-vs-Candidate relationship. (`self`/`candidate` terminology and the
  callable-instance shape are both real, current code — see
  `SinkInstance`'s own doc comment, `catalog/entry.ts`, and
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

`sink-model/predicates/*.ts` (`saga.ts`, `crew.ts`, `lifelink.ts`) are
exactly this: each is a direct function that reads a candidate's
compressed field(s) — a keyword, a type-line/subtype pattern, a
`crewCost` — and derives the real, un-compressed occurrence a
`SinkQuery` can actually compare against. Concretely,
`lifelinkProductionOccurrences` (`predicates/lifelink.ts`) turns
`card.keywords?.includes('Lifelink')` into a real
`{event:'lifegain', controller:'you'}` `ProducerOccurrence` — the exact
same shape a card with a literal `gainLife` `Effect` node would produce,
so a `Lifegain` sink can't tell the difference between "genuinely has a
`gainLife` effect" and "prints Lifelink" once the predicate has run.
`match-sink.ts`'s `deriveOccurrences(card, root)` is where this actually
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
a `SinkInstance` needs, and there is no dedicated `appliesToSelf()`-style
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
`matchSink(entry.query, self, root)` check it runs against every other
candidate, then FILTERS on which side of the returned detail is
considered "good enough" for self-display. For most entries,
`selfDirectProducerMatch || selfConsumerMatch` (either side alone is
enough). For the Battlefield-presence family specifically, the
`requireConsumerForSelfOwnership` flag (a plain config field on
`SinkCatalogEntry`, `catalog/entry.ts` — not a method, not new sink-level
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

### 2. "Narrow the sink down to Self's own parameters" — the `SinkFamily<Config>` factory

`SinkFamily<Config> = (config: Config) => SinkInstance` (`catalog/
entry.ts`) is exactly this narrowing operation, landed as a real,
generic factory shape (`BattlefieldPresenceSink(config)`/
`CountersSink(config)`, `catalog/families/battlefield-presence.ts`/
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
specific, fully-configured `SinkInstance`. Nothing about the shared
matcher logic (`matchesBattlefieldPresenceConsumer`, `matchSink`)
changes per instance; only the configuration does. Each family's own
`getName(config)` internal function (2026-09-18) derives the display
`category` from the config's own other structural fields rather than
accepting it as a separately-authored field — `CountersSinkConfig`'s
`counterType` string IS the category verbatim; `BattlefieldPresenceSink`'s
`getName` maps its `filter` (`{subtype}` pluralizes; `{sameNameAsSelf:
true}` is a hardcoded special case) to the category instead, so there's
no parallel `category` field that could drift out of sync with the rest
of a configuration.

### 3. "The instance sink is applicable to Candidate" — the callable contract

This is the `SinkInstance` callable contract itself:
`instance(candidate, root?) => SinkMatchDetail | null`. Every
`SinkCatalogEntry` built by a family factory is ALSO directly callable —
a plain function value with the entry's own data fields
(`slug`/`query`/`consumerTriggerNames`/...) assigned onto it — so a
caller can run one instance against one candidate and get back
structural match detail (`producer`/`consumer`, each naming which real
signal matched) in a single call, uniformly across every family member,
instead of hand-checking `matchSink`/`matchesConsumerTriggerNames`/
`matchesConsumerTriggerOn`/`matchesBattlefieldPresenceConsumer`
separately per entry. This is additive — no existing production call
site (`card-interactions.ts`, the sink-catalog review API route) invokes
an entry as a function today, they still read its plain data fields —
but it's the real, current embodiment of "is this sink instance
applicable to this candidate" as a single, first-class operation.

### 4. UI naming — "Battlefield Presence applying only to Cats should just say Cats"

**Already true for the surface that matters most (a card's own
Interactions/Sinks list) — verified directly against the running code,
not assumed.** `SinkCatalogEntry.query.category` is the real, per-INSTANCE
display label, authored once per configuration: `'Cats'`, `'Creatures'`,
`'Same-name copies'`, `'+1/+1'` — never the generic family
name `'battlefield-presence'`/`'counters'`. `card-interactions.ts`'s
`computeCardInteractions` groups its output by `entry.query.category`
(line: `const category = entry.query.category;`), so a card matching the
Cats configuration shows a row literally labeled "Cats," never "Battlefield
Presence." This is not a coincidental byproduct of the factory refactor —
`BattlefieldPresenceSinkConfig`/`CountersSinkConfig` both require the
caller to author a real, specific `category`/`query.category` per
configuration precisely so this label exists per instance, not per family.

**The one place the GENERIC family name legitimately does surface** is the
review-status dashboard (`sink-catalog-status.ts`'s `FAMILY_LABELS`,
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
a second real `CountersSink` configuration exists, a card caring about
both `+1/+1` and `-1/-1`). **What a card's own page shows must be at the
INSTANCE level, never rolled up to family** — two separate rows ("Cats",
"Creatures"), never one collapsed "Battlefield presence" row. This is
confirmed true in the current code, not just asserted:

- `SINK_CATALOG` (`catalog/index.ts`) is a flat array of individual
  `SinkInstance` values — `battlefieldPresenceCats`,
  `battlefieldPresenceCreatures`, and `battlefieldPresenceHareApparent`
  are three separate array entries, never grouped into one family object
  at this layer.
- `card-interactions.ts`'s `computeCardInteractions` iterates
  `SINK_CATALOG` directly (`for (const entry of SINK_CATALOG)`) and keys
  its output map by `entry.query.category` — i.e., by INSTANCE, not
  family. It imports only `isSinkCatalogEntryUsable` from
  `sink-catalog-status.ts` (the blue/usable gate) — it never imports or
  calls `computeSinkCatalogStatus`/`computeSinkCatalogColor` (the
  family-grouping functions), so nothing in the card-page code path ever
  collapses two instances of the same family into one row. A card
  matching both Cats and Creatives would produce two independent map
  entries and therefore two independent output rows.
- Family-level grouping is genuinely confined to
  `sink-catalog-status.ts`'s `computeSinkCatalogStatus` (grouping key:
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
`matchSink`'s constraint comparison is plain equality/range checks;
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
(`sink-catalog-status.ts`'s gray/purple/blue/yellow/green/re-review
ladder, `.claude/contracts/sink-derivation-status-schema.md`'s sibling
axis for the predicate family) — nothing else in this pipeline needs
one, because nothing else in this pipeline requires a human judgment
call to get right in the first place.

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
