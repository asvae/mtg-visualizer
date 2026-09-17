// Sink-only synergy matching — prototype (2026-09-17). See `match-sink.ts`'s
// own header for the full design writeup; this file is just the query
// shape itself.
//
// A `SinkQuery` is today's `synergy.ts` `Fact` shape a card author already
// writes for a `sink`, minus the four fields that only make sense for a
// PERSISTED, PROVENANCED fact object (`annotations`/`provenance`/`role`/
// `triggeredBy` — none of those describe what's being asked for, only how
// the ask was authored/anchored), plus a real `category` label naming the
// actual mechanic ("Retrigger", "Lifegain", "Graveyard fodder", ...) instead
// of a fixed generic metric name. Deliberately typed as a structural
// `Omit<Fact, ...>` rather than a hand-duplicated interface — every field
// `Fact` already carries (`event`/`zone`/`to`/`from`/`controller`/`subject`/
// `target`/`recipient`/`targeted`/`counterType`/`type`/`keyword`/`color`/
// `colors`/`tapped`/`untilEndOfTurn`/`costReductionPerControlled`/
// `oncePerTurn`/`face`, plus every `Constraints` field `Fact` extends —
// `types`/`cmc`/`power`/`toughness`/`amount`/`name`/`attacking`/
// `attachedToSelf`/`equippedBySelf`/`excludeSelf`) is still exactly what a
// sink might legitimately constrain on, so reusing `Fact` structurally means
// a future `Fact` field addition/removal is reflected here for free, with no
// separate vocabulary to keep in sync by hand.
import type { Fact } from '../synergy';

export type SinkQuery = Omit<Fact, 'annotations' | 'provenance' | 'role' | 'triggeredBy'> & {
  /** The real mechanic name this sink represents ("Retrigger", "Lifegain",
   * "Graveyard fodder", ...) — NOT a fixed generic metric/weight the way
   * the old (now-removed) `Fact.value` used to be; see this project's
   * "uniform edge weighting" decision (`.claude/agent-memory` /
   * `WISHLIST.md`) for why a magnitude dial isn't reintroduced here either. */
  category: string;
};
