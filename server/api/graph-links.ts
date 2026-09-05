// Whole-pool direct card<->card synergy links for the main graph visualizer
// (app/composables/useGraphStore.ts) — replaces the old hand-curated
// card->theme hub edges (data/fin/fin_relations.json + data/global_themes.json)
// with real, verified functional-model matches (functional-model/synergy.ts's
// findInteractionsForCard, joining each card's own cards/<slug>/synergy.json
// source/sink facts). Names, not ids — buildGraph.ts resolves these
// against the Scryfall corpus it already has loaded, same as it already does
// for the old RelationsEntry shape.
//
// Only ever covers FIN (functional-model's whole scope right now) — the `sf=`
// arbitrary-Scryfall-query mode in useGraphStore.ts has no functional-model
// coverage and doesn't call this route at all; it just renders cards with no
// links.
//
// GET /api/graph-links

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadFunctionalModelPool } from '../utils/functionalModelPool';
import { findInteractionsForCard, factTotal } from '../../functional-model/synergy';
import type { GraphReason } from '../../app/types';

function countCardSlugs(): number {
  try {
    return readdirSync(join(process.cwd(), 'functional-model/cards'), { withFileTypes: true }).filter((e) => e.isDirectory()).length;
  } catch {
    return 0;
  }
}

// Two-sided combined value for one match — source side's value times
// sink side's value (each 1-5, so 1-25 combined), per the user's own
// calibration: a source that's genuinely weak (value 1) shouldn't get
// papered over by a strongly-quantified sink, and vice versa — straight
// multiplication already does that (a 1 on either side caps the product at
// the other side's own value). `null` only when BOTH sides predate the
// weight fields; if just one side does, fall back to the other alone rather
// than discarding real data.
function combinedWeight(mineTotal: number | null, theirTotal: number | null): number | null {
  if (mineTotal == null && theirTotal == null) return null;
  if (mineTotal == null) return theirTotal;
  if (theirTotal == null) return mineTotal;
  return mineTotal * theirTotal;
}

export interface GraphLink {
  a: string;
  b: string;
  reasons: GraphReason[];
}

export default defineEventHandler(async () => {
  const pool = await loadFunctionalModelPool();

  // One entry per unordered pair, deduped both by which two cards and by
  // exact reason text — a source/sink pair can independently match more
  // than once (e.g. two of A's own source facts each satisfying a
  // different one of B's sink facts). Only walking `source`-direction groups
  // (never `sink`) is deliberate, not an oversight: every real interacting
  // pair has exactly one source side and one sink side, so iterating
  // source-groups across the whole pool already enumerates each pair once
  // — from the producer's perspective. Walking both directions would count
  // every pair twice. Self-interactions (a card matching itself) are real,
  // verified output from the matcher but aren't a renderable edge to
  // ANOTHER node, so they're skipped here — the per-card Interactions panel
  // (server/api/card/[set]/[number].ts) is where those still show up.
  const linksByPairKey = new Map<string, GraphLink>();
  for (const { name } of pool) {
    const groups = findInteractionsForCard(name, pool);
    for (const group of groups) {
      if (group.direction !== 'source') continue;
      const mineTotal = factTotal(group.fact);
      for (const match of group.matches) {
        if (match.card === name) continue; // self-interaction — not a graph edge
        const [a, b] = [name, match.card].sort();
        const key = `${a} ${b}`;
        let link = linksByPairKey.get(key);
        if (!link) {
          link = { a: a!, b: b!, reasons: [] };
          linksByPairKey.set(key, link);
        }
        const weight = combinedWeight(mineTotal, match.theirTotal);
        // `name` is always the producer here (this loop only ever walks
        // `source`-direction groups) — direction is which of the sorted
        // a/b pair that producer landed as.
        const from: 'a' | 'b' = name === a ? 'a' : 'b';
        // A duplicate description within the same pair (the other card had more
        // than one sink fact independently satisfying this same source fact) —
        // keep the max weight seen for it rather than the first, since a
        // duplicate is corroborating evidence, not a weaker read.
        const existing = link.reasons.find((r) => r.description === group.description);
        if (!existing) link.reasons.push({ description: group.description, weight, from });
        else if ((weight ?? -1) > (existing.weight ?? -1)) existing.weight = weight;
      }
    }
  }

  return {
    links: [...linksByPairKey.values()],
    coverage: { total: countCardSlugs(), migrated: pool.length },
  };
});
