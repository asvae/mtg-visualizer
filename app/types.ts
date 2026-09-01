// Every relation type is a flat, independent role — a card gets a separate edge
// per relation type that applies (same as produce/consume have always coexisted
// as two edges), rather than a role plus an orthogonal "modifiers" array on it.
export type Role = 'produce' | 'consume' | 'atypical' | 'grant' | 'magnifier';

export interface CardData {
  id: string;
  name: string;
  cmc: number;
  colors: string[];
  colorIdentity: string[];
  typeLine: string;
  rarity: string;
  images: string[];
  tokens: { name: string; image: string }[];
  scryfallUri: string;
  keywords: string[];
  // Scryfall's own set/collector-number identity — the card detail page is
  // routed by these (/app/card/[set]/[number]), same URL shape as
  // scryfall.com/card/<set>/<number>, so prev/next is a plain ±1.
  set: string;
  collectorNumber: string;
}

export interface ThemeData {
  id: string;
  label: string;
}

export interface EdgeData {
  card: string;
  theme: string;
  role: Role;
  weight: number;
}

export interface GraphFile {
  set: string;
  cards: CardData[];
  themes: ThemeData[];
  edges: EdgeData[];
}

export const ROLES: Role[] = ['produce', 'consume', 'atypical', 'grant', 'magnifier'];
