// Review helper: given a card name, prints its full oracle text plus its
// current synergy-edge decomposition (synergy-model/data/edges.json — global,
// not set-scoped), so a decomposition can be drafted/checked against the
// actual card text. Mirrors scripts/review-card.mjs's shape for the
// theme-relations pipeline. Oracle text itself is still looked up from
// data/fin/fin_scryfall.json since FIN is the only set fetched into this
// repo so far — the edges data being looked up against it isn't FIN-specific.
//
// Usage: node synergy-model/scripts/synergy-card.mjs "<card name>"
//   Partial, case-insensitive match — errors with a list of candidates if ambiguous.

import { readFile } from 'node:fs/promises';

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Usage: node synergy-model/scripts/synergy-card.mjs "<card name>"');
  process.exit(1);
}

const raw = JSON.parse(await readFile('data/fin/fin_scryfall.json', 'utf8'));
const edgesData = JSON.parse(await readFile('synergy-model/data/edges.json', 'utf8'));
const status = JSON.parse(await readFile('synergy-model/data/edges_status.json', 'utf8'));
const edgesByName = new Map(edgesData.map((e) => [e.name, e.edges]));

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
console.log('-'.repeat(60));
console.log(fullText(card));
console.log('-'.repeat(60));

const edges = edgesByName.get(card.name);
if (edges?.length) {
  for (const e of edges) {
    console.log(`${e.step.padEnd(5)} ${e.role.padEnd(9)} ${e.owner.padEnd(4)} ${e.zone.padEnd(4)} ${e.thing.padEnd(22)} ${e.opt.padEnd(5)} ${e.flags}`);
  }
  console.log(`review: ${status[card.name]?.review ?? 'none'}`);
} else {
  console.log('(no synergy edges yet)');
}

console.log('='.repeat(60));
console.log(`scryfall: ${card.scryfall_uri}`);
