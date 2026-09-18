// Shared functional-model card-name -> real Scryfall meta (set/collector
// number/image) resolver — extracted (2026-09-18) from
// `server/api/card/[set]/[number].ts`'s own private
// `resolveFunctionalModelCardMeta`/`cardMetaCache` so a second consumer
// (`server/api/sink-catalog/index.get.ts`'s own "real FDN pool matches"
// enrichment) reuses the EXACT same three-leg resolution (FIN's own
// `fin_scryfall.json`, then the local bulk `data/cards.db` sync, then a live,
// paced Scryfall call) and the same forever-per-process cache, rather than
// re-deriving a second copy that could drift or re-trip the same 429 this
// mechanism exists to avoid (see `server/utils/scryfallFetch.ts`'s own doc
// comment for that history). `server/api/card/[set]/[number].ts` now imports
// this module directly too — no private copy left behind to drift.
//
// Interaction-match thumbnail resolution is the real cost center on any
// route that calls this per-match: a popular card (e.g. a staple mana dork,
// or a wide sink-catalog match list like `battlefield-presence`'s 100+ real
// FDN pool matches) can run this dozens to hundreds of times per request,
// each ~6-7ms on the local-DB path (mostly `node:sqlite`'s own per-call
// overhead) — cheap in dev, but the reason this is cached forever per
// process (not folder-mtime-invalidated) rather than looked up fresh each
// time: a name's real set/collectorNumber/image barely ever changes
// minute-to-minute (only a `data/cards.db` re-sync or a `fin_scryfall.json`
// edit would change it, neither of which happens while this server process
// is running). Restart the dev server after a re-sync to see fresh data.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isStandardPrint } from './isStandardPrint';
import { scryfallFetch } from './scryfallFetch';

export interface CardMetaRef {
  set: string;
  collectorNumber: string;
  image: string | null;
}

// A DFC's own top-level `name` is "Front // Back," but a functional-model
// card almost always names just the front face — every lookup leg below
// (FIN's own data, the local DB, a live Scryfall call) needs to tolerate
// that and fall back to searching each face's own name too.
interface FinScryfallCard {
  name: string;
  set: string;
  collector_number: string;
  image_uris?: { normal?: string };
  card_faces?: { name: string; image_uris?: { normal?: string } }[];
  // Only present on a live Scryfall response (never on fin_scryfall.json's
  // own stripped-down shape) — read by isStandardPrint() below.
  full_art?: boolean;
  promo?: boolean;
  border_color?: string;
  finishes?: string[];
  frame_effects?: string[];
  set_name?: string;
}

// Read fresh off disk on every request in dev (not a statically bundled
// import), so a hand-edited data file reflects immediately without a full
// dev-server restart. Falls back to `bundled` for a production build
// (different cwd, raw source tree not shipped).
function loadJsonFresh<T>(relativePath: string, bundled: T): T {
  if (process.env.NODE_ENV === 'production') return bundled;
  try {
    return JSON.parse(readFileSync(join(process.cwd(), relativePath), 'utf8'));
  } catch {
    return bundled;
  }
}

function resolveFinCardMeta(name: string): CardMetaRef | null {
  const entries = loadJsonFresh('data/fin/fin_scryfall.json', [] as FinScryfallCard[]);
  for (const c of entries) {
    if (c.name === name) return { set: c.set, collectorNumber: c.collector_number, image: c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null };
    const face = c.card_faces?.find((f) => f.name === name);
    // A true DFC's own faces each carry their own image; an Adventure-layout
    // card's faces (e.g. "Midgar, City of Mako // Reactor Raid") don't —
    // Scryfall renders those as one single card image, at the top level
    // only — so fall back to the card's own `image_uris` rather than null.
    if (face) return { set: c.set, collectorNumber: c.collector_number, image: face.image_uris?.normal ?? c.image_uris?.normal ?? null };
  }
  return null;
}

