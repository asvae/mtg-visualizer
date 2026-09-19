// Matcher catalog FAMILY: Battlefield presence — a genuine, reusable
// `BattlefieldPresenceMatcher` factory (2026-09-18 refactor), replacing what
// used to be 3 independent, hand-duplicated `catalog/battlefield-presence-
// {cats,creatures,hare-apparent}.ts` modules that each separately declared a
// full `MatcherQuery` + `MatcherCatalogEntry` for the exact same underlying
// concept. See `d3e92571`/`116afa14` (a REVERTED, shallower "family display
// metadata" attempt at this same problem — a `family: {slug,label,variant}`
// field with zero behavior attached, explicitly rejected: "We don't need
// variants") for the wrong shape this supersedes; this file is the real
// architecture change instead — one shared matcher/factory, N configured
// instances, no duplicated logic. The 3 real, curated instances themselves
// (2026-09-18, split out of this file so the reusable factory and each
// curated, specific configuration don't share a module) live in their own
// sibling files — `../battlefield-presence-cats.ts`/`-creatures.ts`/
// `-hare-apparent.ts`.
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
// `pumpAll`/`putCounterAll` — see `matcher-model/match-query.ts`'s own
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
// inline comment for why no honest generic "produces a copy of whichever
// card is asking" query exists (a `MatcherQuery` deliberately carries no
// reference back to its own owning card).
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
// grants self-ownership for this whole family. See `MatcherCatalogEntry
// .requireConsumerForSelfOwnership`'s own doc comment (`entry.ts`) for the
// full reasoning; unchanged by this refactor.
import type { CardDefinition } from '../../../card';
import { matchQuery } from '../../match-query';
import type { MatcherQuery } from '../../matcher-query';
import type { MatcherCatalogEntry, MatcherFamily, Matcher } from '../entry';

/** Stable MATCHER FAMILY key shared by every real configured instance — see
 * `MatcherCatalogEntry.family`'s own doc comment (`entry.ts`) for why this
 * drives real review-status grouping, not just display. */
const FAMILY = 'battlefield-presence';

export type BattlefieldPresenceFilter = { subtype?: string } | { sameNameAsSelf: true };

export interface BattlefieldPresenceMatcherConfig {
  /** Stable identity key — unchanged real slugs (`battlefield-presence-
   * cats`/`-creatures`/`-hare-apparent`), still real review-status keys and
   * URL paths (`/app/engine/sinks/<slug>`) — never renamed by this
   * refactor. */
  slug: string;
  /** The real curated PRODUCER query for this configuration, MINUS its own
   * `category` (2026-09-18: no separate authored `category` field at all —
   * see `getName` below; the factory computes it from `filter` and splices
   * it in). Deliberately explicit per configuration rather than derived
   * from `filter` alone otherwise — the CATS/CREATURES pair's own `types`
   * filter genuinely differs in kind from Hare Apparent's own literal
   * `name` constraint (see this file's own header), so there is no single
   * honest derivation rule covering the rest of `query`; each real
   * configuration states the rest of its own query plainly. */
  query: Omit<MatcherQuery, 'category'>;
  /** The real curated CONSUMER filter — see `MatcherCatalogEntry
   * .consumerBattlefieldPresence`'s own doc comment (`entry.ts`) for the
   * `{subtype}` vs `{sameNameAsSelf:true}` shapes. Also the sole real input
   * `getName` derives this configuration's own display category from. */
  filter: BattlefieldPresenceFilter;
}

/** The real display category, derived from `config.filter` rather than
 * authored as a separate, independently-typeable field (2026-09-18) — see
 * `BattlefieldPresenceMatcherConfig.query`'s own doc comment for why a parallel
 * `category` field risked drifting out of sync with the rest of the
 * configuration. `{sameNameAsSelf: true}` has no clean structural
 * derivation — it's inherently a named special case, so that one branch's
 * label is simply hardcoded here. A `{subtype}` config pluralizes to its
 * own display name (`'Cat'` -> `'Cats'`); an OMITTED `subtype` (the
 * CREATURES configuration's own real, deliberately unfiltered case — see
 * this file's own header) is today's one real generic-battlefield-presence
 * case, so it maps to the fixed `'Creatures'` label rather than pluralizing
 * `undefined`. */
function getName(filter: BattlefieldPresenceFilter): string {
  if ('sameNameAsSelf' in filter) return 'Same-name copies';
  return filter.subtype ? `${filter.subtype}s` : 'Creatures';
}

/**
 * The shared factory — `BattlefieldPresenceMatcher(config)` returns a real,
 * fully-configured, invocable `Matcher` for `config`, wrapped in a
 * single-element array (2026-09-19 — `MatcherFamily<Config>`'s own return type
 * widened to `Matcher[]` for `CountersMatcher`'s own real "one
 * `definition` can derive more than one distinct instance" case; see
 * `entry.ts`'s own `MatcherFamily` doc comment for the full writeup — this
 * family has no real multi-instance-per-config case of its own today, so
 * this is a genuine, structural degenerate case of that same contract, NOT
 * a migration of this family's own internal matching logic, which stays
 * exactly as it was). Every consumer this project already has
 * (`matcher-catalog-status.ts`, `card-interactions.ts`, the server API route)
 * reads the returned instance exactly like any other `MatcherCatalogEntry` —
 * `query`/`consumerBattlefieldPresence`/`requireConsumerForSelfOwnership`/
 * `sourceFile` are real, plain data fields on it, not something only
 * reachable by calling it.
 *
 * **`sink(candidate)` returns a plain `boolean` — the PRODUCER question
 * only** (2026-09-19, conforming edit for the shared `Matcher`
 * contract's own boolean-return rewrite — see `entry.ts`'s own
 * `Matcher` doc comment for the full writeup; this family's own
 * internal `MatcherQuery`/`matchQuery`-based matching logic is otherwise
 * untouched, deliberately out of scope for this pass, same as the
 * pre-existing "Counters migrated, Battlefield-presence hasn't yet"
 * precedent `MATCHER_MODEL_DESIGN.md` already documents). `isPredicateDerived`
 * is a real, non-guessed accessor — `matchQuery` already computes
 * `predicateDerived` internally, simply re-exposed here rather than
 * invented. The CONSUMER check (`matchesBattlefieldPresenceConsumer`) is no
 * longer called from inside this callable at all — a caller reads
 * `entry.consumerBattlefieldPresence` (still a real, plain data field on the
 * returned instance, unchanged) and calls that check directly, same as
 * every other consumer-signal field on any `MatcherCatalogEntry`.
 */
export const BattlefieldPresenceMatcher: MatcherFamily<BattlefieldPresenceMatcherConfig> = (config) => {
  const { slug, query: queryWithoutCategory, filter } = config;
  const query: MatcherQuery = { ...queryWithoutCategory, category: getName(filter) };

  const sink = ((candidate: CardDefinition, root: string = process.cwd()): boolean => {
    return matchQuery(query, candidate, root).matched;
  }) as Matcher;
  sink.isPredicateDerived = (candidate: CardDefinition, root: string = process.cwd()) => !!matchQuery(query, candidate, root).predicateDerived;

  const data: MatcherCatalogEntry = {
    slug,
    query,
    consumerBattlefieldPresence: filter,
    requireConsumerForSelfOwnership: true,
    family: FAMILY,
  };
  Object.assign(sink, data);
  return [sink];
};
