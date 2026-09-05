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

import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { minimalCard, relationsAndThemes, type ScryfallCard } from '../_cardShaping';

// data/cards.db is gitignored (600MB+, regenerated locally via
// scripts/sync-card-db.mjs, never committed) — a deployed instance (Netlify
// Functions ship only what's in the repo) never has it. `db` is null there,
// and lookupByName falls back to Scryfall's own batched /cards/collection
// endpoint (see fetchLiveCollection below) instead of throwing. Local dev
// gets the fast no-network path; prod gets the slower but working one.
const DB_PATH = join(process.cwd(), 'data', 'cards.db');
// Opened once per server process (not per-request) — SQLite supports
// concurrent readers on one file fine, and re-opening on every request would
// just add needless syscall overhead. `readOnly` — this route only ever
// reads; scripts/sync-card-db.mjs is the only writer, and it runs standalone
// (not from within a request), so there's no concurrent-writer case to guard
// against here.
const db = existsSync(DB_PATH) ? new DatabaseSync(DB_PATH, { readOnly: true }) : null;
// Multiple printings share a name — is_normal DESC first (normal art: not
// full-art, not borderless, has a nonfoil finish, not Secret Lair — see
// sync-card-db.mjs's own isNormalArt()), then released_at DESC picks the
// most recent among those. Without the is_normal preference, "most recent"
// alone can and did land on a full-art/borderless/Secret-Lair variant
// instead (verified against a same-day full-art Island printing outranking
// the normal one).
const exactStmt = db?.prepare('SELECT raw_json FROM cards WHERE name = ? ORDER BY is_normal DESC, released_at DESC LIMIT 1') ?? null;
// A DFC's own top-level `name` is "Front // Back" — a decklist naming just
// the front face needs this fallback (same front-face pattern
// useGraphStore.ts/buildGraph.ts already apply client-side for the same
// reason). ESCAPE so a card name that happens to contain a literal `%`/`_`
// (rare, but real — e.g. "Borrowing 100,000 Arrows") doesn't get misread as
// a wildcard.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);
const dfcStmt = db?.prepare("SELECT raw_json FROM cards WHERE name LIKE ? ESCAPE '\\' ORDER BY is_normal DESC, released_at DESC LIMIT 1") ?? null;

function lookupByNameFromDb(name: string): ScryfallCard | null {
  if (!exactStmt || !dfcStmt) return null;
  const exact = exactStmt.get(name) as { raw_json: string } | undefined;
  if (exact) return JSON.parse(exact.raw_json);
  const dfc = dfcStmt.get(`${escapeLike(name)} // %`) as { raw_json: string } | undefined;
  if (dfc) return JSON.parse(dfc.raw_json);
  return null;
}

// Prod fallback (no local DB): Scryfall's own /cards/collection batches up
// to 75 identifiers per request — a whole deck (even several hundred cards)
// resolves in a handful of requests, never one per card, so this can't trip
// the same per-card-burst 429 lockout that motivated building cards.db in
// the first place. `not_found` entries fall through to a per-name fuzzy
// lookup below (collection matching is exact-name only, so a DFC named by
// just its front face — e.g. "Jecht, Reluctant Guardian" for "Jecht,
// Reluctant Guardian // Braska's Final Aeon" — legitimately misses here).
const COLLECTION_BATCH_SIZE = 75;
async function fetchLiveCollection(names: string[]): Promise<{ found: ScryfallCard[]; notFound: string[] }> {
  const found: ScryfallCard[] = [];
  const notFound: string[] = [];
  for (let i = 0; i < names.length; i += COLLECTION_BATCH_SIZE) {
    const batch = names.slice(i, i + COLLECTION_BATCH_SIZE);
    const res = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { 'User-Agent': 'mtg-visualizer/0.1', 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identifiers: batch.map((name) => ({ name })) }),
    });
    if (!res.ok) {
      notFound.push(...batch);
      continue;
    }
    const data: { data: ScryfallCard[]; not_found: { name?: string }[] } = await res.json();
    found.push(...data.data);
    notFound.push(...batch.filter((name) => !data.data.some((c) => c.name === name)));
  }
  return { found, notFound };
}

// Front-face-only DFC names (see fetchLiveCollection's own comment) — fuzzy
// is safe here since these are already known-real card names, just not
// matched exactly against a DFC's combined "Front // Back" name.
async function fetchLiveFuzzy(name: string): Promise<ScryfallCard | null> {
  try {
    const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`, {
      headers: { 'User-Agent': 'mtg-visualizer/0.1', Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
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

  if (db) {
    for (const name of uniqueNames) {
      const card = lookupByNameFromDb(name);
      if (card) found.push(card);
      else unmatched.push(name);
    }
  } else {
    const { found: liveFound, notFound } = await fetchLiveCollection(uniqueNames);
    found.push(...liveFound);
    for (const name of notFound) {
      const fuzzy = await fetchLiveFuzzy(name);
      if (fuzzy) found.push(fuzzy);
      else unmatched.push(name);
    }
  }

  const { relations, themes } = relationsAndThemes(found);

  return {
    cards: found.map(minimalCard),
    relations,
    themes,
    unmatched,
  };
});