// data/cards.db — bulk-synced from Scryfall's own bulk-data dump (see
// scripts/sync-card-db.mjs). It's gitignored (600MB+, regenerated locally,
// never committed) so it does NOT exist on a deployed instance (Netlify
// Functions ship only what's in the repo) — `cardsDb` is therefore null in
// prod, and every lookup below falls back to a live, paced Scryfall call
// instead of throwing. Local dev gets the fast no-network path; prod gets
// the slower but working one. Exported so `server/api/card/[set]/[number].ts`
// can reuse this SAME connection for its own, unrelated set/number and
// scryfall-id lookups rather than opening a second handle onto the same
// file.
const CARDS_DB_PATH = join(process.cwd(), 'data', 'cards.db');
export const cardsDb = existsSync(CARDS_DB_PATH) ? new DatabaseSync(CARDS_DB_PATH, { readOnly: true }) : null;
const dbExactNameStmt = cardsDb?.prepare('SELECT raw_json FROM cards WHERE name = ? ORDER BY is_normal DESC, released_at DESC LIMIT 1') ?? null;
// ESCAPE so a name containing a literal `%`/`_` isn't misread as a wildcard.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);
const dbDfcNameStmt = cardsDb?.prepare("SELECT raw_json FROM cards WHERE name LIKE ? ESCAPE '\\' ORDER BY is_normal DESC, released_at DESC LIMIT 1") ?? null;
function dbLookupByName(name: string): FinScryfallCard | null {
  if (!dbExactNameStmt || !dbDfcNameStmt) return null;
  const exact = dbExactNameStmt.get(name) as { raw_json: string } | undefined;
  if (exact) return JSON.parse(exact.raw_json);
  const dfc = dbDfcNameStmt.get(`${escapeLike(name)} // %`) as { raw_json: string } | undefined;
  if (dfc) return JSON.parse(dfc.raw_json);
  return null;
}

async function fetchStandardPrintForName(name: string): Promise<FinScryfallCard | null> {
  try {
    const q = `!"${name}" -is:extendedart -is:showcase -is:borderless -is:colorshifted -is:full -is:promo`;
    const res = await scryfallFetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=cards&order=released&dir=desc`);
    if (!res.ok) return null;
    const data: { data: FinScryfallCard[] } = await res.json();
    return data.data[0] ?? null;
  } catch {
    return null;
  }
}

// Live fallback for whatever the local DB doesn't have (prod, where the DB
// never exists at all — see cardsDb above), paced through the shared
// `scryfallFetch`. `exact` (not fuzzy) — a functional-model card's own
// `name` is already Scryfall's real name, no typo-tolerance needed.
async function resolveLiveCardMeta(name: string): Promise<CardMetaRef | null> {
  try {
    const res = await scryfallFetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    let c: FinScryfallCard = await res.json();
    // Scryfall's own "default printing" pick for a bare name isn't
    // guaranteed to be is_normal-worthy (showcase/extended-art/promo can win
    // — the same gap the local DB's is_normal column exists to close, see
    // scripts/sync-card-db.mjs). Re-resolve via search when it isn't; only
    // hit for a flagged card, so this stays rare.
    if (!isStandardPrint(c)) {
      const standard = await fetchStandardPrintForName(name);
      if (standard) c = standard;
    }
    return { set: c.set, collectorNumber: c.collector_number, image: c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null };
  } catch {
    return null;
  }
}

// Real set/collectorNumber/image for a functional-model card's own name —
// tries FIN's real Scryfall data first (free, already-parsed, current), then
// the local bulk DB (see dbLookupByName above) when it exists, then a live
// Scryfall lookup for whatever neither covers (always the case in prod).
// This ALSO correctly resolves an FDN-only name (an FDN card is a real,
// currently-printed Scryfall card, and `data/cards.db` is synced across
// every set, not just `fin`) — only the first leg (`resolveFinCardMeta`,
// FIN-only `fin_scryfall.json`) can never match one, which is fine, it's
// just one more ordinary miss that falls through to the next leg.
const cardMetaCache = new Map<string, CardMetaRef | null>();
export async function resolveFunctionalModelCardMeta(name: string): Promise<CardMetaRef | null> {
  const cached = cardMetaCache.get(name);
  if (cached !== undefined) return cached;

  const fin = resolveFinCardMeta(name);
  if (fin) {
    cardMetaCache.set(name, fin);
    return fin;
  }
  const c = dbLookupByName(name);
  if (c) {
    const resolved = { set: c.set, collectorNumber: c.collector_number, image: c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null };
    cardMetaCache.set(name, resolved);
    return resolved;
  }
  const live = await resolveLiveCardMeta(name);
  cardMetaCache.set(name, live);
  return live;
}
