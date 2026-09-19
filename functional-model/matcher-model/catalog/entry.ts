// The `MatcherCatalogEntry` type itself — split into its own tiny file so
// `catalog/index.ts` (the registry) and every individual `catalog/<slug>.ts`
// module can both import it without a circular dependency between the
// registry and its own entries.
import type { CardDefinition, TriggerOnValue } from '../../card';
import type { MatcherQuery } from '../matcher-query';

/**
 * One reviewed, shared catalog entry — the QUESTION side of the sink-only
 * synergy experiment (see `functional-model/SYNERGY_DESIGN.md` and
 * `.claude/agent-memory/engine/notes.md`'s 2026-09-17/18 entries for the
 * full background). A catalog entry is NOT per-card, NOT bespoke storage —
 * a "bespoke" sink with only one real card wanting it is still just a
 * catalog entry with low reuse, per the user's own explicit correction; the
 * catalog is the ONE shared place every real sink lives, whether one card
 * or fifty cards end up wanting it.
 */
export interface MatcherCatalogEntry {
  /** Stable identity key — matches this entry's own filename
   * (`catalog/<slug>.ts`) and is also the review key
   * (`matcher-catalog-status.ts`'s review overlay). No per-card attachment
   * concept exists (tried, then reverted the same day it was built — see
   * `pipeline-status.ts`'s own header note) — which cards own/select for a
   * given sink is computed live, on the fly, by
   * `card-interactions.ts`, never persisted against this slug. Never reuse
   * a retired slug for a different mechanic. */
  slug: string;
  /**
   * The actual curated query — today's `sink` Fact shape minus
   * `annotations`/`provenance`/`role`/`triggeredBy` (`MatcherQuery`,
   * `matcher-model/matcher-query.ts`), plus its own real mechanic category label
   * (`query.category` — "Retrigger", "Lifegain", "Graveyard fodder", ...;
   * never a fixed generic metric pair).
   *
   * **Optional as of the 2026-09-18 `CountersMatcher` producer-mechanism
   * rewrite** (`catalog/families/counters.ts`) — a `MatcherQuery` was, until
   * then, unconditionally both (a) the entry's own PRODUCER-matching
   * mechanism (handed to `matcher-model/match-query.ts`'s generic
   * `matchQuery`/`occurrenceSatisfiesQuery` comparator) and (b) the review
   * page's inspectable "Curated MatcherQuery" debug panel. Per the user's own
   * explicit correction — "Matcher family should produce sink out of card
   * definition. Not out of magical query" / "just put these mock
   * definitions somewhere within test" (i.e. a mocked `CardDefinition` in
   * the family's own unit test IS the real "what does this sink look
   * for" documentation; a synthesized, unused `MatcherQuery` object just to
   * keep a display panel populated is exactly the "magical query"
   * indirection being removed, not a legitimate display-only survivor) —
   * `CountersMatcher`'s own producer check now inspects `deriveOccurrences`
   * output directly, inline, in its own function body, with NO `MatcherQuery`
   * constructed at all; its entry therefore has NO `query` field (`undefined`,
   * not a synthesized stand-in). `BattlefieldPresenceMatcher`/`lifegain`/
   * `graveyard-fodder`/`etb` are UNCHANGED — still build and rely on a real
   * `MatcherQuery` for their own producer matching, still always set `query`.
   * A caller reading `entry.query` must handle `undefined` (`card-
   * interactions.ts`'s per-entry loop and `server/api/sink-catalog/
   * index.get.ts`'s served `MatcherCatalogPageEntry.query` both do, as of the
   * same pass) — see `category` immediately below for the field an entry
   * without a `query` uses instead for its own display label.
   */
  query?: MatcherQuery;
  /**
   * Real, top-level display category label (2026-09-18, added alongside
   * `query` becoming optional) — the field an entry WITHOUT a `query`
   * (today, only `CountersMatcher`'s own instances) uses for its own display
   * category instead of `query.category`. Every entry that still has a real
   * `query` leaves this unset; a reader wanting "the" display category for
   * ANY entry should read `entry.category ?? entry.query?.category` (both
   * `card-interactions.ts` and `matcher-catalog-status.ts`'s own family-scoped
   * grouping already do the equivalent — see each file's own comment at its
   * read site). Not a general-purpose duplicate of `query.category` for
   * every entry — deliberately narrow, single real purpose: cover the one
   * real case where `query` itself no longer exists to carry a category at
   * all.
   */
  category?: string;
  /**
   * Real, structural CONSUMER-side recognition mode (2026-09-18, added
   * alongside the producer-only `query` above) — a candidate is ALSO
   * recognized as belonging to this category when one of its own
   * `CardDefinition.triggers[].name` values (front OR back face) appears in
   * this list, checked via `matcher-model/match-query.ts`'s
   * `matchesConsumerTriggerNames`. Pure structural field comparison against
   * `Trigger.name` itself — NEVER oracle/printed text (a sink must never
   * touch oracle text, per explicit user ruling 2026-09-18 — only
   * `CardDefinition`'s own structured fields). `Trigger.name` is a real,
   * deliberately-authored handle (`card.ts`'s own doc comment: "Matches a
   * scenario's own `trigger` field" — already a genuine, intentional
   * signal elsewhere in this codebase, not decoration); the long-standing
   * caution against trusting it (`card.ts`'s own `authoredFacts` doc
   * comment, `card-interactions.ts`'s own header) is specifically about
   * using it to drive ENGINE FIRING/simulation behavior, a materially
   * higher-stakes correctness concern than using it as a display/
   * categorization signal here, with this catalog's own human-reviewed
   * gate (`matcher-catalog-status.ts`) as the real check on false positives.
   * Optional — most catalog entries (anything with no real "reacts to this
   * category" trigger-naming convention in the pool) have none. A card can
   * satisfy an entry via the producer `query` OR this consumer signal OR
   * both; either is sufficient.
   */
  consumerTriggerNames?: string[];
  /**
   * Real, structural CONSUMER-side recognition mode via `Trigger.on` (2026-
   * 09-18, added for `etb`'s own "blink/bounce value" redesign) — a sibling
   * to `consumerTriggerNames` immediately above, checking the engine's own
   * real, CLOSED trigger-precondition enum (`card.ts`'s `Trigger.on` union)
   * instead of `Trigger.name` (a free-text label). Genuinely SAFER than
   * `consumerTriggerNames` — there's no name-collision risk at all, since
   * `on:'enter'` means exactly one real, auto-fired thing, always, for
   * every card that ever sets it. Checked via `matcher-model/match-query.ts`'s
   * `matchesConsumerTriggerOn`. `etb` declares `consumerTriggerOn: ['enter']`
   * — a card with a real ETB ability OWNS the "ETB" category (it's the
   * thing worth re-triggering) even though it doesn't itself PRODUCE the
   * bounce/blink effect that re-triggers it; the producer half of that same
   * category is the `query` field, matched against a real bounce-to-hand
   * `move` effect instead (see `catalog/etb.ts`'s own header for the full
   * "blink/bounce value" archetype writeup — the real, motivating user
   * correction to an earlier, wrong "no split needed" design).
   */
  consumerTriggerOn?: Array<TriggerOnValue>;
  /**
   * Real, structural CONSUMER-side recognition mode (2026-09-18, added for
   * the shared "Battlefield presence" catalog pair —
   * `catalog/battlefield-presence-cats.ts`/
   * `catalog/battlefield-presence-creatures.ts`) for a genuine "cares about
   * the board-state COUNT of a filtered set of permanents you control"
   * mechanic — a sibling to `consumerTriggerNames`/`consumerTriggerOn`
   * above, but checking a card's own `CostReduction.perControlled`/
   * `pumpAll`/`putCounterAll` fields instead of a `Trigger`. The real
   * motivating card is Claws Out (FDN #6): "Affinity for Cats" (a real
   * board-COUNTED cast-cost discount, `costReduction: {perControlled:
   * {amountPerMatch: 1, subtype: 'Cat'}}`) is the CATS case; "Creatures you
   * control get +2/+2" (a bare `pumpAll` with `predicate:
   * 'creatures-you-control'` and NO `subtype`) is the CREATURES case — the
   * SAME underlying concept ("this card's own effect/cost scales with how
   * many matching permanents you control"), just filtered by a different
   * subtype. Checked via `matcher-model/match-query.ts`'s
   * `matchesBattlefieldPresenceConsumer` — pure structural field
   * comparison, never oracle/printed text.
   *
   * `subtype` omitted (e.g. `{}`) means "no subtype filter at all" — the
   * generic CREATURES case, matched only against an equally
   * subtype-less `pumpAll`/`putCounterAll` (a `pumpAll` that DOES carry its
   * own real subtype filter, e.g. Circle of Power's own "Wizards you
   * control get...", does NOT satisfy the no-subtype filter — real
   * discrimination, not "matches anything"). The field being present at
   * all (even as `{}`) is what distinguishes "this entry has a
   * battlefield-presence consumer signal" from "it has none" — mirrors
   * `consumerTriggerNames`/`consumerTriggerOn`'s own optionality
   * convention.
   *
   * **`{ sameNameAsSelf: true }` — a THIRD filter variant (2026-09-18),
   * `battlefield-presence-hare-apparent.ts`.** Same underlying "cares about
   * the board-state COUNT of a filtered set of permanents you control"
   * concept as the `subtype` variant above, just filtered by NAME instead
   * of subtype/creature-type — checked via
   * `matcher-model/match-query.ts`'s `matchesBattlefieldPresenceConsumer`
   * against `createToken.amount`'s own `ValueRef` shape (a
   * `combinator.ts` `QueryChain.count()` `Aggregate` over a
   * `FilterPredicate: 'sameNameAsSelf'` chain), not `costReduction
   * .perControlled`/`pumpAll`/`putCounterAll` at all — Hare Apparent's own
   * real "for each other creature you control named Hare Apparent" ETB
   * effect has no cost-reduction or anthem shape whatsoever, only a
   * dynamically-computed token `amount`. Mutually exclusive with
   * `subtype` in practice (a real card is checked against ONE or the
   * other, never both at once) — kept as a plain union rather than a
   * combined `{subtype?, sameNameAsSelf?}` object so a caller can't
   * accidentally set both on the same entry.
   */
  consumerBattlefieldPresence?: { subtype?: string } | { sameNameAsSelf: true };
  /**
   * Real bug fix (2026-09-18, found live: Helpful Hunter — a genuine,
   * printed Cat, `typeLine: 'Creature — Cat'` — self-displayed a "Cats"
   * battlefield-presence row on its OWN card page purely for BEING a Cat,
   * with no cost-reduction/anthem effect of its own at all). Every OTHER
   * catalog entry's self-ownership rule is `selfDirectProducerMatch ||
   * selfConsumerMatch` (a card owns a category either by doing the thing,
   * or by caring about the thing) — that's right for Bigfin Bouncer's real
   * bounce EFFECT or Day of Judgment's real destroy-all PROGRAM, genuine
   * authored abilities. It's WRONG for "Battlefield presence": merely
   * BEING a Cat/Creature is passive type/subtype membership, not a
   * deliberate ability — if bare membership alone granted self-ownership,
   * literally every Cat would self-display "Cats" and every creature would
   * self-display "Creatures," the exact same class of over-match the
   * original `etb` design already hit once (`card-schema.md`'s own section
   * 8) and was corrected for.
   *
   * When `true`, `card-interactions.ts`'s self-ownership gate for this
   * entry considers ONLY `selfConsumerMatch` — a genuine producer match
   * (`selfDirectProducerMatch`) is NEVER sufficient on its own to make
   * `definition` self-display this category, no matter how directly it
   * satisfies `query`. This does NOT touch the REVERSE direction at all:
   * the per-candidate `matchingCardNames` loop (who counts as a match for
   * whoever DOES own the category) still runs the exact same producer
   * `matchQuery` check as always — Helpful Hunter still correctly appears
   * in Claws Out's own "Cats" `matchingCardNames`, unaffected. Omitted
   * (falsy) for every other catalog entry — the default, pre-existing
   * `selfDirectProducerMatch || selfConsumerMatch` rule is unchanged for
   * `lifegain`/`graveyard-fodder`/`etb`.
   */
  requireConsumerForSelfOwnership?: boolean;
  /**
   * Stable MATCHER FAMILY key (2026-09-18, added for the `BattlefieldPresenceMatcher`/
   * `CountersMatcher` factory refactor — see `catalog/families/battlefield-
   * presence.ts`/`catalog/families/counters.ts`) — e.g.
   * `'battlefield-presence'`/`'counters'`. Shared verbatim across every real
   * MATCHER the same factory produced (all 3
   * `BattlefieldPresenceMatcher({...})` calls set `family: 'battlefield-
   * presence'`; the 1 `CountersMatcher({...})` call sets `family: 'counters'`).
   * Omitted for a plain, non-factory-built instance with no real sibling
   * family (`lifegain`/`graveyard-fodder`/`etb`) — for those,
   * `matcher-catalog-status.ts` treats the instance's own `slug` as its own
   * trivial family (family and instance coincide 1:1, same as before this
   * field existed).
   *
   * **NOT a repeat of the reverted `family: {slug,label,variant}` display
   * metadata field** (`116afa14`, reverted same-day as `d3e92571` — "we
   * don't need variants," zero behavior attached to it, purely cosmetic).
   * THIS field is genuinely load-bearing on two real, mechanical things:
   * 1. `matcher-catalog-status.ts` derives each instance's real source files
   *    from it (2026-09-18, split further: the shared factory at
   *    `families/${family}.ts` PLUS each real member's own
   *    `${slug}.ts` instance-config file, falling back to just `${slug}.ts`
   *    when `family` is omitted) for `computeMatcherCatalogFingerprint`'s own
   *    drift-detection hash — the real files this instance's logic/config
   *    actually lives in, since `battlefield-presence-cats`/`-creatures`/
   *    `-hare-apparent` each have their own small `catalog/<slug>.ts`
   *    instance file (config only) plus a shared `catalog/families/
   *    battlefield-presence.ts` factory file, rather than one combined
   *    per-slug module the way a singleton like `lifegain` still does.
   * 2. **Review status is computed ONE LEVEL UP, per FAMILY, not per
   *    instance** (2026-09-18, real scope change, not cosmetic) —
   *    `computeMatcherCatalogStatus`/`computeMatcherCatalogColor` group every real
   *    `MATCHER_CATALOG` instance by `family ?? slug` and report/review ONE
   *    gray/purple/blue/yellow/green/re-review verdict per GROUP: "Battlefield
   *    presence" is one review item (its combined corpus coverage across
   *    Cats/Creatures/Same-name copies collectively decides its baseline;
   *    a human review verdict applies to the whole family at once), not 3
   *    separate review items. Each real instance still does its own real,
   *    independent MATCHING (`entry(candidate)` — see `Matcher`'s own
   *    doc comment) — this field never touches matching behavior, only how
   *    review status is grouped/reported. See `matcher-catalog-status.ts`'s own
   *    header for the full design. **`server/api/sink-catalog/index.get.ts`/
   *    `./review.post.ts` do NOT yet read/key off this field** (both routes
   *    are out of scope for this refactor, per the task's own explicit
   *    instruction not to touch them) — both still assume one review item
   *    per real `MATCHER_CATALOG` slug; a follow-up needs to update them to
   *    the new family-keyed shape `computeMatcherCatalogStatus` now returns.
   *    Flagged, not silently worked around.
   */
  family?: string;
}

