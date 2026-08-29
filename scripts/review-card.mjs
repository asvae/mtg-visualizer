// Review helper: given a card name, prints its full oracle text plus its current
// theme edges (role/weight/modifiers) from data/fin_graph.json, so relation
// create/remove/modify + theme create/remove/modify suggestions can be made
// against the actual card text instead of guessing from the graph alone.
//
// Usage: node scripts/review-card.mjs "<card name>"
//   Partial, case-insensitive match — errors with a list of candidates if ambiguous.

import { readFile } from 'node:fs/promises';

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Usage: node scripts/review-card.mjs "<card name>"');
  process.exit(1);
}

const graph = JSON.parse(await readFile('data/fin_graph.json', 'utf8'));
const raw = JSON.parse(await readFile('data/fin_cards.json', 'utf8'));
const rawById = new Map(raw.map((c) => [c.id, c]));
const themeById = new Map(graph.themes.map((t) => [t.id, t.label]));

const q = query.toLowerCase();
const matches = graph.cards.filter((c) => c.name.toLowerCase().includes(q));
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
const rawCard = rawById.get(card.id);

function fullText(c) {
  if (!c) return '(no scryfall data found)';
  let t = c.oracle_text || '';
  for (const f of c.card_faces || []) t += (t ? '\n--\n' : '') + (f.oracle_text || '');
  return t || '(no oracle text)';
}

console.log('='.repeat(60));
console.log(`${card.name}  [${card.typeLine}]  ${card.rarity}  cmc=${card.cmc}`);
console.log(`colors=${JSON.stringify(card.colors)} colorIdentity=${JSON.stringify(card.colorIdentity)}`);
if (card.keywords.length) console.log(`keywords: ${card.keywords.join(', ')}`);
console.log('-'.repeat(60));
console.log(fullText(rawCard));
console.log('-'.repeat(60));

const edges = graph.edges.filter((e) => e.card === card.id);
if (edges.length === 0) {
  console.log('(no theme edges)');
} else {
  for (const e of edges) {
    const mods = e.modifiers.length ? ` [${e.modifiers.join(', ')}]` : '';
    console.log(`${e.role.padEnd(8)} ${themeById.get(e.theme) ?? e.theme}  weight=${e.weight}${mods}`);
  }
}
console.log('='.repeat(60));
console.log(`scryfall: ${card.scryfallUri}`);
