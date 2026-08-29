// Fetches all cards for a set code from Scryfall and caches them to data/<set>_cards.json
// Usage: node scripts/fetch-set.mjs fin

import { writeFile, mkdir } from 'node:fs/promises';

const setCode = process.argv[2];
if (!setCode) {
  console.error('Usage: node scripts/fetch-set.mjs <set-code>');
  process.exit(1);
}

async function fetchSet(code) {
  const cards = [];
  // game:paper excludes Arena-only Alchemy rebalances (e.g. "A-" prefixed cards) —
  // those share the set code but aren't part of the actual paper set.
  let url = `https://api.scryfall.com/cards/search?q=set%3A${code}+game%3Apaper&order=set`;
  while (url) {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'mtg-visualizer/0.1',
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Scryfall request failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    cards.push(...data.data);
    url = data.has_more ? data.next_page : null;
    if (url) await new Promise((r) => setTimeout(r, 100)); // be polite to Scryfall
  }
  return cards;
}

const cards = await fetchSet(setCode);
await mkdir('data', { recursive: true });
await writeFile(`data/${setCode}_cards.json`, JSON.stringify(cards, null, 2));
console.log(`Fetched ${cards.length} cards for set "${setCode}" -> data/${setCode}_cards.json`);