/**
 * A `MatcherCatalogEntry` that is ALSO directly callable — the real return
 * ELEMENT type of `BattlefieldPresenceMatcher`/`CountersMatcher`
 * (`catalog/families/battlefield-presence.ts`/`catalog/families/counters.ts`,
 * 2026-09-18). A plain function value with the entry's own data fields
 * (`slug`/`query`/`consumerTriggerNames`/...) assigned onto it (both
 * factories build it this way) satisfies this type structurally —
 * TypeScript doesn't distinguish "a function with these properties" from
 * "an object with these properties that also happens to have a call
 * signature." `MATCHER_CATALOG` itself stays typed `MatcherCatalogEntry[]` (a
 * `Matcher` IS a `MatcherCatalogEntry`, so no change needed there or at
 * any existing read site — `matcher-catalog-status.ts`/`card-interactions
 * .ts`/the server API route keep reading `entry.slug`/`entry.query`/etc
 * exactly as before, completely unaffected by an entry also being
 * invocable); this narrower type only matters to a caller that specifically
 * wants to INVOKE an entry.
 *
 * **`entry(candidate)` returns a plain `boolean` (2026-09-19, 3rd real
 * design iteration on this callable contract — see `MATCHER_MODEL_DESIGN.md`'s
 * own dated section for the full history: `MatcherQuery`-based ->
 * config-object-based -> `CardDefinition`-based -> boolean-return-based).**
 * The user's own explicit target shape, verbatim: `const matcher =
 * MatcherFamily(matcherDefinition); const booleanWeLookFor =
 * matcher(sourceCandidateDefinition)`. Two earlier compromises (a
 * boolean call plus separate producer/consumer accessors; a call returning
 * an all-boolean-fields object) were both explicitly rejected by the user
 * ("both complete bullshit") — the call itself must return `true`/`false`,
 * full stop.
 *
 * **The call answers the PRODUCER question ONLY**: "does `candidate` itself
 * structurally produce this sink's event" (e.g. a real `putCounter` effect
 * of the matching counter type). Deliberately NOT a combined
 * producer-or-consumer question the way the old `SinkMatchDetail`-returning
 * contract was — the CONSUMER check was never actually routed through this
 * callable for its own real test coverage in the first place
 * (`counters.test.ts`'s own "SINK CANDIDATE" cases already called
 * `matchesConsumerTriggerNames` directly), and every real production reader
 * of the old combined return immediately reduced it to a boolean via `!!`
 * anyway (`card-interactions.ts`'s `matchEntry`, `server/api/sink-catalog/
 * index.get.ts`'s `instanceProducerMatched`/`instanceConsumerMatched`) — see
 * `match-query.ts`'s own `matchesConsumerTriggerNames`/
 * `matchesConsumerTriggerOn`/`matchesBattlefieldPresenceConsumer` for the
 * real, already-boolean-returning consumer checks, called directly against
 * this entry's own data fields (`consumerTriggerNames`/`consumerTriggerOn`/
 * `consumerBattlefieldPresence` — present on a callable entry the same as
 * any other `MatcherCatalogEntry`, since the factory `Object.assign`s them onto
 * the function value) rather than through this callable.
 *
 * Lets a caller run every callable entry in `MATCHER_CATALOG` against one
 * `CardDefinition` uniformly for the PRODUCER question —
 * `MATCHER_CATALOG.filter((e): e is Matcher => typeof e ===
 * 'function').filter((s) => s(candidate))` — instead of hand-checking
 * `matchQuery` separately per entry, per call site.
 *
 * A plain, non-factory-built entry (`lifegain`/`graveyard-fodder`/`etb`) is
 * a normal, non-callable object — invoking it as a function is a real
 * `TypeError`, same as calling any other non-function value.
 *
 * **`isPredicateDerived` (2026-09-19, added alongside the boolean-return
 * rewrite)** — the one real piece of detail the old combined return carried
 * that a bare boolean genuinely can't: whether the producer match came from
 * a `sink-derivation-predicates/*.ts` sink-derivation predicate (Saga/Crew/
 * Lifelink — an inferred/predicate-derived occurrence) rather than a direct
 * walk of the card's own authored `effects`/`triggers`/`program` AST. Real,
 * still-needed signal — `card-interactions.ts`'s
 * `selfDirectProducerMatch = self.producerMatched && !self.predicateDerived`
 * uses exactly this to distinguish "this card's own authored effect
 * literally matches" (self-display-worthy) from "this only matched via an
 * inferred occurrence" (not self-display-worthy) — NOT something to drop.
 * Optional, since a family with no predicate-derived-occurrence concept at
 * all (nothing today, but a hypothetical future family) has no real reason
 * to implement it; a caller reads `instance.isPredicateDerived?.(candidate,
 * root) ?? false`.
 *
 * **Terminology (2026-09-18, for a caller wiring this into the two-role
 * shape `card-interactions.ts` already computes)**: the card ASKING "who
 * matches my own sink category" is `self`; the card being tested against
 * one specific configured matcher is `candidate` — matches this
 * function's own parameter name. A `self` card doesn't own a category by
 * merely existing; today's real "does `self` own this category at all"
 * derivation is `card-interactions.ts`'s own `selfDirectProducerMatch`/
 * `selfConsumerMatch`/`requireConsumerForSelfOwnership` computation, per
 * `MATCHER_CATALOG` entry.
 */
