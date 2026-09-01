// Query-scoped card subset for the "scryfall filter" URL leg (see
// useGraphStore.ts's `sf` param): resolves an arbitrary Scryfall search
// against the live Scryfall API, then intersects the matches against the
// already-tagged data/global_relations.json / data/global_themes.json corpus,
// and hands the frontend back just enough to run through buildGraph.ts — same
// shape as the per-set static files, just built on the fly instead of checked
// in. Nitro deploys this route as a Netlify Function automatically (see
// nuxt.config.ts's netlify preset).
//
// GET /api/cards?q=<scryfall search syntax>

import relationsData from '../../data/global_relations.json';
import finRelationsData from '../../data/fin/fin_relations.json';
import themesData from '../../data/global_themes.json';

// Hard cap on cards fetched/returned per query, regardless of how many the
// query actually matches — keeps one broad query from paginating for minutes
// or shipping a multi-MB response. Never fetched past; see `truncated` below.
const MAX_CARDS = 500;

interface RelationsEntry {
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
// any `sf=` query that resolves to FIN cards (e.g. `sf=set:fin`).
const relationsByName = new Map<string, RelationsEntry>([
  ...(relationsData as unknown as RelationsEntry[]).map((r): [string, RelationsEntry] => [r.name, r]),
  ...(finRelationsData as unknown as RelationsEntry[]).map((r): [string, RelationsEntry] => [r.name, r]),
]);

interface ImageUris {
  normal: string;
}
interface CardFace {
  colors?: string[];
  type_line?: string;
  keywords?: string[];
  image_uris?: ImageUris;
}
interface ScryfallCard {
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
function minimalCard(c: ScryfallCard) {
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
    image_uris: c.image_uris ? { normal: c.image_uris.normal } : undefined,
    card_faces: c.card_faces?.map((f) => ({
      colors: f.colors,
      type_line: f.type_line,
      keywords: f.keywords,
      image_uris: f.image_uris ? { normal: f.image_uris.normal } : undefined,
    })),
    set: c.set,
    collector_number: c.collector_number,
  };
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event).q as string | undefined;
  if (!q) {
    setResponseStatus(event, 400);
    return { error: 'missing "q" query param' };
  }

  const cards: ScryfallCard[] = [];
  let totalCards = 0;
  let nextUrl: string | null = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=cards`;
  let firstPage = true;

  while (nextUrl && cards.length < MAX_CARDS) {
    const res: Response = await fetch(nextUrl, {
      headers: { 'User-Agent': 'mtg-visualizer/0.1', Accept: 'application/json' },
    });
    if (res.status === 404) break; // Scryfall's "no matches" response — empty result, not an error
    const data: any = await res.json();
    if (!res.ok) {
      setResponseStatus(event, 502);
      return { error: data.details || 'Scryfall request failed' };
    }

    if (firstPage) {
      totalCards = data.total_cards ?? data.data.length;
      firstPage = false;
    }
    cards.push(...data.data);
    nextUrl = data.has_more ? data.next_page : null;
    if (nextUrl && cards.length < MAX_CARDS) await new Promise((r) => setTimeout(r, 100)); // be polite to Scryfall
  }

  const matched = cards.slice(0, MAX_CARDS);
  const truncated = totalCards > matched.length;

  const relations: { name: string; themes: RelationsEntry['themes'] }[] = [];
  const usedThemeIds = new Set<string>();
  for (const c of matched) {
    const entry = relationsByName.get(c.name);
    if (!entry) continue;
    relations.push({ name: entry.name, themes: entry.themes });
    for (const byTheme of Object.values(entry.themes ?? {})) {
      for (const themeId of Object.keys(byTheme ?? {})) usedThemeIds.add(themeId);
    }
  }
  const themes = (themesData as { id: string; label: string }[]).filter((t) => usedThemeIds.has(t.id));

  return {
    cards: matched.map(minimalCard),
    relations,
    themes,
    totalCards,
    truncated,
  };
});
