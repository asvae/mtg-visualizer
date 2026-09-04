// Concatenates every card's own flat-trace.json into one shared pool,
// tagging each entry with `card` — this is the exact point (per the
// conversation this came out of) where per-file context stops being enough:
// once entries from different cards sit in one list together, each one
// needs to say which card it's from. Nothing upstream of this (trace.json,
// flat-trace.json) carries that tag on non-subject entries on purpose —
// see flatten-traces.mjs's own header.
//
// Usage: npx vite-node functional-model/scripts/pool-traces.mjs
// Writes: functional-model/pool.json

import { readdir, readFile, writeFile } from 'node:fs/promises';

const cardsDir = new URL('../cards/', import.meta.url);
const slugs = (await readdir(cardsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);

const pool = [];
for (const slug of slugs) {
  const flatRaw = await readFile(new URL(`../cards/${slug}/flat-trace.json`, import.meta.url), 'utf8').catch(() => null);
  if (!flatRaw) {
    console.log(`skip ${slug}: no flat-trace.json (run flatten-traces.mjs first)`);
    continue;
  }
  const cardModule = await import(`../cards/${slug}/index.ts`);
  const card = Object.values(cardModule)[0];
  const entries = JSON.parse(flatRaw);
  for (const entry of entries) pool.push({ card: card.name, ...entry });
}

const outPath = new URL('../pool.json', import.meta.url);
await writeFile(outPath, JSON.stringify(pool, null, 2) + '\n', 'utf8');
console.log(`wrote functional-model/pool.json (${pool.length} entries from ${slugs.length} cards)`);
