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
// object in a zone
{ "role": "source", "zone": "Battlefield", "controller": "you", "subject": "self" }
{ "role": "sink",    "zone": "Battlefield", "controller": "you",
  "types": { "has": ["Creature", "Legendary"] } }

// event
{ "role": "source", "event": "lifegain",   "controller": "you" }
{ "role": "sink",    "event": "dies",       "target": "self" }
{ "role": "source", "event": "putCounter", "counterType": "+1/+1", "controller": "you",
  "target": { "types": { "has": ["Creature", "Legendary"] } } }
```

Rules:

- **Two shapes, not one.** A fact has either `zone` (a persistent object)
  or `event` (an occurrence). The matcher branches on which is present.
  Do not unify them.
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
  `functional-model/synergy.ts`'s `annotateCardText` uses it to turn the
  card page's real oracle text into an inline-linked view (see
  `app/components/FunctionalModelText.vue`) — a fact with no `highlight` just
  isn't clickable there, still visible in the plain facts table.
- **Known gap, not fixed here:** both live call sites
  (`server/api/graph-links.ts`, `server/api/card/[set]/[number].ts`) call
  `findInteractionsForCard(name, pool)` with no `tokens` argument, so a
  token-subject produce never resolves real static attributes at match
  time (only `compute-weights.mjs`'s own stored `ease` numbers use real
  token data, via an adapter from `tokens.ts`'s `TokenInfo` shape to
  synergy.ts's `TokenLike` shape).

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
