// Review helper: given a card name, prints its full oracle text plus its current
// theme relations (role/weight, from data/fin/fin_relations.json) and derived
// creature-type relations, so create/remove/modify suggestions can be made against
// the actual card text instead of guessing. There's no pre-built graph file to read
// this from anymore (the visualizer assembles it client-side, see
// src/lib/buildGraph.ts) — this script does the same small merge itself, just for
// the one card being reviewed.
//
// Usage: node scripts/review-card.mjs "<card name>"
//   Partial, case-insensitive match — errors with a list of candidates if ambiguous.

import { readFile } from 'node:fs/promises';

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Usage: node scripts/review-card.mjs "<card name>"');
  process.exit(1);
}

const raw = JSON.parse(await readFile('data/fin/fin_scryfall.json', 'utf8'));
const relations = JSON.parse(await readFile('data/fin/fin_relations.json', 'utf8'));
const themes = JSON.parse(await readFile('data/global_themes.json', 'utf8'));
const relationsByName = new Map(relations.map((t) => [t.name, t]));
const themeLabelById = new Map(themes.map((t) => [t.id, t.label]));

// Same derivation as src/lib/buildGraph.ts's creatureSubtypes/slugify — kept in
// sync by hand since this script and the browser module run in different
// runtimes (plain Node here, no build step).
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

const q = query.toLowerCase();
const matches = raw.filter((c) => c.name.toLowerCase().includes(q));
if (matches.length === 0) {
  console.error(`No card matches "${query}"`);
  process.exit(1);
}
if (matches.length > 1) {
  const exact = matches.find((c) => c.name.toLowerCase() === q);
  if (!exact) {
    console.error(`Ambiguous ("${query}") — candidates:\n` + matches.map((c) => `  ${c.name}`).join('\n'));
    process.exit(1);
  }
  matches.length = 0;
  matches.push(exact);
}

const card = matches[0];

function fullText(c) {
  let t = c.oracle_text || '';
  for (const f of c.card_faces || []) t += (t ? '\n--\n' : '') + (f.oracle_text || '');
  return t || '(no oracle text)';
}

console.log('='.repeat(60));
console.log(`${card.name}  [${card.type_line}]  ${card.rarity}  cmc=${card.cmc ?? 0}`);
console.log(`colors=${JSON.stringify(card.colors ?? [])} colorIdentity=${JSON.stringify(card.color_identity ?? [])}`);
console.log('-'.repeat(60));
console.log(fullText(card));
console.log('-'.repeat(60));

const entry = relationsByName.get(card.name);
const curatedThemeIds = new Set(themes.map((t) => t.id));
const taggedThemeIds = new Set(Object.values(entry?.themes ?? {}).flatMap((byTheme) => Object.keys(byTheme ?? {})));
// Candidate creature-type ids from type_line — a hint only, not a tagged relation:
// the agent decides whether/how to tag these, same as any curated theme.
const typeCandidates = creatureSubtypes(card)
  .map(slugify)
  .filter((s) => s && !curatedThemeIds.has(s) && !taggedThemeIds.has(s));

let printedAny = false;
if (entry) {
  for (const [role, byTheme] of Object.entries(entry.themes ?? {})) {
    for (const [theme, weight] of Object.entries(byTheme ?? {})) {
      console.log(`${role.padEnd(11)} ${themeLabelById.get(theme) ?? theme}  weight=${weight}`);
      printedAny = true;
    }
  }
} else {
  console.log('atypical    Not Processed  weight=1  (no data/fin/fin_relations.json entry yet)');
  printedAny = true;
}
if (!printedAny) console.log('(no relations)');
if (typeCandidates.length) {
  console.log(`type_line suggests (untagged): ${typeCandidates.join(', ')}`);
}

console.log('='.repeat(60));
console.log(`scryfall: ${card.scryfall_uri}`);
