// Fetches image data for every token a set's cards can create (via each card's
// Scryfall `all_parts` field) and caches it to data/<set>_tokens.json: a map of
// token id -> { name, image }. Tokens aren't returned by the main set search, and
// aren't embedded inline on the creating card, so this is a separate small pass.
// Usage: node scripts/fetch-tokens.mjs fin

import { readFile, writeFile } from 'node:fs/promises';

const setCode = process.argv[2];
if (!setCode) {
  console.error('Usage: node scripts/fetch-tokens.mjs <set-code>');
  process.exit(1);
}

function tokenImage(card) {
  if (card.image_uris) return card.image_uris.normal;
  const face = (card.card_faces || []).find((f) => f.image_uris);
  return face ? face.image_uris.normal : null;
}

const cards = JSON.parse(await readFile(`data/${setCode}_cards.json`, 'utf-8'));

const tokenIds = new Set();
for (const c of cards) {
  for (const p of c.all_parts || []) {
    if (p.component === 'token') tokenIds.add(p.id);
  }
}

const ids = [...tokenIds];
const tokens = {};

for (let i = 0; i < ids.length; i += 75) {
  const batch = ids.slice(i, i + 75);
  const res = await fetch('https://api.scryfall.com/cards/collection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'mtg-visualizer/0.1', Accept: 'application/json' },
    body: JSON.stringify({ identifiers: batch.map((id) => ({ id })) }),
  });
  if (!res.ok) throw new Error(`Scryfall collection request failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  for (const card of data.data) {
    tokens[card.id] = { name: card.name, image: tokenImage(card) };
  }
  if (i + 75 < ids.length) await new Promise((r) => setTimeout(r, 100));
}

await writeFile(`data/${setCode}_tokens.json`, JSON.stringify(tokens, null, 2));
console.log(`Fetched ${Object.keys(tokens).length}/${ids.length} tokens -> data/${setCode}_tokens.json`);
