// Bulk-prefills the mechanical, zero-judgment "main type" facts into
// data/<set>/<set>_relations.json for every card in the set: self-identity Creature
// and Land (both curated themes, weight 2 produce — same convention as any other
// self-identity theme in TAGGING_RULES.md), plus every creature subtype the card
// has (Bandit, Human, Goblin, ... — weight 2 produce, same as buildGraph.ts always
// derived these). These are facts anyone can read straight off type_line with zero
// interpretation, so there's no reason a reviewer should have to type them by hand
// for all 306 cards one at a time.
//
// Merge only ever ADDS a role+theme pair that isn't already present for that card —
// it never touches or overwrites an existing entry's weight/roles (a reviewer who
// already tagged `creature: produce 3` because the card also makes extra creature
// tokens keeps their weight; this script won't stomp it back down to 2).
//
// 2026-08-31: no longer touches `reviewed` at all — that field doesn't exist on
// relations entries anymore. Enrichment/review status lives entirely in
// tagging/card-enrichment-status.json, decoupled from this file's mutations. A
// brand-new mechanical-only entry this run creates gets a `script`/`none` status
// entry there (if nothing better is already recorded for that name) — a
// pre-existing entry's status is untouched, since whatever review it already went
// through happened independently of prefill ever running.
//
// Usage: node scripts/prefill-main-types.mjs <set-code>

import { readFile, writeFile } from 'node:fs/promises';

const setCode = process.argv[2];
if (!setCode) {
  console.error('Usage: node scripts/prefill-main-types.mjs <set-code>');
  process.exit(1);
}

// Same derivation as app/lib/buildGraph.ts — kept in sync by hand since this
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

// FIN's data lives under data/ (actually served); every historical set lives
// under tagging/sets/ (dev-only, never served) — try both.
async function findSetDir(code) {
  for (const dir of [`data/${code}`, `tagging/sets/${code}`]) {
    try {
      await readFile(`${dir}/${code}_scryfall.json`, 'utf-8');
      return dir;
    } catch {
      // try next
    }
  }
  throw new Error(`No ${code}_scryfall.json found under data/${code}/ or tagging/sets/${code}/`);
}

const themes = JSON.parse(await readFile('data/global_themes.json', 'utf-8'));
const themeIds = new Set(themes.map((t) => t.id));

const dir = await findSetDir(setCode);
const allRaw = JSON.parse(await readFile(`${dir}/${setCode}_scryfall.json`, 'utf-8'));
const raw = allRaw.filter((c) => !(c.type_line || '').includes('Basic') && !c.digital);

let relations = [];
try {
  relations = JSON.parse(await readFile(`${dir}/${setCode}_relations.json`, 'utf-8'));
} catch {
  // no existing file — every card starts fresh
}
const byName = new Map(relations.map((e) => [e.name, e]));

const STATUS_PATH = 'tagging/card-enrichment-status.json';
let status = {};
try {
  status = JSON.parse(await readFile(STATUS_PATH, 'utf-8'));
} catch {
  // no existing file yet
}

let addedCreature = 0;
let addedLand = 0;
let addedSubtype = 0;
let newEntries = 0;

for (const c of raw) {
  const facts = [];
  if (/\bCreature\b/.test(c.type_line || '')) facts.push(['creature', 2, 'addedCreature']);
  if (/\bLand\b/.test(c.type_line || '')) facts.push(['land', 2, 'addedLand']);
  for (const word of creatureSubtypes(c)) {
    const slug = slugify(word);
    if (slug && !themeIds.has(slug)) facts.push([slug, 2, 'addedSubtype']);
  }
  if (!facts.length) continue;

  let entry = byName.get(c.name);
  if (!entry) {
    entry = { name: c.name, themes: {} };
    byName.set(c.name, entry);
    relations.push(entry);
    newEntries++;
    status[c.name] ??= { enrichment: 'script', review: 'none' };
  }
  entry.themes.produce ??= {};
  for (const [id, weight, counter] of facts) {
    if (id in entry.themes.produce) continue; // never overwrite an existing judgment
    entry.themes.produce[id] = weight;
    if (counter === 'addedCreature') addedCreature++;
    else if (counter === 'addedLand') addedLand++;
    else addedSubtype++;
  }
}

relations.sort((a, b) => a.name.localeCompare(b.name));
await writeFile(`${dir}/${setCode}_relations.json`, JSON.stringify(relations, null, 2));
await writeFile(STATUS_PATH, JSON.stringify(status, null, 2) + '\n');

console.log(`${dir}/${setCode}_relations.json: ${relations.length} entries (${newEntries} new, mechanical-only)`);
console.log(`Added: creature ${addedCreature}, land ${addedLand}, creature-subtype ${addedSubtype}`);
