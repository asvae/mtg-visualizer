// Sink catalog FAMILY: Battlefield presence — a genuine, reusable
// `BattlefieldPresenceSink` factory (2026-09-18 refactor), replacing what
// used to be 3 independent, hand-duplicated `catalog/battlefield-presence-
// {cats,creatures,hare-apparent}.ts` modules that each separately declared a
// full `SinkQuery` + `SinkCatalogEntry` for the exact same underlying
// concept. See `d3e92571`/`116afa14` (a REVERTED, shallower "family display
// metadata" attempt at this same problem — a `family: {slug,label,variant}`
// field with zero behavior attached, explicitly rejected: "We don't need
// variants") for the wrong shape this supersedes; this file is the real
// architecture change instead — one shared matcher/factory, N configured
// instances, no duplicated logic.
//
// **The archetype, in full** (worked example: Claws Out, FDN #6):
//   costReduction: { perControlled: { amountPerMatch: 1, subtype: 'Cat' } }
//   // "Affinity for Cats" — the CATS configuration's own consumer half
//   effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control',
//               power: 2, toughness: 2, untilEndOfTurn: true }]
//   // "Creatures you control get +2/+2" — the CREATURES configuration's
//   // own consumer half (no `subtype` at all — the generic, no-filter case)
// A THIRD real-world configuration, Hare Apparent (FDN #15): "When this
// creature enters, create a 1/1 Rabbit token for each other creature you
// control named Hare Apparent" — filtered by literal NAME instead of
// subtype, the one dimension `subtype` doesn't cover; its own board-count
// lives inside a `createToken` effect's `amount` (a `combinator.ts`
// `Aggregate{op:'count'}` `ValueRef`), not `costReduction.perControlled`/
// `pumpAll`/`putCounterAll` — see `sink-model/match-sink.ts`'s own
// `matchesBattlefieldPresenceConsumer`/`isSameNameCountValueRef` for the
// shared matcher that already recognizes both shapes; NOTHING in that file
// changes for this refactor — the whole point of a shared matcher.
//
// **Producer** (`query`, per configuration): does a candidate itself
// structurally guarantee a matching permanent enters the battlefield under
// its own control — either BY BEING one (a real baseline `entersBattlefield`
// occurrence) or by CREATING one (a `createToken` effect whose own token
// matches). The CATS/CREATURES configurations reuse a plain `types` filter
// (`{has:['Cat']}`/`{has:['Creature']}`); Hare Apparent's own producer query
// is a literal `name` constraint instead — see that configuration's own
// inline comment below for why no honest generic "produces a copy of
// whichever card is asking" query exists (a `SinkQuery` deliberately carries
// no reference back to its own owning card).
//
// **Consumer** (`consumerBattlefieldPresence`, per configuration): does a
// candidate itself CARE about the board-state COUNT of a filtered set of
// permanents it controls — checked via `matchesBattlefieldPresenceConsumer`.
//
// **Self-ownership**: every configuration sets `requireConsumerForSelfOwnership:
// true` — merely BEING a Cat/Creature/named-Hare-Apparent is passive type/
// name membership, not a deliberate ability (Helpful Hunter, a genuine
// printed Cat with no cost-reduction/anthem effect of its own, must NOT
// self-display "Cats" purely for being one) — only a genuine consumer signal
// grants self-ownership for this whole family. See `SinkCatalogEntry
// .requireConsumerForSelfOwnership`'s own doc comment (`entry.ts`) for the
// full reasoning; unchanged by this refactor.
import type { CardDefinition } from '../../card';
import { matchesBattlefieldPresenceConsumer, matchSink } from '../match-sink';
import type { SinkQuery } from '../sink-query';
import type { SinkCatalogEntry, SinkFamily, SinkInstance, SinkMatchDetail } from './entry';

/** Stable SINK FAMILY key shared by every real configured instance below —
 * see `SinkCatalogEntry.family`'s own doc comment (`entry.ts`) for why this
 * drives real review-status grouping, not just display. */
const FAMILY = 'battlefield-presence';

export type BattlefieldPresenceFilter = { subtype?: string } | { sameNameAsSelf: true };

export interface BattlefieldPresenceSinkConfig {
  /** Stable identity key — unchanged real slugs (`battlefield-presence-
   * cats`/`-creatures`/`-hare-apparent`), still real review-status keys and
   * URL paths (`/app/engine/sinks/<slug>`) — never renamed by this
   * refactor. */
  slug: string;
  /** The real curated PRODUCER query for this configuration. Deliberately
   * explicit per configuration rather than derived from `filter` alone —
   * the CATS/CREATURES pair's own `types` filter genuinely differs in kind
   * from Hare Apparent's own literal `name` constraint (see this file's own
   * header), so there is no single honest derivation rule covering all
   * three; each real configuration below states its own query plainly. */
  query: SinkQuery;
  /** The real curated CONSUMER filter — see `SinkCatalogEntry
   * .consumerBattlefieldPresence`'s own doc comment (`entry.ts`) for the
   * `{subtype}` vs `{sameNameAsSelf:true}` shapes. */
  filter: BattlefieldPresenceFilter;
}

