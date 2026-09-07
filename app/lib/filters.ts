import type { CardData, GraphFile, GraphReason } from '../types';
import { CORE_TYPES } from './constants';
import { BADGE_KEYWORDS } from './buildGraph';

export function cardColors(c: CardData): string[] {
  return c.colorIdentity.length ? c.colorIdentity : ['C'];
}

export function cardTypes(c: CardData): string[] {
  const matched = CORE_TYPES.filter((t) => c.typeLine.includes(t));
  return matched.length ? matched : ['Other'];
}

export function availableRarities(graph: GraphFile, order: string[]): string[] {
  return order.filter((r) => graph.cards.some((c) => c.rarity === r));
}

export function availableTypes(graph: GraphFile): string[] {
  const seen = new Set<string>();
  for (const c of graph.cards) for (const t of cardTypes(c)) seen.add(t);
  return [...CORE_TYPES, 'Other'].filter((t) => seen.has(t));
}

// Every BADGE_KEYWORDS entry actually present on at least one card in this
// corpus, in BADGE_KEYWORDS' own (curated, evergreen-first) order — same
// "only show options that exist here" shape availableTypes/availableRarities
// already use, not the full static BADGE_KEYWORDS list regardless of corpus
// (a live `sf=` query or a small pasted deck can easily have zero cards for
// most of them).
export function availableKeywords(graph: GraphFile): string[] {
  const seen = new Set<string>();
  for (const c of graph.cards) for (const k of c.keywords) seen.add(k);
  return [...BADGE_KEYWORDS].filter((k) => seen.has(k));
}

export interface AttrFilters {
  selectedColors: ReadonlySet<string>;
  selectedRarities: ReadonlySet<string>;
  selectedTypes: ReadonlySet<string>;
}

export function passesAttrFilters(c: CardData, f: AttrFilters): boolean {
  if (!cardColors(c).some((col) => f.selectedColors.has(col))) return false;
  if (!f.selectedRarities.has(c.rarity)) return false;
  if (!cardTypes(c).some((t) => f.selectedTypes.has(t))) return false;
  return true;
}

export interface FacetCounts {
  colors: Record<string, number>;
  rarities: Record<string, number>;
  types: Record<string, number>;
  // NOT a reciprocal facet like the three above — keyword selection doesn't
  // filter cards at all (see FilterPanel.vue/graphRenderer.ts's keyword-hub
  // feature), so there's no "this axis ignored" to compute. Each count here
  // is just "how many of the currently color/rarity/type-visible cards carry
  // this keyword" — informational, not reflecting any keyword selection.
  keywords: Record<string, number>;
}

// Faceted counts, matching what a filter-UI user expects: each option's number is
// "how many cards would match if every OTHER filter axis kept its current selection
// and this axis were ignored." So a color's count never moves when you toggle other
// colors, only when you change rarity/type selections — and vice versa.
export function computeFacetCounts(graph: GraphFile, f: AttrFilters): FacetCounts {
  const colors: Record<string, number> = {};
  const rarities: Record<string, number> = {};
  const types: Record<string, number> = {};
  const keywords: Record<string, number> = {};

  for (const c of graph.cards) {
    const cColors = cardColors(c);
    const cTypes = cardTypes(c);
    const matchesType = cTypes.some((t) => f.selectedTypes.has(t));
    const matchesRarity = f.selectedRarities.has(c.rarity);
    const matchesColor = cColors.some((col) => f.selectedColors.has(col));

    if (matchesRarity && matchesType) for (const col of cColors) colors[col] = (colors[col] ?? 0) + 1;
    if (matchesColor && matchesType) rarities[c.rarity] = (rarities[c.rarity] ?? 0) + 1;
    if (matchesColor && matchesRarity) for (const t of cTypes) types[t] = (types[t] ?? 0) + 1;
    if (matchesColor && matchesRarity && matchesType) for (const k of c.keywords) keywords[k] = (keywords[k] ?? 0) + 1;
  }

  return { colors, rarities, types, keywords };
}

// --- Edge topology (Source-Sink filter) ------------------------------------
// A node's in/out degree, counted per DIRECTED relation (GraphReason.from),
// not per undirected CardLink pair — a single pair can carry reasons
// pointing both ways (each card is a source for one fact and a sink for
// another), so degree has to be tallied per-reason.
export interface NodeDegree {
  inDegree: number;
  outDegree: number;
}

export function computeNodeDegrees(graph: GraphFile): Map<string, NodeDegree> {
  const degrees = new Map<string, NodeDegree>();
  const entry = (id: string) => {
    let d = degrees.get(id);
    if (!d) {
      d = { inDegree: 0, outDegree: 0 };
      degrees.set(id, d);
    }
    return d;
  };
  for (const l of graph.links) {
    for (const r of l.reasons) {
      const sourceId = r.from === 'a' ? l.a : l.b;
      const targetId = r.from === 'a' ? l.b : l.a;
      entry(sourceId).outDegree++;
      entry(targetId).inDegree++;
    }
  }
  return degrees;
}

// "Source-Sink connection": a directed edge whose source has NO incoming
// edges anywhere in the graph (a pure producer/root — nothing feeds it) and
// whose target has NO outgoing edges anywhere in the graph (a pure
// consumer/leaf — it feeds nothing onward). `degrees` is expected to be
// computed once from the graph's FULL, unfiltered edge list (see
// computeNodeDegrees) — recomputing it from an already-filtered edge set
// would make toggling an unrelated filter (colors, say) change what counts
// as "pure," which defeats the point of a stable topology-based filter.
export function isSourceSinkReason(sourceId: string, targetId: string, degrees: ReadonlyMap<string, NodeDegree>): boolean {
  return (degrees.get(sourceId)?.inDegree ?? 0) === 0 && (degrees.get(targetId)?.outDegree ?? 0) === 0;
}

export function reasonSource(l: { a: string; b: string }, r: GraphReason): string {
  return r.from === 'a' ? l.a : l.b;
}

export function reasonTarget(l: { a: string; b: string }, r: GraphReason): string {
  return r.from === 'a' ? l.b : l.a;
}
