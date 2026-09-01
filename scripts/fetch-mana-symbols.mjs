// Fetches Scryfall's official card-symbol set (mana costs, {T}, {Q}, {E},
// hybrid/phyrexian, etc. — https://scryfall.com/docs/api/card-symbols) and
// caches a code -> {dataUri, english} manifest to data/mana_symbols/, so
// ManaSymbol.vue can render the actual official symbols locally instead of
// mana-font's third-party recreation. Inlines each SVG as a base64 data URI
// (same technique scryfall.com itself uses in its own card-symbol CSS —
// one rule per symbol, no extra HTTP request per icon) rather than saving
// separate .svg files.
// Usage: node scripts/fetch-mana-symbols.mjs

import { writeFile, mkdir } from 'node:fs/promises';

const DIR = 'data/mana_symbols';

async function fetchSymbology() {
  const res = await fetch('https://api.scryfall.com/symbology', {
    headers: { 'User-Agent': 'mtg-visualizer/0.1', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Scryfall request failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.data;
}

const symbols = await fetchSymbology();
await mkdir(DIR, { recursive: true });

const manifest = {};
for (const s of symbols) {
  const code = s.symbol.slice(1, -1); // "{2/W}" -> "2/W"

  const res = await fetch(s.svg_uri, { headers: { 'User-Agent': 'mtg-visualizer/0.1' } });
  if (!res.ok) {
    console.warn(`Skipping ${s.symbol}: ${res.status} ${res.statusText}`);
    continue;
  }
  const svg = Buffer.from(await res.arrayBuffer());
  manifest[code] = {
    dataUri: `data:image/svg+xml;base64,${svg.toString('base64')}`,
    english: s.english,
  };
  await new Promise((r) => setTimeout(r, 50)); // be polite to Scryfall
}

await writeFile(`${DIR}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`Fetched ${symbols.length} symbols -> ${DIR}/manifest.json`);
