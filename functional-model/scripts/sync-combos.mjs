// Bulk-syncs data/combos.json from Commander Spellbook's own published bulk
// dump (https://json.commanderspellbook.com/variants.json.gz) — a combo
// database for Commander/EDH (github.com/SpaceCowMedia/commander-spellbook-backend,
// MIT), covering the whole card pool, not just FIN. Their own API schema
// explicitly asks consumers NOT to paginate the live `/variants/` endpoint
// for a full export ("costs you time and us a ton of resources") and
// publishes this one refreshed-periodically file instead — same reasoning
// sync-card-db.mjs already follows for Scryfall's own bulk dump, new source.
//
// Output is set-agnostic on purpose (see this project's own memory on this:
// data/fin/ is a deprecated per-set staging pattern, not one to extend) —
// data/combos.json has no "fin" anywhere in its path or schema. What IS
// scoped to FIN today is only the FILTER below: a combo is kept iff at least
// one of its real cards is in the currently-modeled functional-model/cards/
// pool, which happens to be 100% FIN today simply because that's the only
// folders that exist. Add another set's cards to that same pool later and
// rerun this unchanged script — it starts keeping FIN+that-set-mixed combos
// for free, no schema/rename needed. A combo's OTHER (non-pool) cards are
// kept too, not discarded — they're genuinely required for the interaction,
// same reasoning a "FIN cards only" cut turned out to keep exactly zero
// combos (verified: not one real combo is 100% FIN-only cards).
//
// Stored per real Commander Spellbook VARIANT (a specific card-substitution
// instance), not deduped to their own combo "template" id — two variants of
// the same template can name genuinely different real cards in an
// interchangeable slot, and matching against an actual deck/graph works off
// real card names, not a template id. `templateId` (their own `of[].id`) is
// kept alongside each row so a future UI can still group substitution
// variants of the same underlying combo if it wants to.
//
// Usage: npx vite-node functional-model/scripts/sync-combos.mjs
//   (plain `node` doesn't work — see functional-model/README.md's own
//   "Regenerating" section for why: this script dynamic-imports each real
//   cards/<slug>/definition.ts, an extensionless relative import only
//   Vite/Nuxt's bundler-style resolution — not plain Node's — follows.)