/**
 * The shared factory — `BattlefieldPresenceSink(config)` returns ONE real,
 * fully-configured, invocable `SinkInstance` for `config`. Every consumer
 * this project already has (`sink-catalog-status.ts`, `card-interactions
 * .ts`, the server API route) reads the returned value exactly like any
 * other `SinkCatalogEntry` — `query`/`consumerBattlefieldPresence`/
 * `requireConsumerForSelfOwnership`/`sourceFile` are real, plain data fields
 * on it, not something only reachable by calling it. Calling the returned
 * value directly (`sink(candidate)`) is the NEW capability this factory adds
 * — see `SinkInstance`'s own doc comment (`entry.ts`) for the full
 * "additive, not a replacement" reasoning. A real `SinkFamily<...>` value.
 */
export const BattlefieldPresenceSink: SinkFamily<BattlefieldPresenceSinkConfig> = (config) => {
  const { slug, query, filter } = config;

  const sink = ((candidate: CardDefinition, root: string = process.cwd()): SinkMatchDetail | null => {
    const producer = matchSink(query, candidate, root);
    const consumerMatched = matchesBattlefieldPresenceConsumer(filter, candidate);
    if (!producer.matched && !consumerMatched) return null;
    const detail: SinkMatchDetail = {};
    // `matchSink` always sets `via` alongside `matched: true` — see its own
    // `SinkMatchResult` doc comment (`match-sink.ts`).
    if (producer.matched) detail.producer = { via: producer.via!, predicateDerived: producer.predicateDerived };
    if (consumerMatched) detail.consumer = { via: 'battlefieldPresence' };
    return detail;
  }) as SinkInstance;

  const data: SinkCatalogEntry = {
    slug,
    query,
    consumerBattlefieldPresence: filter,
    requireConsumerForSelfOwnership: true,
    family: FAMILY,
  };
  Object.assign(sink, data);
  return sink;
};

// ---------------------------------------------------------------------------
// The 3 real, currently-existing configurations. A future counters-shaped
// sibling (a 4th filter dimension no real card needs yet) would be exactly
// one more `BattlefieldPresenceSink({...})` call here — zero new matcher
// code, per this file's own header.

/** Cats — Claws Out's own "Affinity for Cats" cost reduction is the real
 * motivating consumer; a real Cat creature (Ajani's Pridemate, Nine-Lives
 * Familiar) or a Cat-token-making effect (Prideful Parent/Arahbo/Cat
 * Collector) is the real producer side. */
export const battlefieldPresenceCats: SinkInstance = BattlefieldPresenceSink({
  slug: 'battlefield-presence-cats',
  query: { category: 'Cats', to: 'Battlefield', controller: 'you', types: { has: ['Cat'] } },
  filter: { subtype: 'Cat' },
});

/** Creatures — Claws Out's own bare "Creatures you control get +2/+2"
 * (no subtype filter) is the real motivating consumer; deliberately broad
 * BY DESIGN — a generic, pool-wide count of any real creature or
 * creature-token-making effect, not a narrow archetype the way Cats is. */
export const battlefieldPresenceCreatures: SinkInstance = BattlefieldPresenceSink({
  slug: 'battlefield-presence-creatures',
  query: { category: 'Creatures', to: 'Battlefield', controller: 'you', types: { has: ['Creature'] } },
  filter: {},
});

/** Same-name copies (Hare Apparent, FDN #15) — a real, bespoke, low-reuse
 * configuration (per `entry.ts`'s own "a bespoke sink with only one real
 * card wanting it is still just a catalog entry" doc comment): the
 * PRODUCER query is a literal `name` constraint (there is no honest general
 * "produces a copy of whichever card is asking" query a shared, curated
 * `SinkQuery` can express — it deliberately carries no reference back to
 * its own owning card), and the CONSUMER filter is `{sameNameAsSelf: true}`
 * rather than a `subtype` — a genuinely different check
 * (`matchesBattlefieldPresenceConsumer` walks `createToken.amount`'s own
 * `ValueRef` shape for this filter, not `costReduction.perControlled`/
 * `pumpAll`/`putCounterAll`). A hypothetical future card with the identical
 * "counts its own other copies" idiom would need its own sibling
 * configuration (a different slug, a different literal `name`), sharing
 * this same factory and matcher. */
export const battlefieldPresenceHareApparent: SinkInstance = BattlefieldPresenceSink({
  slug: 'battlefield-presence-hare-apparent',
  query: { category: 'Same-name copies', to: 'Battlefield', controller: 'you', name: { eq: 'Hare Apparent' } },
  filter: { sameNameAsSelf: true },
});
