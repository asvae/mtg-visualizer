// Scans a set's raw Scryfall data for creature subtypes (Human, Goblin, Dragon, ...)
// and merges their id -> label into data/type_themes.json — a global registry,
// alongside data/themes.json, but kept separate since these are auto-derived
// (mechanical, no review judgment) rather than curated. Purely for human
// inspection: src/lib/buildGraph.ts re-derives the actual per-card edges itself,
// straight from type_line, on every load — it doesn't read this file. Safe to
// re-run after fetching a new set: existing ids are never removed or relabeled,
// only new ones added, so this accumulates across every set ever fetched.
//
// Usage: node scripts/derive-type-themes.mjs fin

import { readFile, writeFile } from 'node:fs/promises';

const setCode = process.argv[2];
if (!setCode) {
  console.error('Usage: node scripts/derive-type-themes.mjs <set-code>');
  process.exit(1);
}

// Same derivation as src/lib/buildGraph.ts — kept in sync by hand since this
// script and the browser module run in different runtimes (plain Node here,
// no build step).
function creatureSubtypes(card) {
  const faces = card.card_faces?.length ? card.card_faces : [card];
  const subtypes = new Set();
  for (const f of faces) {
    const [main, sub] = (f.type_line || '').split('—').map((s) => s.trim());
    if (!sub || !/\bCreature\b/.test(main || '')) continue;
    for (const word of sub.split(/\s+/)) if (word) subtypes.add(word);
  }
  return [...subtypes];
}
function slugify(word) {
  return word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const raw = JSON.parse(await readFile(`data/${setCode}/${setCode}_scryfall.json`, 'utf-8'));
const themes = JSON.parse(await readFile('data/themes.json', 'utf-8'));
const themeIds = new Set(themes.map((t) => t.id));

let existing = [];
try {
  existing = JSON.parse(await readFile('data/type_themes.json', 'utf-8'));
} catch {
  // first run — start fresh
}
const byId = new Map(existing.map((t) => [t.id, t.label]));

let added = 0;
for (const c of raw) {
  for (const word of creatureSubtypes(c)) {
    const slug = slugify(word);
    if (!slug || themeIds.has(slug) || byId.has(slug)) continue;
    byId.set(slug, word);
    added++;
  }
}

const merged = [...byId.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.id.localeCompare(b.id));
await writeFile('data/type_themes.json', JSON.stringify(merged, null, 2));
console.log(`data/type_themes.json: ${merged.length} type themes total (${added} new from "${setCode}")`);
