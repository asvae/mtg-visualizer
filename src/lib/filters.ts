import type { CardData, EdgeData, GraphFile, Role } from '../types';
import { CORE_TYPES } from './constants';

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

// Theme checklist counts reflect the color/rarity/type filters only — not the theme
// checkboxes themselves (unchecking a theme shouldn't zero out its own count), and
// not search — search highlights within the filtered collection, it doesn't shrink it.
export function computeThemeCounts(graph: GraphFile, f: AttrFilters): Record<string, number> {
  const filteredCardIds = new Set(graph.cards.filter((c) => passesAttrFilters(c, f)).map((c) => c.id));
  const counts: Record<string, number> = {};
  for (const t of graph.themes) counts[t.id] = 0;
  for (const e of graph.edges) {
    if (filteredCardIds.has(e.card)) counts[e.theme] = (counts[e.theme] ?? 0) + 1;
  }
  return counts;
}

export interface FullFilters extends AttrFilters {
  selectedThemes: ReadonlySet<string>;
}

export interface FacetCounts {
  colors: Record<string, number>;
  rarities: Record<string, number>;
  types: Record<string, number>;
}

// Faceted counts, matching what a filter-UI user expects: each option's number is
// "how many cards would match if every OTHER filter axis kept its current selection
// and this axis were ignored." So a color's count never moves when you toggle other
// colors, only when you change rarity/type/theme selections — and vice versa.
// Themes isn't included here: its own count (computeThemeCounts above) already
// follows this exact rule by construction (it only ever looks at color/rarity/type).
export function computeFacetCounts(graph: GraphFile, f: FullFilters): FacetCounts {
  const connectedCardIds = new Set<string>();
  for (const e of graph.edges) if (f.selectedThemes.has(e.theme)) connectedCardIds.add(e.card);

  const colors: Record<string, number> = {};
  const rarities: Record<string, number> = {};
  const types: Record<string, number> = {};

  for (const c of graph.cards) {
    if (!connectedCardIds.has(c.id)) continue;
    const cColors = cardColors(c);
    const cTypes = cardTypes(c);
    const matchesType = cTypes.some((t) => f.selectedTypes.has(t));
    const matchesRarity = f.selectedRarities.has(c.rarity);
    const matchesColor = cColors.some((col) => f.selectedColors.has(col));

    if (matchesRarity && matchesType) for (const col of cColors) colors[col] = (colors[col] ?? 0) + 1;
    if (matchesColor && matchesType) rarities[c.rarity] = (rarities[c.rarity] ?? 0) + 1;
    if (matchesColor && matchesRarity) for (const t of cTypes) types[t] = (types[t] ?? 0) + 1;
  }

  return { colors, rarities, types };
}

// Optional `f`: when given, only counts edges whose card currently passes the
// color/rarity/type filters — see computeWeakThemeIds below for why this matters.
export function computeRoleCountsByTheme(graph: GraphFile, f?: AttrFilters): Map<string, Record<Role, number>> {
  const map = new Map<string, Record<Role, number>>();
  for (const t of graph.themes) map.set(t.id, { produce: 0, consume: 0, atypical: 0 });
  const passingCardIds = f ? new Set(graph.cards.filter((c) => passesAttrFilters(c, f)).map((c) => c.id)) : null;
  for (const e of graph.edges) {
    if (passingCardIds && !passingCardIds.has(e.card)) continue;
    const rc = map.get(e.theme);
    if (rc) rc[e.role]++;
  }
  return map;
}

// A theme is "weak" only when it's STRICTLY one-sided — every edge is produce (Job
// Select: 23 edges, 100% produce, nothing pays off "how many Job Select creatures
// you control") or every edge is consume, with zero of anything else. Any atypical
// edge, or a genuine mix of produce AND consume, signals real two-sided structure —
// not weak. Single source of truth shared by the graph renderer (which banishes weak
// themes to an outer orbit) and the filter panel (bolds strong themes, offers "Strong").
export function isPureOneSided(rc: Record<Role, number>): boolean {
  const isPureProduce = rc.produce > 0 && rc.consume === 0 && rc.atypical === 0;
  const isPureConsume = rc.consume > 0 && rc.produce === 0 && rc.atypical === 0;
  return isPureProduce || isPureConsume;
}

// Weak/strong is computed from whatever the color/rarity/type filters CURRENTLY
// show, not the full unfiltered set — the visualizer shouldn't classify a theme
// based on data the user has explicitly filtered out. Deliberately ignores the
// theme-selection filter (which themes' checkboxes are ticked), same as
// computeThemeCounts above — only attribute filters shrink the pool being judged.
export function computeWeakThemeIds(graph: GraphFile, f: AttrFilters): Set<string> {
  const roleCounts = computeRoleCountsByTheme(graph, f);
  const weak = new Set<string>();
  for (const t of graph.themes) {
    if (isPureOneSided(roleCounts.get(t.id)!)) weak.add(t.id);
  }
  // "No Theme" is the synthetic catch-all for untagged cards — every edge into it is
  // a manufactured 'atypical' placeholder (see tag-cards.mjs), so the strict
  // one-sided test above never fires for it even though it's the clearest case of
  // "no real synergy" there is. Always weak, regardless of role mix.
  if (graph.themes.some((t) => t.id === 'no-theme')) weak.add('no-theme');
  return weak;
}

export function groupEdgesByCard(edges: EdgeData[]): Map<string, { themeId: string; role: Role }[]> {
  const map = new Map<string, { themeId: string; role: Role }[]>();
  for (const e of edges) {
    if (!map.has(e.card)) map.set(e.card, []);
    map.get(e.card)!.push({ themeId: e.theme, role: e.role });
  }
  return map;
}

export function groupCardsByTheme(edges: EdgeData[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!map.has(e.theme)) map.set(e.theme, new Set());
    map.get(e.theme)!.add(e.card);
  }
  return map;
}
