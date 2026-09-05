// Shared shaping logic between server/api/cards.ts (Scryfall search query)
// and server/api/cards/by-names.ts (deck-import bulk name lookup) — both
// resolve a set of live Scryfall cards, then need the exact same "shrink to
// what buildGraph.ts reads" + "intersect against the tagged relations/themes
// corpus" treatment before handing the frontend a graph-buildable payload.
// Not a route itself (leading underscore keeps Nitro from registering it as
// one — see server/api/card/[set]/[number].ts's own directory, which has no
// such file, for why this convention matters: an untyped export here would
// otherwise need its own route guard).

import relationsData from '../../data/global_relations.json';
import finRelationsData from '../../data/fin/fin_relations.json';
import themesData from '../../data/global_themes.json';

export interface RelationsEntry {
  name: string;
  themes: Record<string, Record<string, number>>;
}

// data/fin/fin_relations.json wins over data/global_relations.json by name —
// FIN hasn't been chronologically merged into the historical sweep yet, so
// global_relations.json's own FIN entries are still the untouched produce-only
// script baseline even for names fin_relations.json has since fully reviewed
// (produce/consume/grant/atypical/magnifier). See GLOBAL_TAGGING_RULES.md's
// "A name's status can legitimately outrun..." note. Without this, every
// theme reachable only through FIN cards looks purely one-sided (all
// `produce`, no `consume`) and computeWeakThemeIds classifies it as weak —
// which zeroes out the default/reset/"Strong" theme selection entirely for
// any query that resolves to FIN cards (e.g. `sf=set:fin`, or a FIN card
// pasted into a deck import).
const relationsByName = new Map<string, RelationsEntry>([
  ...(relationsData as unknown as RelationsEntry[]).map((r): [string, RelationsEntry] => [r.name, r]),
  ...(finRelationsData as unknown as RelationsEntry[]).map((r): [string, RelationsEntry] => [r.name, r]),
]);

export interface ImageUris {
  normal: string;
  art_crop?: string;
}
export interface CardFace {
  // A DFC's own top-level `name` is both faces joined by " // " — kept here
  // (and passed through by minimalCard() below) so the CLIENT can match a
  // decklist entry naming just the front face against this response (see
  // useGraphStore.ts's deck-mode qty merge — quantity is client-side-only,
  // this server route never reads it, but the client needs a face name to
  // do its own matching the same way resolveFinCardMeta already does
  // server-side in server/api/card/[set]/[number].ts).
  name?: string;
  colors?: string[];
  type_line?: string;
  keywords?: string[];
  image_uris?: ImageUris;
}
export interface ScryfallCard {
  id: string;
  name: string;
  cmc?: number;
  colors?: string[];
  color_identity?: string[];
  type_line?: string;
  rarity?: string;
  scryfall_uri: string;
  keywords?: string[];
  digital?: boolean;
  image_uris?: ImageUris;
  card_faces?: CardFace[];
  set?: string;
  collector_number?: string;
}

// Strips a raw Scryfall card down to only the fields buildGraph.ts reads —
// drops legalities/prices/rulings_uri/etc, which dwarf the fields we keep.
export function minimalCard(c: ScryfallCard) {
  return {
    id: c.id,
    name: c.name,
    cmc: c.cmc,
    colors: c.colors,
    color_identity: c.color_identity,
    type_line: c.type_line,
    rarity: c.rarity,
    scryfall_uri: c.scryfall_uri,
    keywords: c.keywords,
    digital: c.digital,
    image_uris: c.image_uris ? { normal: c.image_uris.normal, art_crop: c.image_uris.art_crop } : undefined,
    card_faces: c.card_faces?.map((f) => ({
      name: f.name,
      colors: f.colors,
      type_line: f.type_line,
      keywords: f.keywords,
      image_uris: f.image_uris ? { normal: f.image_uris.normal, art_crop: f.image_uris.art_crop } : undefined,
    })),
    set: c.set,
    collector_number: c.collector_number,
  };
}

// Intersects a resolved card list against the tagged relations/themes corpus
// — the same "which of these cards has hand-authored synergy data, and which
// themes does that data actually touch" reduction both routes need.
export function relationsAndThemes(cards: ScryfallCard[]) {
  const relations: { name: string; themes: RelationsEntry['themes'] }[] = [];
  const usedThemeIds = new Set<string>();
  for (const c of cards) {
    const entry = relationsByName.get(c.name);
    if (!entry) continue;
    relations.push({ name: entry.name, themes: entry.themes });
    for (const byTheme of Object.values(entry.themes ?? {})) {
      for (const themeId of Object.keys(byTheme ?? {})) usedThemeIds.add(themeId);
    }
  }
  const themes = (themesData as { id: string; label: string }[]).filter((t) => usedThemeIds.has(t.id));
  return { relations, themes };
}
