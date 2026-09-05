// Bulk-syncs data/cards.db (SQLite, via node:sqlite — built into Node 22+,
// zero new npm dependency) from Scryfall's own bulk-data dump
// (https://api.scryfall.com/bulk-data, the "default_cards" entry — one file,
// every real printing). Replaces the old pattern of ad-hoc per-set static
// JSON snapshots (data/fin/fin_scryfall.json, tagging/sets/*/*_scryfall.json)
// plus live per-card Scryfall API calls for anything not snapshotted — that
// combo just caused a real 429 rate-limit lockout from cumulative live
// lookups. This script makes exactly ONE or TWO real HTTP requests total
// (the bulk-data index, then the dump file itself), never one per card, so
// it can't trip that limit no matter how large the corpus gets.
//
// Usage: node scripts/sync-card-db.mjs
//   (or: node --experimental-sqlite scripts/sync-card-db.mjs on a Node
//   version where node:sqlite still needs the flag — Node 24 here does not)

import { DatabaseSync } from 'node:sqlite';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(ROOT, 'data', 'cards.db');
// Scryfall's current bulk format (checked live 2026-09-05): the bulk-data
// index's `default_cards` entry has a `jsonl_download_uri`, gzip-compressed
// newline-delimited JSON (one card object per line) — NOT the single big
// JSON-array `download_uri` older docs/examples describe. Cached compressed
// (small, ~78MB) rather than decompressed, and decompressed on the fly via a
// stream on every run below — cheap enough not to need its own cache file,
// and avoids holding one huge decompressed string in memory.
const DUMP_CACHE_PATH = join(ROOT, 'data', '.bulk-default-cards.jsonl.gz');

// Cache the downloaded dump locally first — a multi-hundred-MB download is
// not something to risk re-fetching if the insert step below needs a rerun
// (a bug, an interrupted run, schema iteration). Delete the cache file
// yourself to force a fresh download; this script never does it on its own.
async function ensureDumpDownloaded() {
  if (existsSync(DUMP_CACHE_PATH)) {
    console.log(`Using cached dump at ${DUMP_CACHE_PATH} (delete it to force a fresh download)`);
    return;
  }
  console.log('Fetching bulk-data index...');
  const indexRes = await fetch('https://api.scryfall.com/bulk-data', {
    headers: { 'User-Agent': 'mtg-visualizer/0.1', Accept: 'application/json' },
  });
  if (!indexRes.ok) throw new Error(`bulk-data index fetch failed: ${indexRes.status}`);
  const index = await indexRes.json();
  const entry = index.data.find((d) => d.type === 'default_cards');
  if (!entry) throw new Error('no "default_cards" entry in bulk-data index');
  const url = entry.jsonl_download_uri;
  console.log(`Downloading ${entry.type} (${(entry.compressed_size / 1e6).toFixed(0)}MB compressed) from ${url}...`);
  const dumpRes = await fetch(url, { headers: { 'User-Agent': 'mtg-visualizer/0.1' } });
  if (!dumpRes.ok || !dumpRes.body) throw new Error(`dump download failed: ${dumpRes.status}`);
  await pipeline(Readable.fromWeb(dumpRes.body), createWriteStream(DUMP_CACHE_PATH));
  console.log('Dump cached.');
}

