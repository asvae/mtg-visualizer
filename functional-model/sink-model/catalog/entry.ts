// The `SinkCatalogEntry` type itself — split into its own tiny file so
// `catalog/index.ts` (the registry) and every individual `catalog/<slug>.ts`
// module can both import it without a circular dependency between the
// registry and its own entries.
import type { CardDefinition, Trigger } from '../../card';
import type { SinkQuery } from '../sink-query';

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
export interface SinkCatalogEntry {
  /** Stable identity key — matches this entry's own filename
   * (`catalog/<slug>.ts`) and is also the review key
   * (`sink-catalog-status.ts`'s review overlay). No per-card attachment
   * concept exists (tried, then reverted the same day it was built — see
   * `pipeline-status.ts`'s own header note) — which cards own/select for a
   * given sink is computed live, on the fly, by
   * `card-interactions.ts`, never persisted against this slug. Never reuse
   * a retired slug for a different mechanic. */
  slug: string;
  /**
   * The actual curated query — today's `sink` Fact shape minus
   * `annotations`/`provenance`/`role`/`triggeredBy` (`SinkQuery`,
   * `sink-model/sink-query.ts`), plus its own real mechanic category label
   * (`query.category` — "Retrigger", "Lifegain", "Graveyard fodder", ...;
   * never a fixed generic metric pair).
   */
  query: SinkQuery;
  /**
   * Real, structural CONSUMER-side recognition mode (2026-09-18, added
   * alongside the producer-only `query` above) — a candidate is ALSO
   * recognized as belonging to this category when one of its own
   * `CardDefinition.triggers[].name` values (front OR back face) appears in
   * this list, checked via `sink-model/match-sink.ts`'s
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
   * gate (`sink-catalog-status.ts`) as the real check on false positives.
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
   * every card that ever sets it. Checked via `sink-model/match-sink.ts`'s
   * `matchesConsumerTriggerOn`. `etb` declares `consumerTriggerOn: ['enter']`
   * — a card with a real ETB ability OWNS the "ETB" category (it's the
   * thing worth re-triggering) even though it doesn't itself PRODUCE the
   * bounce/blink effect that re-triggers it; the producer half of that same
   * category is the `query` field, matched against a real bounce-to-hand
   * `move` effect instead (see `catalog/etb.ts`'s own header for the full
   * "blink/bounce value" archetype writeup — the real, motivating user
   * correction to an earlier, wrong "no split needed" design).
   */
  consumerTriggerOn?: Array<Trigger['on']>;
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
   * subtype. Checked via `sink-model/match-sink.ts`'s
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
   * `sink-model/match-sink.ts`'s `matchesBattlefieldPresenceConsumer`
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
   * `matchSink` check as always — Helpful Hunter still correctly appears
   * in Claws Out's own "Cats" `matchingCardNames`, unaffected. Omitted
   * (falsy) for every other catalog entry — the default, pre-existing
   * `selfDirectProducerMatch || selfConsumerMatch` rule is unchanged for
   * `lifegain`/`graveyard-fodder`/`etb`.
   */
  requireConsumerForSelfOwnership?: boolean;
  /**
   * Stable SINK FAMILY key (2026-09-18, added for the `BattlefieldPresenceSink`/
   * `CountersSink` factory refactor — see `catalog/families/battlefield-
   * presence.ts`/`catalog/families/counters.ts`) — e.g.
   * `'battlefield-presence'`/`'counters'`. Shared verbatim across every real
   * SINK INSTANCE the same factory produced (all 3
   * `BattlefieldPresenceSink({...})` calls set `family: 'battlefield-
   * presence'`; the 1 `CountersSink({...})` call sets `family: 'counters'`).
   * Omitted for a plain, non-factory-built instance with no real sibling
   * family (`lifegain`/`graveyard-fodder`/`etb`) — for those,
   * `sink-catalog-status.ts` treats the instance's own `slug` as its own
   * trivial family (family and instance coincide 1:1, same as before this
   * field existed).
   *
   * **NOT a repeat of the reverted `family: {slug,label,variant}` display
   * metadata field** (`116afa14`, reverted same-day as `d3e92571` — "we
   * don't need variants," zero behavior attached to it, purely cosmetic).
   * THIS field is genuinely load-bearing on two real, mechanical things:
   * 1. `sink-catalog-status.ts` derives each instance's real source files
   *    from it (2026-09-18, split further: the shared factory at
   *    `families/${family}.ts` PLUS each real member's own
   *    `${slug}.ts` instance-config file, falling back to just `${slug}.ts`
   *    when `family` is omitted) for `computeSinkCatalogFingerprint`'s own
   *    drift-detection hash — the real files this instance's logic/config
   *    actually lives in, since `battlefield-presence-cats`/`-creatures`/
   *    `-hare-apparent` each have their own small `catalog/<slug>.ts`
   *    instance file (config only) plus a shared `catalog/families/
   *    battlefield-presence.ts` factory file, rather than one combined
   *    per-slug module the way a singleton like `lifegain` still does.
   * 2. **Review status is computed ONE LEVEL UP, per FAMILY, not per
   *    instance** (2026-09-18, real scope change, not cosmetic) —
   *    `computeSinkCatalogStatus`/`computeSinkCatalogColor` group every real
   *    `SINK_CATALOG` instance by `family ?? slug` and report/review ONE
   *    gray/purple/blue/yellow/green/re-review verdict per GROUP: "Battlefield
   *    presence" is one review item (its combined corpus coverage across
   *    Cats/Creatures/Same-name copies collectively decides its baseline;
   *    a human review verdict applies to the whole family at once), not 3
   *    separate review items. Each real instance still does its own real,
   *    independent MATCHING (`entry(candidate)` — see `SinkInstance`'s own
   *    doc comment) — this field never touches matching behavior, only how
   *    review status is grouped/reported. See `sink-catalog-status.ts`'s own
   *    header for the full design. **`server/api/sink-catalog/index.get.ts`/
   *    `./review.post.ts` do NOT yet read/key off this field** (both routes
   *    are out of scope for this refactor, per the task's own explicit
   *    instruction not to touch them) — both still assume one review item
   *    per real `SINK_CATALOG` slug; a follow-up needs to update them to
   *    the new family-keyed shape `computeSinkCatalogStatus` now returns.
   *    Flagged, not silently worked around.
   */
  family?: string;
}

