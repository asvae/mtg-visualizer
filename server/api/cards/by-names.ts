// Deck-import card subset (see useGraphStore.ts's `deck` mode, populated from
// app/lib/deckImport.ts's parsed name list): resolves an exact-name list
// against the local card database (data/cards.db, see
// scripts/sync-card-db.mjs) instead of live Scryfall — this route used to
// batch Scryfall's own /cards/collection endpoint, which is what tripped a
// real 429 rate-limit lockout on this sandbox earlier the same session. The
// DB is bulk-synced from Scryfall's own bulk-data dump (one download, not
// one request per card), so a lookup here never touches the network at all.
// A name genuinely missing from the DB (sync is stale, or a real Scryfall
// typo) surfaces via `unmatched` same as before — this route does NOT fall
// back to a live Scryfall call on a miss; that would silently mask a sync
// problem instead of surfacing it.
//
// Then intersects the matches against the tagged relations/themes corpus,
// same treatment server/api/cards.ts's Scryfall-search leg already gets —
// see ./_cardShaping.ts, shared between both routes.
//
// Identity only — quantity is a client-side-only concern (useGraphStore.ts
// merges each card's qty back in from its own already-parsed decklist after
// this response comes back), this route never sees or needs it.
//
// POST /api/cards/by-names, body { names: string[] }

import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { minimalCard, relationsAndThemes, type ScryfallCard } from '../_cardShaping';

// Opened once per server process (not per-request) — SQLite supports
// concurrent readers on one file fine, and re-opening on every request would
// just add needless syscall overhead. `readOnly` — this route only ever
// reads; scripts/sync-card-db.mjs is the only writer, and it runs standalone
// (not from within a request), so there's no concurrent-writer case to guard
// against here.
const db = new DatabaseSync(join(process.cwd(), 'data', 'cards.db'), { readOnly: true });
// Multiple printings share a name — ORDER BY released_at DESC picks the most
// recent one (freshest wording/art), same intent Scryfall's own
// /cards/collection default-picks by. See sync-card-db.mjs's own schema
// comment for why released_at is its own column, not a json_extract.
const exactStmt = db.prepare('SELECT raw_json FROM cards WHERE name = ? ORDER BY released_at DESC LIMIT 1');
// A DFC's own top-level `name` is "Front // Back" — a decklist naming just
// the front face needs this fallback (same front-face pattern
// useGraphStore.ts/buildGraph.ts already apply client-side for the same
// reason). ESCAPE so a card name that happens to contain a literal `%`/`_`
// (rare, but real — e.g. "Borrowing 100,000 Arrows") doesn't get misread as
// a wildcard.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);
const dfcStmt = db.prepare("SELECT raw_json FROM cards WHERE name LIKE ? ESCAPE '\\' ORDER BY released_at DESC LIMIT 1");

function lookupByName(name: string): ScryfallCard | null {
  const exact = exactStmt.get(name) as { raw_json: string } | undefined;
  if (exact) return JSON.parse(exact.raw_json);
  const dfc = dfcStmt.get(`${escapeLike(name)} // %`) as { raw_json: string } | undefined;
  if (dfc) return JSON.parse(dfc.raw_json);
  return null;
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  const names: string[] | undefined = body?.names;
  if (!names || !Array.isArray(names) || names.length === 0) {
    setResponseStatus(event, 400);
    return { error: 'missing "names" (non-empty string array) in request body' };
  }

  const uniqueNames = [...new Set(names)];

  const found: ScryfallCard[] = [];
  const unmatched: string[] = [];
  for (const name of uniqueNames) {
    const card = lookupByName(name);
    if (card) found.push(card);
    else unmatched.push(name);
  }

  const { relations, themes } = relationsAndThemes(found);

  return {
    cards: found.map(minimalCard),
    relations,
    themes,
    unmatched,
  };
});
