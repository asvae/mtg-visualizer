// The `SinkCatalogEntry` type itself — split into its own tiny file so
// `catalog/index.ts` (the registry) and every individual `catalog/<slug>.ts`
// module can both import it without a circular dependency between the
// registry and its own entries.
import type { Trigger } from '../../card';
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
   * Presentational/grouping metadata ONLY (2026-09-18) — surfaces a
   * relationship several catalog entries' own header comments already
   * document in prose ("the same shape... zero new code needed" for a
   * hypothetical future sibling) as a real, explicit data field, so a
   * future review-page UI can render several entries as one named sink
   * with multiple configurations/variants instead of N unrelated peer
   * rows. Does NOT touch `slug`/`query`/matching behavior/review-status
   * computation in any way — `match-sink.ts`, `card-interactions.ts`
   * (which groups matches by `query.category`, not by this field), and
   * `sink-catalog-status.ts` (which keys review status off `slug`) are
   * all completely untouched by this field's presence; each entry stays
   * its own fully independent `SinkCatalogEntry` module with its own
   * `query`, corpus, and review status. Only ever compare/group entries
   * by `family.slug`, never by `family.label`/`family.variant` (display
   * strings, not identity).
   *
   * Omitted entirely for a catalog entry that stands alone (no real
   * sibling entries sharing its underlying mechanic/matcher shape) — the
   * `lifegain`/`graveyard-fodder`/`etb` entries have no `family` today.
   */
  family?: {
    /** Stable identity key for the family, e.g. `'battlefield-presence'`/
     * `'counters'` — analogous to `slug` above but scoped to the family
     * rather than one entry; shared verbatim across every sibling entry in
     * the same family. Never reuse a retired family slug for a different
     * grouping. */
    slug: string;
    /** The family's own display name, e.g. `'Battlefield presence'`/
     * `'Counters'` — what a future grouped-view UI would show as the one
     * top-level sink name for every entry sharing this `family.slug`. */
    label: string;
    /** THIS entry's own configuration/variant label within the family,
     * e.g. `'Cats'`/`'Creatures'`/`'Same-name copies'` (battlefield
     * presence) or `'+1/+1'` (counters, anticipating future `-1/-1`/
     * loyalty siblings). Distinct from `query.category`, which stays each
     * entry's own full display category today (e.g. `'Counters
     * (+1/+1)'`) — `variant` is the shorter label meant for use ALONGSIDE
     * `family.label` once a grouped view exists, not a replacement for
     * `query.category`. */
    variant: string;
  };
}
