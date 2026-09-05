// Mirrors scripts/sync-card-db.mjs's own isNormalArt() — same criteria, kept
// as a second copy (not imported cross-runtime) since that script is plain
// Node/JS run standalone, while this runs inside Nitro's TS build. Used only
// by the LIVE Scryfall fallback paths (server/api/cards/by-names.ts,
// server/api/card/[set]/[number].ts's resolveLiveCardMeta) — the local-DB
// path already picks a normal printing via SQL's `is_normal DESC` ordering,
// so this only matters when data/cards.db doesn't exist (prod).
const NONSTANDARD_FRAME_EFFECTS = new Set(['extendedart', 'showcase', 'inverted', 'colorshifted', 'borderless', 'shatteredglass']);

export interface StandardPrintCheckFields {
  full_art?: boolean;
  promo?: boolean;
  border_color?: string;
  finishes?: string[];
  frame_effects?: string[];
  set_name?: string;
}

export function isStandardPrint(card: StandardPrintCheckFields): boolean {
  return (
    !card.full_art &&
    !card.promo &&
    card.border_color !== 'borderless' &&
    (card.finishes ?? []).includes('nonfoil') &&
    !(card.frame_effects ?? []).some((fx) => NONSTANDARD_FRAME_EFFECTS.has(fx)) &&
    !(card.set_name ?? '').startsWith('Secret Lair')
  );
}
