// Tags cards from data/<set>_cards.json against a curated theme list, producing
// data/<set>_graph.json: { cards, themes, edges }.
//
// v1 heuristic tagger. Patterns are intentionally simple (regex over oracle_text).
// Expect noise -> that's what the "atypical" role and the graph review pass are for.
// Refine THEMES below after looking at the rendered graph, then re-run.

import { readFile, writeFile } from 'node:fs/promises';
import { EXCEPTIONS } from './exceptions.mjs';
import { THEMES, REMOVAL, REPEAT_TRIGGER, fullText, tagCard } from './lib/tagger.mjs';

const setCode = process.argv[2];
if (!setCode) {
  console.error('Usage: node scripts/tag-cards.mjs <set-code>');
  process.exit(1);
}

// Evergreen / combat keywords -> rendered as badges on the card node, not graph edges.
const BADGE_KEYWORDS = new Set([
  'Flying', 'Trample', 'Vigilance', 'Reach', 'Menace', 'Deathtouch', 'Haste',
  'Lifelink', 'Ward', 'Indestructible', 'Flash', 'Crew', 'First strike', 'Double strike',
  'Hexproof', 'Defender',
]);

// Card-level power-score signals (independent of any theme). REMOVAL is shared
// with the 'removal' theme in lib/tagger.mjs.
const DRAW_CARD = /\bdraws? (?:a|an|two|three|four|five|x|\d+) cards?\b/i;
const PAYOFF_VERBS = /\b(draw|create|search|put a|deals? \d+ damage|destroy|exile|gain \d+ life)\b/i;

// Single-faced (and split/adventure, which share one image at the top level) cards
// return one URL; true double-faced cards (each face has its own image_uris) return
// both, front first, so the UI can show both sides on hover.
function cardImages(card) {
  if (card.image_uris) return [card.image_uris.normal];
  return (card.card_faces || []).filter((f) => f.image_uris).map((f) => f.image_uris.normal);
}

function cardKeywords(card) {
  const kws = new Set(card.keywords || []);
  for (const f of card.card_faces || []) for (const k of f.keywords || []) kws.add(k);
  return [...kws];
}

const allRaw = JSON.parse(await readFile(`data/${setCode}_cards.json`, 'utf-8'));
// Basic lands (Plains/Island/.../Wastes) carry no synergy text and are numerous —
// pure clutter in the graph, so drop them entirely rather than filtering in the UI.
// Digital-only Alchemy rebalances (e.g. "A-Vivi Ornitier") aren't part of the actual
// set — fetch-set.mjs excludes them at the query level, but guard here too in case
// data/<set>_cards.json was fetched before that fix.
const raw = allRaw.filter((c) => !(c.type_line || '').includes('Basic') && !c.digital);

let tokensById = {};
try {
  tokensById = JSON.parse(await readFile(`data/${setCode}_tokens.json`, 'utf-8'));
} catch {
  console.warn(`No data/${setCode}_tokens.json found — run "npm run fetch:tokens ${setCode}" for token images on hover. Continuing without them.`);
}

function cardTokens(card) {
  const seen = new Set();
  const tokens = [];
  for (const p of card.all_parts || []) {
    if (p.component !== 'token' || seen.has(p.id)) continue;
    seen.add(p.id);
    const t = tokensById[p.id];
    if (t?.image) tokens.push({ name: t.name, image: t.image });
  }
  return tokens;
}

const cards = raw.map((c) => {
  const text = fullText(c);
  const kws = cardKeywords(c).filter((k) => BADGE_KEYWORDS.has(k));

  // Card power score (0-3), text-only signals, independent of theme/rarity.
  let power = 0;
  if (DRAW_CARD.test(text)) power++; // card advantage
  if (REPEAT_TRIGGER.test(text) && PAYOFF_VERBS.test(text)) power++; // repeatable value engine
  if (REMOVAL.test(text)) power++; // interaction
  if (kws.length >= 2) power++; // evasion/keyword stacking
  power = Math.min(power, 3);

  return {
    id: c.id,
    name: c.name,
    cmc: c.cmc ?? 0,
    colors: c.colors || (c.card_faces ? c.card_faces.flatMap((f) => f.colors || []) : []),
    colorIdentity: c.color_identity || [],
    typeLine: c.type_line || '',
    rarity: c.rarity || 'common',
    images: cardImages(c),
    tokens: cardTokens(c),
    scryfallUri: c.scryfall_uri,
    keywords: kws,
    power,
  };
});

// Per-card pipeline (regex theme detection + this card's EXCEPTIONS + "No Theme"
// fallback) lives in lib/tagger.mjs as tagCard() — same function the review tests
// snapshot against, so the graph and the tests can never quietly diverge.
const edges = raw.flatMap(tagCard);

// Sanity check only — an exception referencing a card outside this set (typo, or
// basic/digital-only and filtered out above) silently never fires from inside
// tagCard, so surface it here instead.
const rawNames = new Set(raw.map((c) => c.name));
for (const ex of EXCEPTIONS) {
  if (!rawNames.has(ex.card)) {
    console.warn(`Exception references unknown card "${ex.card}" (not in this set, or basic/digital-only and filtered out) — skipping.`);
  }
}

const graph = {
  set: setCode,
  generatedFrom: raw.length,
  themes: [...THEMES.map((t) => ({ id: t.id, label: t.label })), { id: 'no-theme', label: 'No Theme' }],
  cards,
  edges,
};

await writeFile(`data/${setCode}_graph.json`, JSON.stringify(graph, null, 2));

const roleCounts = edges.reduce((acc, e) => ((acc[e.role] = (acc[e.role] || 0) + 1), acc), {});
const weightCounts = edges.reduce((acc, e) => ((acc[e.weight] = (acc[e.weight] || 0) + 1), acc), {});
const powerCounts = cards.reduce((acc, c) => ((acc[c.power] = (acc[c.power] || 0) + 1), acc), {});
console.log(`Tagged ${raw.length} cards -> ${edges.length} edges across ${graph.themes.length} themes (${THEMES.length} curated + No Theme)`);
console.log('Role breakdown:', roleCounts);
console.log('Edge weight breakdown:', weightCounts);
console.log('Card power breakdown:', powerCounts);