function openDb() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      name TEXT NOT NULL,
      scryfall_id TEXT NOT NULL PRIMARY KEY,
      set_code TEXT NOT NULL,
      collector_number TEXT NOT NULL,
      lang TEXT NOT NULL,
      released_at TEXT NOT NULL,
      -- 1 = normal art (not full-art, not borderless, has a nonfoil finish) —
      -- see isNormalArt() below. A name can have hundreds of printings
      -- (Island: 749) including full-art lands, borderless showcases,
      -- foil-only promos, etc. — picking "most recent" alone can and does
      -- land on one of those (verified: a same-day full-art Island printing
      -- was winning the tie over the normal one). This is its own column,
      -- not derived at query time, so "prefer normal art" is a plain sort
      -- key, not a per-row JSON check.
      is_normal INTEGER NOT NULL,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
    CREATE INDEX IF NOT EXISTS idx_cards_set_number ON cards(set_code, collector_number);
    -- Multiple printings share a name (109k rows, far fewer distinct names) —
    -- a by-name lookup wants ONE representative row: normal art first
    -- (is_normal DESC), most-recent printing among those (released_at DESC).
    -- released_at as its own indexed column (not a json_extract on
    -- raw_json) since node:sqlite's JSON1 support isn't guaranteed — this
    -- keeps the "pick one" query a plain sort, no per-row JSON parsing.
    CREATE INDEX IF NOT EXISTS idx_cards_name_pick ON cards(name, is_normal DESC, released_at DESC);

    -- Schema only for now (per the parent session's own "eventually" framing
    -- — populating this from functional-model/cards/*/synergy.json is a
    -- separate follow-up, not done by this script). Keyed by name, same as
    -- cards above. produces_json/wants_json store functional-model/synergy.ts's
    -- own Fact[] shape verbatim (a flexible JSON blob, not a normalized
    -- per-field schema, so a Fact-shape change never forces a migration here
    -- — same reasoning cards.raw_json exists instead of one column per
    -- Scryfall field).
    CREATE TABLE IF NOT EXISTS synergy (
      name TEXT NOT NULL PRIMARY KEY,
      produces_json TEXT NOT NULL,
      wants_json TEXT NOT NULL
    );
  `);
  return db;
}

// Scryfall's bulk dump includes every language/printing; english-only real
// paper/digital-eligible printings keep this from ballooning with foreign
// reprints no part of this app ever queries by name in a non-English form.
// One row per (scryfall id) printing, NOT deduped by name — server/api's own
// by-names lookups pick whichever row they want (e.g. newest/cheapest) same
// as they already choose among Scryfall's own /cards/collection results.
function shouldKeep(card) {
  return card.lang === 'en' && card.set_type !== 'memorabilia';
}

// frame_effects markers that mean "this printing has a different visual
// treatment than the standard black-border frame" — extendedart/showcase/
// inverted/colorshifted/borderless/shatteredglass. NOT included: legendary,
// enchantment, devoid, tombstone, snow, miracle, draft, spree, *dfc,
// companion, convertdfc, lesson, etc — those are functional/layout markers
// every normal printing of that card type also carries, not art variants.
// Found the hard way: "Formidable Speaker" (ecl/366) has
// frame_effects:["extendedart"], border_color:"black", full_art:false,
// finishes:["nonfoil"] — passes every other check below, so without this it
// still landed as is_normal:1 (flagged by a peer session auditing real
// browsing results, not caught by this script's own earlier verification).
const NONSTANDARD_FRAME_EFFECTS = new Set(['extendedart', 'showcase', 'inverted', 'colorshifted', 'borderless', 'shatteredglass']);

// "Normal art" = not full-art, not a promo (Scryfall's own `promo` flag —
// catches prerelease/love-your-lgs/set-promo stamps generally, not just
// Secret Lair; found via a tie: "Formidable Speaker" had two is_normal
// candidates released the same day, and the promo printing was winning the
// tiebreak), not borderless, has a plain nonfoil finish available, no
// non-standard frame treatment (see NONSTANDARD_FRAME_EFFECTS above), and
// not a Secret Lair Drop/Countdown/Ultimate Edition (set_name starts with
// "Secret Lair" — kept as its own check alongside `promo` since it's the
// more specific/legible signal for that one case, even though `promo` alone
// already covers most Secret Lair printings too).
function isNormalArt(card) {
  return (
    !card.full_art &&
    !card.promo &&
    card.border_color !== 'borderless' &&
    (card.finishes ?? []).includes('nonfoil') &&
    !(card.frame_effects ?? []).some((fx) => NONSTANDARD_FRAME_EFFECTS.has(fx)) &&
    !(card.set_name ?? '').startsWith('Secret Lair')
  );
}

// Streamed line-by-line (gunzip -> readline), never loaded as one JSON.parse
// over the whole decompressed file — a few hundred MB of JSONL text as a
// single in-memory string is wasteful when each line is already a complete,
// independent JSON value.
async function syncStreamed(db) {
  const gunzip = createGunzip();
  const fileStream = createReadStream(DUMP_CACHE_PATH);
  const lines = createInterface({ input: fileStream.pipe(gunzip), crlfDelay: Infinity });

  db.exec('DELETE FROM cards');
  const insert = db.prepare(
    'INSERT INTO cards (name, scryfall_id, set_code, collector_number, lang, released_at, is_normal, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  let total = 0;
  let kept = 0;
  db.exec('BEGIN TRANSACTION');
  try {
    for await (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === '[' || trimmed === ']') continue; // JSONL has no wrapping brackets, but tolerate them if the format ever adds one
      const c = JSON.parse(trimmed.replace(/,$/, ''));
      total++;
      if (!shouldKeep(c)) continue;
      insert.run(c.name, c.id, c.set, c.collector_number, c.lang, c.released_at ?? '', isNormalArt(c) ? 1 : 0, JSON.stringify(c));
      kept++;
      if (kept % 50000 === 0) console.log(`  ...${kept} rows inserted (${total} lines read)`);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  console.log(`Read ${total} total printings (all languages), kept ${kept}.`);
}

async function main() {
  await ensureDumpDownloaded();
  const db = openDb();
  console.log('Streaming dump into cards table...');
  const start = Date.now();
  await syncStreamed(db);
  console.log(`Synced in ${Date.now() - start}ms. data/cards.db ready.`);
  const { count } = db.prepare('SELECT COUNT(*) as count FROM cards').get();
  console.log(`Row count: ${count}`);
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
