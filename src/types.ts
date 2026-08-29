export type Role = 'produce' | 'consume' | 'atypical';
export type Modifier = 'conditional' | 'magnifier' | 'granter';

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
  power: number;
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
  modifiers: Modifier[];
}

export interface GraphFile {
  set: string;
  cards: CardData[];
  themes: ThemeData[];
  edges: EdgeData[];
}

export const ROLES: Role[] = ['produce', 'consume', 'atypical'];