import { createReadStream, createWriteStream, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { join } from 'node:path';

const ROOT = process.cwd();
const CARDS_DIR = join(ROOT, 'functional-model/cards');
const CARDS_DIR_URL = new URL('../cards/', import.meta.url);
const DUMP_CACHE_PATH = join(ROOT, 'data', '.bulk-commander-spellbook-variants.json.gz');
const OUT_PATH = join(ROOT, 'data', 'combos.json');
const BULK_URL = 'https://json.commanderspellbook.com/variants.json.gz';
const USER_AGENT = 'mtg-visualizer/0.1';

// --- 1. The current card pool (today: 100% FIN, but this doesn't know or
// care — it's just "every card functional-model/cards/ currently models") ---
async function currentPoolNames() {
  const slugs = readdirSync(CARDS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const names = new Set();
  for (const slug of slugs) {
    try {
      const mod = await import(new URL(`${slug}/definition.ts`, CARDS_DIR_URL).href);
      const card = Object.values(mod)[0];
      if (card?.name) names.add(card.name);
    } catch {
      // definition.ts failed to import — same "skip, don't crash the whole
      // run" treatment functionalModelPool.ts's own loader already applies.
    }
  }
  return names;
}

// --- 2. Cache the bulk file locally first (27MB compressed) — same
// reasoning sync-card-db.mjs's own ensureDumpDownloaded already documents:
// don't risk re-fetching a multi-tens-of-MB download if the parse step below
// needs a rerun. Delete the cache file yourself to force a fresh pull. -----
async function ensureDumpDownloaded() {
  if (existsSync(DUMP_CACHE_PATH)) {
    console.log(`Using cached dump at ${DUMP_CACHE_PATH} (delete it to force a fresh download)`);
    return;
  }
  console.log(`Downloading ${BULK_URL}...`);
  const res = await fetch(BULK_URL, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/octet-stream' } });
  if (!res.ok || !res.body) throw new Error(`bulk dump download failed: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(DUMP_CACHE_PATH));
  console.log('Dump cached.');
}

// --- 3. Stream-decompress + scan for `"variants": [ ... ]` entries without
// ever materializing the 646MB decompressed doc as one JS string (Node's own
// string-length ceiling can't hold it) or one parsed object tree. Chunk-slice
// brace-depth tracking, not a general streaming-JSON-parser dependency —
// good enough for this one bounded, well-formed doc; NOT a pattern to reuse
// on arbitrary/untrusted JSON. -------------------------------------------
const OPEN = '{'.charCodeAt(0), CLOSE = '}'.charCodeAt(0), QUOTE = '"'.charCodeAt(0), BACKSLASH = '\\'.charCodeAt(0);
const VARIANTS_MARKER = Buffer.from('"variants": [');

async function streamCombos(poolNames, onVariant) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let sliceStart = -1;
  let inObject = false;
  let pending = [];
  let foundMarker = false;
  let pre = Buffer.alloc(0);
  let scanned = 0;
  const meta = { sourceTimestamp: null, sourceVersion: null };

  function finishObject(finalSlice) {
    scanned++;
    const buf = pending.length === 0 ? finalSlice : Buffer.concat([...pending, finalSlice]);
    pending = [];
    let v;
    try {
      v = JSON.parse(buf.toString('utf8'));
    } catch {
      return; // malformed slice — skip rather than abort the whole sync
    }
    const names = (v.uses ?? []).map((u) => u.card?.name).filter(Boolean);
    if (names.some((n) => poolNames.has(n))) onVariant(v, names);
  }

  await new Promise((resolve, reject) => {
    const gunzip = createGunzip();
    const source = createReadStream(DUMP_CACHE_PATH);
    source.on('error', reject);
    gunzip.on('error', reject);
    gunzip.on('data', (chunk) => {
      let start = 0;
      if (!foundMarker) {
        // The marker sits within the first ~100 bytes of this doc (right
        // after `timestamp`/`version`) — accumulate whole chunks (no
        // tail-trimming) until it shows up, then resume from right after it.
        pre = Buffer.concat([pre, chunk]);
        const idx = pre.indexOf(VARIANTS_MARKER);
        if (idx === -1) return;
        foundMarker = true;
        // `timestamp`/`version` sit in this same pre-marker prefix — cheap
        // to pull out now while it's already in memory, for real staleness
        // tracking (a caller can compare this against a previous sync's own
        // stored value instead of just trusting a re-download happened).
        const prefix = pre.subarray(0, idx).toString('utf8');
        meta.sourceTimestamp = prefix.match(/"timestamp":\s*"([^"]+)"/)?.[1] ?? null;
        meta.sourceVersion = prefix.match(/"version":\s*"([^"]+)"/)?.[1] ?? null;
        const markerEndAbs = idx + VARIANTS_MARKER.length;
        const chunkStartAbs = pre.length - chunk.length;
        start = Math.max(0, markerEndAbs - chunkStartAbs);
      }
      for (let i = start; i < chunk.length; i++) {
        const b = chunk[i];
        if (inString) {
          if (escaped) escaped = false;
          else if (b === BACKSLASH) escaped = true;
          else if (b === QUOTE) inString = false;
          continue;
        }
        if (b === QUOTE) { inString = true; continue; }
        if (b === OPEN) {
          depth++;
          if (depth === 1) { inObject = true; sliceStart = i; }
          continue;
        }
        if (b === CLOSE) {
          depth--;
          if (depth === 0 && inObject) {
            finishObject(chunk.subarray(sliceStart, i + 1));
            inObject = false;
            sliceStart = -1;
          }
          continue;
        }
      }
      if (inObject && sliceStart !== -1) {
        pending.push(chunk.subarray(sliceStart));
        sliceStart = 0; // this object continues into the next chunk, from its start
      }
    });
    gunzip.on('end', resolve);
    source.pipe(gunzip);
  });
  console.log(`Scanned ${scanned} real Commander Spellbook variants.`);
  return meta;
}

async function main() {
  console.log('Reading current functional-model card pool...');
  const poolNames = await currentPoolNames();
  console.log(`Pool: ${poolNames.size} cards.`);

  await ensureDumpDownloaded();

  console.log('Streaming bulk dump, keeping combos that touch the pool...');
  const combos = [];
  const meta = await streamCombos(poolNames, (v, names) => {
    combos.push({
      id: v.id,
      templateId: v.of?.[0]?.id ?? null,
      cards: names.map((name) => ({ name })),
      produces: (v.produces ?? []).map((p) => p.feature?.name).filter(Boolean),
      description: v.description ?? '',
      easyPrerequisites: v.easyPrerequisites ?? '',
      notablePrerequisites: v.notablePrerequisites ?? '',
      identity: v.identity ?? '',
      popularity: v.popularity ?? null,
    });
  });

  console.log(`Kept ${combos.length} combos touching the current pool.`);
  writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        syncedAt: new Date().toISOString(),
        sourceTimestamp: meta.sourceTimestamp,
        sourceVersion: meta.sourceVersion,
        source: 'https://commanderspellbook.com',
        combos,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
