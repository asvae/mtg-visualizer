export const COLOR_MAP: Record<string, string> = {
  W: '#f4eddc',
  U: '#0e68ab',
  B: '#4b4a4d',
  R: '#d3202a',
  G: '#00733e',
};
export const COLORLESS = '#9aa0aa';

// Canonical color filter order: WUBRG, then colorless.
export const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G', 'C'];
export const COLOR_LABEL: Record<string, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'mythic'];
export const RARITY_COLOR: Record<string, string> = {
  common: '#8a8f98',
  uncommon: '#b8c4d0',
  rare: '#d4af37',
  mythic: '#e2622b',
};

export const CORE_TYPES = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Land', 'Planeswalker', 'Battle', 'Kindred'];

// Distinct from role colors (produce/consume/atypical), rarity colors, and the
// power-halo gold — modifiers are an orthogonal dimension rendered as a second dash
// color alongside the role color.
export const MODIFIER_COLOR: Record<string, string> = {
  conditional: '#9b59b6', // purple
  magnifier: '#ff4fa3', // pink
  granter: '#00bcd4', // cyan
};