/**
 * Real match detail an invocable `SinkInstance` (see that type's own doc
 * comment below) returns when a candidate matches — `null` otherwise.
 * Carries at least as much detail as an existing call site already
 * reads out of a match today: `producer.via`/`producer.predicateDerived`
 * mirror `sink-model/match-sink.ts`'s own `SinkMatchResult` fields 1:1 (the
 * exact detail `card-interactions.ts`'s `selfProducerMatch`/
 * `selfDirectProducerMatch` already reads out of a plain `matchSink(...)`
 * call); `consumer.via` names WHICH declared consumer-side signal matched —
 * strictly MORE detail than any consumer check returns today (
 * `matchesConsumerTriggerNames`/`matchesConsumerTriggerOn`/
 * `matchesBattlefieldPresenceConsumer` are all bare booleans, with no
 * "which one" signal at all).
 */
export interface SinkMatchDetail {
  /** Present iff `candidate` itself structurally PRODUCES this entry's own
   * `query` (the same signal `matchSink(entry.query, candidate)` already
   * computes). */
  producer?: { via: string; predicateDerived?: boolean };
  /** Present iff `candidate` structurally CARES ABOUT/reacts to this entry's
   * category via one of its own declared consumer-side signals. */
  consumer?: { via: 'triggerName' | 'triggerOn' | 'battlefieldPresence' };
}