export type Matcher = MatcherCatalogEntry &
  ((candidate: CardDefinition, root?: string) => boolean) & {
    /** See this type's own doc comment above — present only on a family
     * whose producer mechanism can distinguish a predicate-derived match
     * from a direct effect/trigger walk. */
    isPredicateDerived?: (candidate: CardDefinition, root?: string) => boolean;
  };

/**
 * The shape of a MATCHER FAMILY constructor — `BattlefieldPresenceMatcher`/
 * `CountersMatcher` (`catalog/families/battlefield-presence.ts`/`catalog/
 * families/counters.ts`) are both real `MatcherFamily<...>` values: a function
 * taking one real configuration and returning EVERY real, fully-configured
 * `Matcher` it derives from it (the Cats instance, the +1/+1 instance,
 * ...).
 *
 * **Returns `Matcher[]`, not one `Matcher` (2026-09-19, live
 * correction — the user's own explicit rejection of a single-instance
 * return: "we need array handling here obviously")** — a single driving
 * `CardDefinition` is not guaranteed to derive only ONE distinct sink
 * instance. `CountersMatcher(definition)`, concretely: a definition carrying
 * `putCounter`-family effects of more than one distinct `counterType` (none
 * in the pool today, but a real, honest possibility) derives one
 * `Matcher` PER distinct `counterType`, not just the first one found —
 * see `catalog/families/counters.ts`'s own `deriveCounterTypes` for the
 * full writeup. `BattlefieldPresenceMatcher` has no real multi-instance-per-
 * config case of its own today and simply returns a single-element array
 * (`[sink]`) — a real, structural degenerate case of this same contract,
 * not a special exception to it.
 *
 * Purely a naming/typing convenience otherwise — every real family
 * constructor already satisfies this shape structurally without needing to
 * import/annotate against it; exported so a doc comment or a future family
 * constructor can reference "a `MatcherFamily`" as a real, named concept
 * instead of an ad-hoc `(config) => Matcher[]` shape typed out by hand
 * each time.
 *
 * `Config` is NOT always a hand-authored config object — `BattlefieldPresenceMatcher`
 * still takes one (`BattlefieldPresenceMatcherConfig`), but `CountersMatcher`
 * (2026-09-19, "Matcher family should produce sink out of card definition. Not
 * out of magical query" — user's own explicit instruction) instantiates
 * this as `MatcherFamily<CardDefinition>`: its own `Config` IS the real driving
 * card's `CardDefinition` directly, with every other field
 * (`slug`/`category`/`consumerTriggerNames`) derived from it internally —
 * see `catalog/families/counters.ts`'s own header for the full derivation
 * writeup. Both shapes satisfy this same generic type.
 */
export type MatcherFamily<Config> = (config: Config) => Matcher[];
