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
import { isStandardPrint } from '../utils/isStandardPrint';

// Hard cap on cards fetched/returned per query, regardless of how many the
// query actually matches — keeps one broad query from paginating for minutes
// or shipping a multi-MB response. Never fetched past; see `truncated` below.
const MAX_CARDS = 500;

// Scryfall's own `unique=cards` already collapses each match to one
// representative printing, but ITS pick isn't always a standard one — same
// gap server/api/cards/by-names.ts's own preferStandardPrint closes for a
// name lookup. Skipped entirely when the user's own query already expresses
// printing intent (frame/border/finish/etc.) — unlike a plain name lookup, a
// free-typed Scryfall query CAN deliberately ask for a showcase/foil/full-art
// printing, and silently swapping every match back to a standard print would
// defeat that search outright rather than just picking a nicer default.
const PRINTING_INTENT_RE = /\b(is|not|frame|border|finish|stamp|game|art|lang):|(?:^|\s)(foil|nonfoil|etched)\b/i;

async function fetchStandardPrintForName(name: string): Promise<ScryfallCard | null> {
  try {
    const q = `!"${name}" -is:extendedart -is:showcase -is:borderless -is:colorshifted -is:full -is:promo`;
    const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=cards&order=released&dir=desc`, {
      headers: { 'User-Agent': 'mtg-visualizer/0.1', Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data: { data: ScryfallCard[] } = await res.json();
    return data.data[0] ?? null;
  } catch {
    return null;
  }
}
// Falls back to the original card (better than nothing) if the re-resolve
// search comes up empty — e.g. a card that genuinely only ever got a
// showcase/full-art treatment, no standard printing to swap to.
async function preferStandardPrint(card: ScryfallCard): Promise<ScryfallCard> {
  if (isStandardPrint(card)) return card;
  const standard = await fetchStandardPrintForName(card.name);
  return standard ?? card;
}
// Small concurrency cap with a stagger between chunks — a broad query can
// flag a lot more matches at once than a typical decklist (by-names.ts's own
// equivalent has no such cap, but that route only ever sees as many names as
// a real decklist has; this one can hit MAX_CARDS), and this is the same
// class of per-request burst that tripped a real Scryfall 429 lockout
// earlier this project.
const REPRINT_CHUNK_SIZE = 10;
async function preferStandardPrints(cards: ScryfallCard[]): Promise<ScryfallCard[]> {
  const result: ScryfallCard[] = [];
  for (let i = 0; i < cards.length; i += REPRINT_CHUNK_SIZE) {
    const chunk = cards.slice(i, i + REPRINT_CHUNK_SIZE);
    result.push(...(await Promise.all(chunk.map(preferStandardPrint))));
    if (i + REPRINT_CHUNK_SIZE < cards.length) await new Promise((r) => setTimeout(r, 100));
  }
  return result;
}

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

  const rawMatched = cards.slice(0, MAX_CARDS);
  const truncated = totalCards > rawMatched.length;
  const matched = PRINTING_INTENT_RE.test(q) ? rawMatched : await preferStandardPrints(rawMatched);
  const { relations, themes } = relationsAndThemes(matched);

  return {
    cards: matched.map(minimalCard),
    relations,
    themes,
    totalCards,
    truncated,
  };
});