/**
 * A `SinkCatalogEntry` that is ALSO directly callable — the real return type
 * of `BattlefieldPresenceSink`/`CountersSink` (`catalog/families/battlefield-
 * presence.ts`/`catalog/families/counters.ts`, 2026-09-18). A plain function value
 * with the entry's own data fields (`slug`/`query`/`consumerTriggerNames`/
 * ...) assigned onto it (both factories build it this way) satisfies this
 * type structurally — TypeScript doesn't distinguish "a function with these
 * properties" from "an object with these properties that also happens to
 * have a call signature." `SINK_CATALOG` itself stays typed
 * `SinkCatalogEntry[]` (a `SinkInstance` IS a `SinkCatalogEntry`, so no
 * change needed there or at any existing read site — `sink-catalog-status
 * .ts`/`card-interactions.ts`/the server API route keep reading
 * `entry.slug`/`entry.query`/etc exactly as before, completely unaffected
 * by an entry also being invocable); this narrower type only matters to a
 * caller that specifically wants to INVOKE an entry.
 *
 * `entry(candidate)` returns real, structural match detail
 * (`SinkMatchDetail`) when `candidate` structurally satisfies this entry's
 * own producer query OR any declared consumer signal, `null` when neither
 * applies. Lets a caller run every callable entry in `SINK_CATALOG` against
 * one `CardDefinition` uniformly — `SINK_CATALOG.filter((e): e is
 * SinkInstance => typeof e === 'function').map((s) => s(candidate)).filter
 * (Boolean)` — instead of hand-checking `matchSink`/
 * `matchesConsumerTriggerNames`/`matchesConsumerTriggerOn`/
 * `matchesBattlefieldPresenceConsumer` separately per entry, per call site,
 * the way `card-interactions.ts` still does today.
 *
 * This is a genuine, additive capability, not a replacement for `matchSink`/
 * the consumer-check functions in `match-sink.ts` — no existing production
 * consumer (`card-interactions.ts`, the server API route) calls an entry as
 * a function today; this addition doesn't change either's own behavior at
 * all. `catalog/battlefield-presence.test.ts`/`catalog/counters.test.ts` are
 * the first real callers, asserting the null/detail contract directly
 * against the same corpus fixtures the producer/consumer-mode assertions
 * already use. A plain, non-factory-built entry (`lifegain`/
 * `graveyard-fodder`/`etb`) is a normal, non-callable object — invoking it
 * as a function is a real `TypeError`, same as calling any other
 * non-function value.
 *
 * **Terminology (2026-09-18, for a caller wiring this into the two-role
 * shape `card-interactions.ts` already computes)**: the card ASKING "who
 * matches my own sink category" is `self`; the card being tested against
 * one specific configured sink instance is `candidate` — matches this
 * function's own parameter name. A `self` card doesn't own a category by
 * merely existing; today's real "does `self` own this category at all"
 * derivation is `card-interactions.ts`'s own `selfDirectProducerMatch`/
 * `selfConsumerMatch`/`requireConsumerForSelfOwnership` computation, per
 * `SINK_CATALOG` entry — a natural (not-yet-built) `hasSink(self, sinkType)`/
 * `getSinks(self, sinkType)` pair sitting on top of `SinkInstance` would
 * fold that same derivation behind a per-sink-type query instead of the
 * current per-entry loop, then run each returned instance against a
 * `candidate` via this exact call signature — flagged as a real, natural
 * follow-up, not built here (no production call site invokes a
 * `SinkInstance` today — see the paragraph above).
 */
export type SinkInstance = SinkCatalogEntry & ((candidate: CardDefinition, root?: string) => SinkMatchDetail | null);

/**
 * The shape of a SINK FAMILY constructor — `BattlefieldPresenceSink`/
 * `CountersSink` (`catalog/families/battlefield-presence.ts`/`catalog/
 * families/counters.ts`) are both real `SinkFamily<...>` values: a function taking one real
 * configuration (`BattlefieldPresenceSinkConfig`/`CountersSinkConfig`) and
 * returning ONE real, fully-configured `SinkInstance` for it (the Cats
 * instance, the +1/+1 instance, ...). Purely a naming/typing convenience —
 * every real family constructor already satisfies this shape structurally
 * without needing to import/annotate against it; exported so a doc comment
 * or a future family constructor can reference "a `SinkFamily`" as a real,
 * named concept instead of an ad-hoc `(config) => SinkInstance` shape typed
 * out by hand each time.
 */
export type SinkFamily<Config> = (config: Config) => SinkInstance;
