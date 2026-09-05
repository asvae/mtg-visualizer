import type { CardData, GraphFile } from '../types';
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

export interface FacetCounts {
  colors: Record<string, number>;
  rarities: Record<string, number>;
  types: Record<string, number>;
}

// Faceted counts, matching what a filter-UI user expects: each option's number is
// "how many cards would match if every OTHER filter axis kept its current selection
// and this axis were ignored." So a color's count never moves when you toggle other
// colors, only when you change rarity/type selections — and vice versa.
export function computeFacetCounts(graph: GraphFile, f: AttrFilters): FacetCounts {
  const colors: Record<string, number> = {};
  const rarities: Record<string, number> = {};
  const types: Record<string, number> = {};

  for (const c of graph.cards) {
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
