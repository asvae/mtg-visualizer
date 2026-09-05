// Whole-pool direct card<->card synergy links for the main graph visualizer
// (app/composables/useGraphStore.ts) — replaces the old hand-curated
// card->theme hub edges (data/fin/fin_relations.json + data/global_themes.json)
// with real, verified functional-model matches (functional-model/synergy.ts's
// findInteractionsForCard, joining each card's own cards/<slug>/synergy.json
// source/sink facts). Names, not ids — buildGraph.ts resolves these
// against the Scryfall corpus it already has loaded, same as it already does
// for the old RelationsEntry shape.
//
// Edge strength is deliberately NOT computed here (used to be a plain
// mineTotal*theirTotal product) — a generic fact (e.g. "card draw," matched
// by dozens of cards on both sides) used to weigh exactly as much per edge as
// a narrow, specific one matched by just two cards, which drowned the
// specific matches out visually. Instead each reason ships its own two raw
// share ratios (this match's slice of its source fact's total output, and
// separately of its sink fact's total demand — see GraphReason's own doc
// comment) and the CLIENT (graphRenderer.ts's reasonWeight) turns those into
// an actual number against two user-tunable budgets, so retuning the
// "spread" sliders in the Physics popover never needs a re-fetch here.
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

export interface GraphLink {
  a: string;
  b: string;
  reasons: GraphReason[];
}

// A raw match before either share ratio is known — collected in one pass
// (below), then turned into real GraphReasons in a second pass once both
// `sourceTotals`/`sinkTotals` maps have seen every match a source/sink fact
// participates in (a sink fact's own total, in particular, is fed by matches
// discovered under many different OUTER `name` iterations, not just one, so
// it can't be finalized until the whole pool's been walked).
interface RawReason {
  a: string;
  b: string;
  from: 'a' | 'b';
  description: string;
  // `${producer}::${sourceFactId}` — every match sharing this key is a
  // different consumer splitting the SAME source fact's output.
  sourceKey: string;
  // `${consumer}::${sinkFactId}` — every match sharing this key is a
  // different producer splitting the SAME sink fact's demand.
  sinkKey: string;
  mineValue: number;
  theirValue: number;
}

export default defineEventHandler(async () => {
  const pool = await loadFunctionalModelPool();

  // One entry per unordered pair — a source/sink pair can independently
  // match more than once (e.g. two of A's own source facts each satisfying a
  // different one of B's sink facts), each its own RawReason. Only walking
  // `source`-direction groups (never `sink`) is deliberate, not an oversight:
  // every real interacting pair has exactly one source side and one sink
  // side, so iterating source-groups across the whole pool already
  // enumerates each pair once — from the producer's perspective. Walking
  // both directions would count every pair twice. Self-interactions (a card
  // matching itself) are real, verified output from the matcher but aren't a
  // renderable edge to ANOTHER node, so they're skipped here — the per-card
  // Interactions panel (server/api/card/[set]/[number].ts) is where those
  // still show up.
  const rawReasons: RawReason[] = [];
  const sourceTotals = new Map<string, number>();
  const sinkTotals = new Map<string, number>();
  const addTo = (map: Map<string, number>, key: string, value: number) => map.set(key, (map.get(key) ?? 0) + value);

  for (const { name } of pool) {
    const groups = findInteractionsForCard(name, pool);
    for (const group of groups) {
      if (group.direction !== 'source') continue;
      // Missing (fact predates the weight fields) floors to 1 — the real
      // floor, "verified minimum-strength match," not "unknown" — so it
      // still gets a real (if minimal) share rather than a zero/undefined
      // that would poison the ratio math below.
      const mineValue = factTotal(group.fact) ?? 1;
      const sourceKey = `${name}::${group.fact.id ?? group.description}`;
      for (const match of group.matches) {
        if (match.card === name) continue; // self-interaction — not a graph edge
        const [a, b] = [name, match.card].sort();
        const theirValue = match.theirTotal ?? 1;
        const sinkKey = `${match.card}::${match.theirFactId ?? group.description}`;
        // `name` is always the producer here (this loop only ever walks
        // `source`-direction groups) — direction is which of the sorted
        // a/b pair that producer landed as.
        const from: 'a' | 'b' = name === a ? 'a' : 'b';
        rawReasons.push({ a: a!, b: b!, from, description: group.description, sourceKey, sinkKey, mineValue, theirValue });
        addTo(sourceTotals, sourceKey, theirValue);
        addTo(sinkTotals, sinkKey, mineValue);
      }
    }
  }

  const linksByPairKey = new Map<string, GraphLink>();
  for (const r of rawReasons) {
    const key = `${r.a} ${r.b}`;
    let link = linksByPairKey.get(key);
    if (!link) {
      link = { a: r.a, b: r.b, reasons: [] };
      linksByPairKey.set(key, link);
    }
    link.reasons.push({
      description: r.description,
      from: r.from,
      sourceShareRatio: r.theirValue / sourceTotals.get(r.sourceKey)!,
      sinkShareRatio: r.mineValue / sinkTotals.get(r.sinkKey)!,
    });
  }

  return {
    links: [...linksByPairKey.values()],
    coverage: { total: countCardSlugs(), migrated: pool.length },
  };
});
