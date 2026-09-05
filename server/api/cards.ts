// Query-scoped card subset for the "scryfall filter" URL leg (see
// useGraphStore.ts's `sf` param): resolves an arbitrary Scryfall search
// against the live Scryfall API, then intersects the matches against the
// already-tagged data/global_relations.json / data/global_themes.json corpus,
// and hands the frontend back just enough to run through buildGraph.ts — same
// shape as the per-set static files, just built on the fly instead of checked
// in. Nitro deploys this route as a Netlify Function automatically (see
// nuxt.config.ts's netlify preset).
//
// POST /api/cards, body { q: <scryfall search syntax> } — POST (not the `q`
// query-string param the shareable `/app?sf=...` page URL itself still uses)
// so this and server/api/cards/by-names.ts's deck-import lookup share one
// calling convention from useGraphStore.ts's own load().

import { minimalCard, relationsAndThemes, type ScryfallCard } from './_cardShaping';

// Hard cap on cards fetched/returned per query, regardless of how many the
// query actually matches — keeps one broad query from paginating for minutes
// or shipping a multi-MB response. Never fetched past; see `truncated` below.
const MAX_CARDS = 500;

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  const q = body?.q as string | undefined;
  if (!q) {
    setResponseStatus(event, 400);
    return { error: 'missing "q" in request body' };
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
  const { relations, themes } = relationsAndThemes(matched);

  return {
    cards: matched.map(minimalCard),
    relations,
    themes,
    totalCards,
    truncated,
  };
});
