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

import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { minimalCard, relationsAndThemes, type ScryfallCard } from './_cardShaping';
import { isStandardPrint } from '../utils/isStandardPrint';

// Hard cap on cards fetched/returned per query, regardless of how many the
// query actually matches — keeps one broad query from paginating for minutes
// or shipping a multi-MB response. Never fetched past; see `truncated` below.
const MAX_CARDS = 500;

// Local-DB-first path for the ONE query shape that actually caused a live
// 429 lockout: SearchBox.vue's discover typeahead sends `name:"<term>"` on
// every debounced keystroke (see runDiscoverFetch there) — a burst of
// distinct live Scryfall searches with no batching at all, unlike this same
// route's other query shapes (a free-typed `?sf=` query, full Scryfall search
// grammar) which stay rare/deliberate by comparison. Same `data/cards.db`
// local mirror server/api/cards/by-names.ts already uses for its own
// previously-429'd path (see that file's own header comment) — gitignored,
// 600MB+, synced via scripts/sync-card-db.mjs, absent on a deployed instance
// (Netlify Functions ship only what's in the repo). `db` null there falls
// straight through to the existing live-Scryfall path below, unchanged.
const DB_PATH = join(process.cwd(), 'data', 'cards.db');
const db = existsSync(DB_PATH) ? new DatabaseSync(DB_PATH, { readOnly: true }) : null;

// Matches ONLY the exact shape SearchBox.vue's discover fetch sends (a bare
// `name:"..."` query, nothing else appended) — deliberately narrow. A query
// with anything else in it (color/type/set filters, boolean combinations,
// OR'd terms, etc.) falls through to live Scryfall unchanged; this local path
// doesn't attempt to reimplement Scryfall's own search grammar.
const NAME_QUERY_RE = /^name:"([^"]*)"$/i;

// Discover is a partial/typeahead search (substring, not exact-name
// resolution like by-names.ts's own lookup) — LIKE special chars escaped so
// a term containing a literal `%`/`_` isn't misread as a wildcard.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

// Step 1: which distinct card NAMES contain the term at all — a name can
// have hundreds of printings (see by-names.ts's own comment on this), so this
// is deliberately DISTINCT rather than one row per printing. Prefix matches
// ("Jecht" at the very start of the name) sort ahead of a mid-name substring
// hit, then shorter/alphabetical as a stable tiebreak — the same "most
// relevant first" ordering a typeahead box needs, since MAX_CARDS can and
// does cut off a broad single-letter-ish query before every match is shown.
const nameSearchStmt = db?.prepare(
  `SELECT DISTINCT name FROM cards WHERE name LIKE ? ESCAPE '\\'
   ORDER BY (CASE WHEN name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END), length(name) ASC, name ASC
   LIMIT ?`
) ?? null;
// Step 2: for each matching name, the same "best representative printing"
// pick server/api/cards/by-names.ts's own exactStmt already uses (normal art
// preferred, most recent among those) — reused query shape, not reinvented.
const bestPrintingStmt = db?.prepare(
  'SELECT raw_json FROM cards WHERE name = ? ORDER BY is_normal DESC, released_at DESC LIMIT 1'
) ?? null;

// Returns null (not []) when the local DB can't serve this at all, so the
// caller can tell "no local matches" apart from "no local DB present."
function searchNamesFromDb(term: string): { cards: ScryfallCard[]; truncated: boolean } | null {
  if (!nameSearchStmt || !bestPrintingStmt) return null;
  const escaped = escapeLike(term);
  // Fetch one past the cap to detect truncation without a separate COUNT query.
  const rows = nameSearchStmt.all(`%${escaped}%`, `${escaped}%`, MAX_CARDS + 1) as { name: string }[];
  const truncated = rows.length > MAX_CARDS;
  const names = truncated ? rows.slice(0, MAX_CARDS) : rows;
  const cards: ScryfallCard[] = [];
  for (const { name } of names) {
    const row = bestPrintingStmt.get(name) as { raw_json: string } | undefined;
    if (row) cards.push(JSON.parse(row.raw_json));
  }
  return { cards, truncated };
}

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

  // Local-DB-first: only for the exact `name:"..."` shape discover typeahead
  // sends, and only when a term is actually present (an empty `name:""`
  // would otherwise LIKE-match every row in the table). Anything else (a
  // free-typed `?sf=` query with real Scryfall grammar) falls through to the
  // live path below unchanged, same as when `db` itself is null (prod).
  const nameMatch = q.match(NAME_QUERY_RE);
  const nameTerm = nameMatch?.[1];
  if (db && nameTerm) {
    const local = searchNamesFromDb(nameTerm);
    if (local) {
      const { relations, themes } = relationsAndThemes(local.cards);
      return {
        cards: local.cards.map(minimalCard),
        relations,
        themes,
        totalCards: local.cards.length,
        truncated: local.truncated,
      };
    }
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
