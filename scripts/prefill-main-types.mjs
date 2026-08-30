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
// Also marks every entry that already existed before this run `reviewed: 'human'` —
// a snapshot of "a human already confirmed this one via the review loop." Every
// card gets *some* entry after this script runs (mechanical prefill, if nothing
// else), so presence-in-file can no longer mean "reviewed" — REVIEW_PROCESS.md's
// pick-next-card step now keys off a truthy `reviewed` instead. See TAGGING_RULES.md.
//
// Usage: node scripts/prefill-main-types.mjs <set-code>

import { readFile, writeFile } from 'node:fs/promises';

const setCode = process.argv[2];
if (!setCode) {
  console.error('Usage: node scripts/prefill-main-types.mjs <set-code>');
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

const themes = JSON.parse(await readFile('data/global_themes.json', 'utf-8'));
const themeIds = new Set(themes.map((t) => t.id));

const allRaw = JSON.parse(await readFile(`data/${setCode}/${setCode}_scryfall.json`, 'utf-8'));
const raw = allRaw.filter((c) => !(c.type_line || '').includes('Basic') && !c.digital);

let relations = [];
try {
  relations = JSON.parse(await readFile(`data/${setCode}/${setCode}_relations.json`, 'utf-8'));
} catch {
  // no existing file — every card starts fresh
}
const byName = new Map(relations.map((e) => [e.name, e]));

// Snapshot BEFORE any mutation — these are the entries a human already reviewed
// via the live loop, as opposed to whatever this script is about to add.
for (const entry of relations) {
  entry.reviewed = 'human';
  entry.reviewed_at ??= new Date().toISOString(); // don't stomp the real confirmation time on a re-run
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
await writeFile(`data/${setCode}/${setCode}_relations.json`, JSON.stringify(relations, null, 2));

console.log(`data/${setCode}/${setCode}_relations.json: ${relations.length} entries (${newEntries} new, mechanical-only)`);
console.log(`Added: creature ${addedCreature}, land ${addedLand}, creature-subtype ${addedSubtype}`);
