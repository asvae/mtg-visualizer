// Whole-pool synergy report — loads every card's own AI-authored, verified
// cards/<slug>/synergy.json (v2 attribute-bag facts, see SYNERGY_DESIGN.md)
// and joins source facts against sink facts via synergy.ts's own
// `findInteractionsForCard` (the same matcher a live server route would
// call for one card at a time — this script just calls it for every card
// and prints the producer side of each match once, so the whole pool's
// cross-card matches are visible in one report without printing each edge
// twice from both ends).
//
// A card whose synergy.json is still the OLD string-key shape (or empty —
// not yet authored under v2 at all) is skipped with a note, same tolerance
// convention scripts/verify-synergy.mjs uses — this script only ever joins
// cards that have real, verified v2 facts.
//
// Usage: npx vite-node functional-model/scripts/find-synergies.mjs
// (run scripts/verify-synergy.mjs first — this script trusts synergy.json,
// it does not re-check it against trace.json)

import { readdir, readFile } from 'node:fs/promises';
import { findInteractionsForCard } from '../synergy.ts';

const cardsDir = new URL('../cards/', import.meta.url);
const slugs = (await readdir(cardsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);

function isV2Shaped(synergy) {
  const all = [...(synergy.source ?? []), ...(synergy.sink ?? [])];
  if (all.length === 0) return false;
  return all.every((f) => 'zone' in f || 'event' in f);
}

const pool = [];
let skipped = 0;
for (const slug of slugs) {
  const cardModule = await import(`../cards/${slug}/definition.ts`).catch(() => null);
  if (!cardModule) {
    console.log(`skip ${slug}: no definition.ts`);
    continue;
  }
  const card = Object.values(cardModule)[0];

  const synergyRaw = await readFile(new URL(`../cards/${slug}/synergy.json`, import.meta.url), 'utf8').catch(() => null);
  if (!synergyRaw) {
    console.log(`skip ${slug}: no synergy.json (author cards/${slug}/synergy.json, then run verify-synergy.mjs)`);
    skipped++;
    continue;
  }
  const synergy = JSON.parse(synergyRaw);
  if (!isV2Shaped(synergy)) {
    skipped++;
    continue; // old (v1) shape or genuinely empty — not yet authored under v2, quietly excluded from this report (see verify-synergy.mjs for the full per-card breakdown)
  }

  pool.push({
    name: card.name,
    card,
    source: (synergy.source ?? []).map((f) => ({ ...f, role: 'source' })),
    sink: (synergy.sink ?? []).map((f) => ({ ...f, role: 'sink' })),
  });
}

// token-cards/<slug>/definition.ts doesn't exist yet anywhere in this pool (see
// SYNERGY_DESIGN.md's "Tokens" section: "the token-cards/ folder grows on
// demand") — an empty registry here means a `{token}`-subject produce
// fact (Kain's/Namazu Trader's own Treasure, The Final Days' own Horror)
// can't resolve static attributes yet, so it only ever matches an
// UNCONSTRAINED want on that zone, never a type/cmc-filtered one. Real,
// current limitation — not a bug in the matcher.
const tokens = {};

console.log(`Cards: ${slugs.length}. v2-authored: ${pool.length}. Skipped (unmigrated/old-shape): ${skipped}.\n`);
console.log('=== Cross-card matches (producer != wanter), producer side only ===');
let found = 0;
for (const { name } of pool) {
  const groups = findInteractionsForCard(name, pool, tokens);
  for (const group of groups) {
    if (group.direction !== 'source') continue;
    for (const match of group.matches) {
      if (match.card === name && !match.selfInteraction) continue;
      const label = match.card === name ? `${name} (self-interaction: ${match.selfInteraction})` : `${name} --[${group.description}]--> ${match.card}`;
      console.log(label);
      found++;
    }
  }
}
if (!found) console.log('(none found)');
