// The `SinkCatalogEntry` type itself — split into its own tiny file so
// `catalog/index.ts` (the registry) and every individual `catalog/<slug>.ts`
// module can both import it without a circular dependency between the
// registry and its own entries.
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
}
