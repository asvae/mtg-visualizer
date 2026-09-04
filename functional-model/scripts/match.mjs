// Naive synergy matcher — reads each card's own trace.json (see
// run-scenarios.mjs), NEVER re-runs a card. Two signals pulled straight out
// of the persisted logs, no hand-authored metadata:
//   1. Does this card CREATE tokens at all (any `createToken` entry)?
//   2. Does this card's own log length vary across its scenarios? — a card
//      whose scenarios.ts already covers "0 of X" vs "N of X" and whose
//      resulting trace visibly differs is a payoff that cares about X.
//
// Usage: npx vite-node functional-model/scripts/match.mjs

import { readdir, readFile } from 'node:fs/promises';

const cardsDir = new URL('../cards/', import.meta.url);
const slugs = (await readdir(cardsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);

const cards = [];
for (const slug of slugs) {
  const traceRaw = await readFile(new URL(`../cards/${slug}/trace.json`, import.meta.url), 'utf8').catch(() => null);
  if (!traceRaw) continue;
  const cardModule = await import(`../cards/${slug}/index.ts`);
  const card = Object.values(cardModule)[0];
  cards.push({ slug, name: card.name, traces: JSON.parse(traceRaw) });
}

function producesTokens(traces) {
  return traces.some((t) => t.log.some((e) => e.fn === 'createToken'));
}
function varysAcrossScenarios(traces) {
  const counts = traces.map((t) => t.log.length);
  return Math.max(...counts) > Math.min(...counts);
}

console.log(`Loaded ${cards.length} card(s) with a trace.json: ${cards.map((c) => c.name).join(', ')}\n`);
console.log('=== Naive synergy match (from persisted trace.json logs only) ===');
let found = 0;
for (const producer of cards) {
  if (!producesTokens(producer.traces)) continue;
  for (const consumer of cards) {
    if (producer === consumer) continue;
    if (varysAcrossScenarios(consumer.traces)) {
      console.log(`${producer.name} (produces tokens) <-> ${consumer.name} (payoff varies across its own scenarios) — MATCH`);
      found++;
    }
  }
}
if (!found) console.log('(none found)');
